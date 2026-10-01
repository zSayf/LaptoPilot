import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Laptop, RecommendationArgs } from '../types';
import { getLaptopRecommendations } from '../services/geminiService';

/**
 * The currency check (`isValidCurrencyCode`) is module-private, so it is pinned
 * through the one public function that applies it: `getLaptopRecommendations`
 * repairs every extracted laptop's currency before returning it.
 *
 * The reason it matters: that string goes straight into
 * `new Intl.NumberFormat({ currency })` at render time, and the constructor
 * throws RangeError for anything that is not exactly three ASCII letters. A
 * RangeError in render unmounts the whole React tree, so the user loses the
 * results AND the follow-up chat over one malformed field.
 *
 * No network: the Gemini SDK is stubbed, so both `generateContent` calls are
 * answered from fixtures below.
 */

const NOT_A_REAL_KEY = 'test-key-never-sent-anywhere';

const sdk = vi.hoisted(() => ({
    generateContent: (_req: unknown): Promise<unknown> =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub generateContent')),
}));

vi.mock('@google/genai', () => {
    class GoogleGenAI {
        models = {
            generateContent: (req: unknown) => sdk.generateContent(req),
        };
    }
    return {
        GoogleGenAI,
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

const args = (currency: string): RecommendationArgs => ({
    country: 'United States',
    budget: 1500,
    currency,
    primaryUse: 'software development',
    secondaryUse: 'light gaming',
    specificNeeds: 'at least 16GB of RAM',
});

/** A complete, fully-specified laptop: passes the strict validator untouched. */
function laptop(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        modelName: 'Contoso Pro 14',
        price: 1899,
        currency: 'USD',
        retailer: 'Contoso',
        retailerUrl: 'https://www.contoso.test/pro-14',
        specs: {
            cpu: 'Intel Core i7-13700H',
            gpu: 'NVIDIA GeForce RTX 4060',
            ram: '16GB DDR5',
            storage: '1TB NVMe SSD',
            display: '14.0 inch 1920x1200',
            operatingSystem: 'Windows 11 Pro',
            webcam: '1080p',
            keyboard: 'backlit',
            ports: '2x USB-C, 1x USB-A, HDMI 2.1',
        },
        justification: 'Meets the RAM and GPU requirements.',
        ...overrides,
    };
}

/**
 * Answer the two calls `getLaptopRecommendations` makes: the grounded search,
 * then the JSON extraction.
 */
function stubExtraction(payloads: unknown[]): void {
    let served = 0;
    sdk.generateContent = (req: unknown) => {
        const config = (req as { config?: Record<string, unknown> }).config ?? {};

        if (config.tools) {
            return Promise.resolve({ text: 'grounded research notes', candidates: [] });
        }
        if (config.responseMimeType === 'application/json') {
            const payload = payloads[Math.min(served, payloads.length - 1)];
            served += 1;
            return Promise.resolve({ text: JSON.stringify(payload) });
        }
        throw new Error(`unexpected generateContent call: ${JSON.stringify(config)}`);
    };
}

async function recommendationsFor(currencies: unknown[], requested = 'USD'): Promise<Laptop[]> {
    stubExtraction([currencies.map((currency) => laptop({ currency }))]);
    const { laptops } = await getLaptopRecommendations(args(requested), NOT_A_REAL_KEY);
    return laptops;
}

/** Values `Intl.NumberFormat` accepts as a currency code. */
const VALID = ['usd', 'USD', 'cAd', 'EgP', 'jpy'];

/** Everything else, including the shapes an LLM realistically produces. */
const INVALID: Array<[string, unknown]> = [
    ['empty string', ''],
    ['whitespace only', '   '],
    ['full currency name', 'US Dollars'],
    ['a bare symbol', '$'],
    ['symbol and text', 'US$'],
    ['another symbol', '\u20ac'],
    ['two-letter code', 'US'],
    ['four-letter code', 'USDD'],
    ['code with inner space', 'US D'],
    ['code with a trailing space', 'USD '],
    ['lowercase full name', 'us dollars'],
    ['"null"', 'null'],
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { currency: 'USD' }],
];

beforeEach(() => {
    sdk.generateContent = () =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub generateContent'));
});

describe('a usable currency code from the model is kept', () => {
    it.each(VALID)('keeps %s and upper-cases it', async (code) => {
        // Requested currency differs so an accidental fall-through is visible.
        const [result] = await recommendationsFor([code], 'EUR');

        expect(result.currency).toBe(code.toUpperCase());
    });

    it('keeps the code the model returned rather than the requested one', async () => {
        const [result] = await recommendationsFor(['cad'], 'EUR');

        expect(result.currency).toBe('CAD');
    });
});

describe('an unusable currency from the model is replaced with the requested one', () => {
    it.each(INVALID)('replaces %s', async (_label, bad) => {
        const [result] = await recommendationsFor([bad], 'EUR');

        expect(result.currency).toBe('EUR');
    });

    it('repairs every laptop in the batch, not just the first', async () => {
        const results = await recommendationsFor(['$', '', 'US Dollars', 'usd'], 'GBP');

        expect(results.map((l) => l.currency)).toEqual(['GBP', 'GBP', 'GBP', 'USD']);
    });

    it('leaves the rest of the laptop intact while repairing the currency', async () => {
        const [result] = await recommendationsFor(['US Dollars'], 'EUR');

        expect(result).toMatchObject({
            modelName: 'Contoso Pro 14',
            price: 1899,
            retailer: 'Contoso',
            retailerUrl: 'https://www.contoso.test/pro-14',
            justification: 'Meets the RAM and GPU requirements.',
        });
        expect(result.specs.cpu).toBe('Intel Core i7-13700H');
    });

    it('never returns a currency that would throw in Intl.NumberFormat', async () => {
        // The actual crash guard: every value above is a RangeError in render.
        const results = await recommendationsFor(
            INVALID.map(([, value]) => value),
            'EUR',
        );

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
            expect(result.currency).toBe('EUR');
            expect(() =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency }),
            ).not.toThrow();
        }
    });

    it('never returns an empty or missing currency', async () => {
        const results = await recommendationsFor(['', '   ', undefined, null], 'EUR');

        for (const result of results) {
            expect(typeof result.currency).toBe('string');
            expect(result.currency.length).toBeGreaterThan(0);
        }
    });

    it('keeps a valid code renderable too', async () => {
        const results = await recommendationsFor(VALID, 'EUR');

        for (const result of results) {
            expect(() =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency }),
            ).not.toThrow();
        }
    });
});