import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiKeyCheck } from '../services/geminiService';
import { isQuotaExhausted, validateApiKey } from '../services/geminiService';
import { getModelChain } from '../services/modelStore';

/**
 * No network, no real key. The Gemini SDK is replaced wholesale, so
 * `generateContent` only ever does what a test tells it to.
 *
 * `isQuotaExhausted` is exported and tested directly. `isAuthError`,
 * `isTransientError` and `backoffDelayMs` are module-private, so they are pinned
 * through `validateApiKey` - the one public function whose whole contract is
 * "how did it classify that failure?" (`valid` / `transient` / `reason`), plus
 * the number of attempts each model got, which is the observable side of
 * "retryable?".
 */

const NOT_A_REAL_KEY = 'test-key-never-sent-anywhere';

const sdk = vi.hoisted(() => ({
    generateContent: (_req: unknown): Promise<unknown> =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub generateContent')),
    list: (): Promise<unknown> =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub models.list')),
}));

vi.mock('@google/genai', () => {
    class GoogleGenAI {
        models = {
            generateContent: (req: unknown) => sdk.generateContent(req),
            list: () => sdk.list(),
        };
    }
    return {
        GoogleGenAI,
        // Only present because geminiService imports it by name.
        FunctionDeclaration: class FunctionDeclaration {},
        Type: {
            STRING: 'STRING',
            NUMBER: 'NUMBER',
            INTEGER: 'INTEGER',
            BOOLEAN: 'BOOLEAN',
            OBJECT: 'OBJECT',
            ARRAY: 'ARRAY',
        },
    };
});

/** The shape the SDK throws: an Error carrying the HTTP status. */
function httpError(status: number | undefined, message: string): Error {
    const error = new Error(message) as Error & { status?: number };
    if (status !== undefined) error.status = status;
    return error;
}

/** A genuine network failure: nothing reached Google, so there is no status. */
function networkError(message = 'Failed to fetch'): Error {
    return new Error(message);
}

const QUOTA_429 =
    'You exceeded your current quota, please check your plan and billing details.';
const RATE_LIMIT_429 = 'Rate limit exceeded for generateContent. Please retry shortly.';
const OVERLOADED_503 = 'The model is overloaded. Please try again later.';

/**
 * `runWithRetry` sleeps between attempts with exponential backoff, so the retry
 * assertions drive a fake clock instead of really waiting several seconds.
 */
async function validateWithFakeTimers(): Promise<ApiKeyCheck> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
        let settled = false;
        const pending = validateApiKey(NOT_A_REAL_KEY).then(
            (result) => {
                settled = true;
                return result;
            },
            (error: unknown) => {
                settled = true;
                throw error;
            },
        );

        for (let tick = 0; tick < 40 && !settled; tick++) {
            await vi.advanceTimersByTimeAsync(60_000);
        }
        if (!settled) throw new Error('validateApiKey never settled under fake timers');

        return await pending;
    } finally {
        vi.useRealTimers();
    }
}

/** Make every model fail the same way, recording which model was tried. */
function failEverywhereWith(error: Error): string[] {
    const attempts: string[] = [];
    sdk.generateContent = (req: unknown) => {
        attempts.push((req as { model: string }).model);
        return Promise.reject(error);
    };
    return attempts;
}

beforeEach(() => {
    // getModelChain() is read-only here: the module ships with the default chain.
    expect(getModelChain().length).toBeGreaterThan(0);
});

afterEach(() => {
    sdk.generateContent = () =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub generateContent'));
});

describe('isQuotaExhausted', () => {
    it('flags a 429 whose message says the current quota was exceeded', () => {
        expect(isQuotaExhausted(httpError(429, QUOTA_429))).toBe(true);
    });

    it('flags the RESOURCE_EXHAUSTED wording', () => {
        expect(isQuotaExhausted(httpError(429, 'RESOURCE_EXHAUSTED: quota exceeded'))).toBe(true);
    });

    it('flags "quota exceeded" regardless of case', () => {
        expect(isQuotaExhausted(httpError(429, 'Quota Exceeded for this project'))).toBe(true);
    });

    it('does not flag an ordinary 429 rate limit as quota exhaustion', () => {
        // The distinction matters: a rate limit clears in seconds, a spent quota
        // does not, and neither is fixed by retrying.
        expect(isQuotaExhausted(httpError(429, RATE_LIMIT_429))).toBe(false);
    });

    it('does not flag a 429 that carries no message at all', () => {
        expect(isQuotaExhausted({ status: 429 })).toBe(false);
    });

    it('does not flag quota wording on a non-429 status', () => {
        expect(isQuotaExhausted(httpError(400, QUOTA_429))).toBe(false);
        expect(isQuotaExhausted(httpError(403, QUOTA_429))).toBe(false);
        expect(isQuotaExhausted(httpError(500, QUOTA_429))).toBe(false);
        expect(isQuotaExhausted(networkError(QUOTA_429))).toBe(false);
    });

    it('is safe on empty and non-error input', () => {
        expect(isQuotaExhausted(undefined)).toBe(false);
        expect(isQuotaExhausted(null)).toBe(false);
        expect(isQuotaExhausted('quota exceeded')).toBe(false);
        expect(isQuotaExhausted(networkError())).toBe(false);
    });
});

describe('auth classification (isAuthError) via validateApiKey', () => {
    it('stops after one attempt and calls a 401 an invalid key', async () => {
        const attempts = failEverywhereWith(httpError(401, 'Unauthorized'));

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(1);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('auth');
        expect(result.transient).toBe(false);
    });

    it('stops after one attempt and calls a 403 an invalid key', async () => {
        const attempts = failEverywhereWith(httpError(403, 'Permission denied'));

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(1);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('auth');
        expect(result.transient).toBe(false);
    });

    it('treats a 400 that names the API key as an auth failure', async () => {
        const attempts = failEverywhereWith(
            httpError(400, 'API key not valid. Please pass a valid API key.'),
        );

        const result = await validateWithFakeTimers();

        // Auth short-circuits the whole chain: a rejected key fails on every model.
        expect(attempts).toHaveLength(1);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('auth');
        expect(result.transient).toBe(false);
    });

    it('treats a 400 that does NOT name the key as a model problem, not a bad key', async () => {
        // Regression: a malformed request (an unsupported config field) was being
        // reported as "your key is invalid", locking out a working key.
        const attempts = failEverywhereWith(
            httpError(400, 'Unknown name "thinkingConfig" at \'model\': Cannot find field.'),
        );

        const result = await validateWithFakeTimers();

        // Every model is tried, because the failure is not credential-shaped...
        expect(attempts).toHaveLength(getModelChain().length);
        // ...and the key is explicitly NOT blamed.
        expect(result.reason).not.toBe('auth');
        expect(result.reason).toBe('model');
        expect(result.valid).toBe(false);
    });

    it('reports a chain-wide network failure as transient, not as a bad key', async () => {
        const attempts = failEverywhereWith(networkError());

        const result = await validateWithFakeTimers();

        // Offline: retried on every model, and never blamed on the key.
        expect(attempts).toHaveLength(getModelChain().length * 3);
        expect(result.reason).toBe('transient');
        expect(result.valid).toBe(false);
    });
});

describe('transient classification (isTransientError) via validateApiKey', () => {
    it('retries a 503 three times per model, then moves down the chain', async () => {
        const attempts = failEverywhereWith(httpError(503, OVERLOADED_503));

        const result = await validateWithFakeTimers();

        // runWithRetry allows two retries, i.e. 3 attempts per model.
        expect(attempts).toHaveLength(getModelChain().length * 3);
        expect(result.valid).toBe(false);
        expect(result.transient).toBe(true);
        expect(result.reason).toBe('transient');
    });

    it('retries a 500', async () => {
        const attempts = failEverywhereWith(httpError(500, 'Internal error encountered.'));

        await validateWithFakeTimers();

        expect(attempts).toHaveLength(getModelChain().length * 3);
    });

    it('retries a network error with no status at all', async () => {
        // Offline / DNS failure / captive portal: the most common transient case.
        const attempts = failEverywhereWith(
            networkError('getaddrinfo ENOTFOUND generativelanguage.googleapis.com'),
        );

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(getModelChain().length * 3);
        expect(result.transient).toBe(true);
        expect(result.reason).toBe('transient');
    });

    it('retries a plain 429 rate limit', async () => {
        const attempts = failEverywhereWith(httpError(429, RATE_LIMIT_429));

        await validateWithFakeTimers();

        expect(attempts).toHaveLength(getModelChain().length * 3);
    });

    it('does not retry a 404, and does not blame the key for it', async () => {
        const attempts = failEverywhereWith(httpError(404, 'Not found.'));

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(getModelChain().length);
        expect(result.valid).toBe(false);
        // The key is fine; this key just cannot reach that model.
        expect(result.reason).toBe('model');
        expect(result.transient).toBe(false);
    });

    it('calls the whole failure transient when any model in the chain was transient', async () => {
        // A 503 on model 1 followed by 404s must not read as permanent.
        const chain = getModelChain();
        const attempts: string[] = [];

        sdk.generateContent = (req: unknown) => {
            const model = (req as { model: string }).model;
            attempts.push(model);
            return Promise.reject(
                model === chain[0] ? httpError(503, OVERLOADED_503) : httpError(404, 'Not found.'),
            );
        };

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(3 + chain.length - 1);
        expect(result.transient).toBe(true);
        expect(result.reason).toBe('transient');
    });
});

describe('quota exhaustion is not retried', () => {
    it('makes exactly one attempt per model on a quota-exhausted 429', async () => {
        // Regression: retrying a spent quota burns requests that can never succeed.
        const attempts = failEverywhereWith(httpError(429, QUOTA_429));
        const chain = getModelChain();

        const result = await validateWithFakeTimers();

        expect(attempts).toHaveLength(chain.length);
        for (const model of chain) {
            expect(attempts.filter((m) => m === model)).toHaveLength(1);
        }
        expect(result.valid).toBe(false);
        // The key itself is fine - only the quota is spent - so callers must not
        // tell the user their key is invalid.
        expect(result.reason).not.toBe('auth');
    });

    it('distinguishes a spent quota from a momentary rate limit', async () => {
        const quota = failEverywhereWith(httpError(429, QUOTA_429));
        await validateWithFakeTimers();
        const quotaAttempts = quota.length;

        const rateLimited = failEverywhereWith(httpError(429, RATE_LIMIT_429));
        await validateWithFakeTimers();

        expect(rateLimited.length).toBeGreaterThan(quotaAttempts);
    });
});

describe('validateApiKey success paths', () => {
    it('accepts a key as soon as one model answers', async () => {
        const attempts: string[] = [];
        sdk.generateContent = (req: unknown) => {
            attempts.push((req as { model: string }).model);
            return Promise.resolve({ text: 'ok' });
        };

        const result = await validateWithFakeTimers();

        expect(result.valid).toBe(true);
        expect(result.transient).toBe(false);
        expect(attempts).toEqual([getModelChain()[0]]);
    });

    it('walks the chain past a busy model instead of rejecting the key', async () => {
        const chain = getModelChain();
        expect(chain.length).toBeGreaterThanOrEqual(3);
        const attempts: string[] = [];

        sdk.generateContent = (req: unknown) => {
            const model = (req as { model: string }).model;
            attempts.push(model);
            if (chain.indexOf(model) < 2) {
                return Promise.reject(httpError(503, OVERLOADED_503));
            }
            return Promise.resolve({ text: 'ok' });
        };

        const result = await validateWithFakeTimers();

        expect(result.valid).toBe(true);
        expect(attempts).toEqual([
            chain[0],
            chain[0],
            chain[0],
            chain[1],
            chain[1],
            chain[1],
            chain[2],
        ]);
    });

    it('accepts a completed response even when its text is empty', async () => {
        // A thinking model can return thought parts only. The HTTP call
        // completing is the proof; an empty body is not a bad key.
        sdk.generateContent = () =>
            Promise.resolve({ candidates: [{ content: { parts: [{ thought: true }] } }] });

        const result = await validateWithFakeTimers();

        expect(result.valid).toBe(true);
    });
});