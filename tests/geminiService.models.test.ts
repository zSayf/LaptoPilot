import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompatibleModel } from '../types';
import { getDefaultCompatibleModels, listCompatibleModels } from '../services/geminiService';
import { MODEL_CHAIN } from '../services/modelStore';

/**
 * `models.list` is stubbed, so nothing leaves the machine. What is under test is
 * the filtering + ranking: offering a model the app cannot actually drive
 * (no Search grounding, no JSON structured output) means the user picks a model
 * that then fails every search.
 */

const NOT_A_REAL_KEY = 'test-key-never-sent-anywhere';

const sdk = vi.hoisted(() => ({
    list: (): Promise<unknown> =>
        Promise.reject(new Error('UNCONFIGURED: the test did not stub models.list')),
}));

vi.mock('@google/genai', () => {
    class GoogleGenAI {
        models = {
            list: () => sdk.list(),
            generateContent: () =>
                Promise.reject(new Error('UNCONFIGURED: generateContent must not be called')),
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

interface RawModel {
    name?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedActions?: string[];
    supportedGenerationMethods?: string[];
}

function stubModelList(models: RawModel[]): void {
    sdk.list = () =>
        Promise.resolve(
            (async function* () {
                for (const model of models) yield model;
            })(),
        );
}

const GENERATE: RawModel = { supportedActions: ['generateContent'] };

function ids(models: CompatibleModel[]): string[] {
    return models.map((m) => m.id);
}

beforeEach(() => {
    sdk.list = () => Promise.reject(new Error('UNCONFIGURED: the test did not stub models.list'));
});

describe('listCompatibleModels filtering', () => {
    it('keeps only gemini text models that can run generateContent', async () => {
        stubModelList([
            { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', ...GENERATE },
            { name: 'models/text-embedding-004', ...GENERATE },
            { name: 'models/imagen-3.0-generate-001', ...GENERATE },
            { name: 'models/gemini-3.1-flash-image', ...GENERATE },
            { name: 'models/gemini-2.5-flash-preview-tts', ...GENERATE },
            { name: 'models/gemma-3-27b-it', ...GENERATE },
            { name: 'models/gemini-3.5-transcribe', ...GENERATE },
            { name: 'models/gemini-omni-2', ...GENERATE },
            { name: 'models/palm-2', ...GENERATE },
        ]);

        const models = await listCompatibleModels(NOT_A_REAL_KEY);

        expect(ids(models)).toEqual(['gemini-3.8-flash']);
    });

    it('strips the models/ prefix from the returned id', async () => {
        stubModelList([{ name: 'models/gemini-3.8-flash', ...GENERATE }]);

        const [model] = await listCompatibleModels(NOT_A_REAL_KEY);

        expect(model.id).toBe('gemini-3.8-flash');
        expect(model.id.startsWith('models/')).toBe(false);
    });

    it('skips entries with no name instead of emitting an empty id', async () => {
        stubModelList([{ displayName: 'Nameless', ...GENERATE }]);

        expect(await listCompatibleModels(NOT_A_REAL_KEY)).toEqual([]);
    });

    it('drops a model whose supported actions exclude generateContent', async () => {
        stubModelList([
            { name: 'models/gemini-3.8-flash', supportedActions: ['countTokens'] },
            { name: 'models/gemini-3.7-flash', supportedActions: ['generateContent'] },
        ]);

        expect(ids(await listCompatibleModels(NOT_A_REAL_KEY))).toEqual(['gemini-3.7-flash']);
    });

    it('accepts supportedGenerationMethods as well as supportedActions', async () => {
        stubModelList([
            { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        ]);

        expect(ids(await listCompatibleModels(NOT_A_REAL_KEY))).toEqual(['gemini-3.8-flash']);
    });

    it('treats an absent capability field as unknown, not as unsupported', async () => {
        stubModelList([{ name: 'models/gemini-3.8-flash' }]);

        expect(ids(await listCompatibleModels(NOT_A_REAL_KEY))).toEqual(['gemini-3.8-flash']);
    });

    it('returns an empty list rather than throwing when the key can see nothing', async () => {
        stubModelList([]);

        expect(await listCompatibleModels(NOT_A_REAL_KEY)).toEqual([]);
    });
});

describe('listCompatibleModels ranking', () => {
    it('sorts best tier first, then newest version within a tier', async () => {
        stubModelList([
            { name: 'models/gemini-3.8-flash', ...GENERATE },
            { name: 'models/gemini-3.7-flash', ...GENERATE },
            { name: 'models/gemini-3.1-flash-lite', ...GENERATE },
            { name: 'models/gemini-3.0-pro', ...GENERATE },
            { name: 'models/gemini-2.5-pro', ...GENERATE },
            { name: 'models/gemini-1.5-pro', ...GENERATE },
        ]);

        expect(ids(await listCompatibleModels(NOT_A_REAL_KEY))).toEqual([
            'gemini-3.0-pro',
            'gemini-2.5-pro',
            'gemini-1.5-pro',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.1-flash-lite',
        ]);
    });

    it('classifies tiers from the id', async () => {
        stubModelList([
            { name: 'models/gemini-3.1-flash-lite', ...GENERATE },
            { name: 'models/gemini-3.8-flash', ...GENERATE },
            { name: 'models/gemini-3.0-pro', ...GENERATE },
            { name: 'models/gemini-exp-1206', ...GENERATE },
        ]);

        const byId = new Map(
            (await listCompatibleModels(NOT_A_REAL_KEY)).map((m) => [m.id, m] as const),
        );

        expect(byId.get('gemini-3.1-flash-lite')?.tier).toBe('flash-lite');
        expect(byId.get('gemini-3.8-flash')?.tier).toBe('flash');
        expect(byId.get('gemini-3.0-pro')?.tier).toBe('pro');
        // Anything that is neither flash nor pro falls back to standard.
        expect(byId.get('gemini-exp-1206')?.tier).toBe('standard');
    });

    it('parses the version out of the id, defaulting to 0', async () => {
        stubModelList([
            { name: 'models/gemini-3.8-flash', ...GENERATE },
            { name: 'models/gemini-exp-1206', ...GENERATE },
        ]);

        const byId = new Map(
            (await listCompatibleModels(NOT_A_REAL_KEY)).map((m) => [m.id, m] as const),
        );

        expect(byId.get('gemini-3.8-flash')?.version).toBe(3.8);
        // "gemini-exp-1206" has no major.minor, so it must not become 1206 and
        // jump ahead of every real model.
        expect(byId.get('gemini-exp-1206')?.version).toBe(0);
    });

    it('carries the display name and token limits through', async () => {
        stubModelList([
            {
                name: 'models/gemini-3.8-flash',
                displayName: 'Gemini 3.8 Flash',
                inputTokenLimit: 1_048_576,
                outputTokenLimit: 65_536,
                ...GENERATE,
            },
        ]);

        const [model] = await listCompatibleModels(NOT_A_REAL_KEY);

        expect(model.displayName).toBe('Gemini 3.8 Flash');
        expect(model.inputTokenLimit).toBe(1_048_576);
        expect(model.outputTokenLimit).toBe(65_536);
    });

    it('falls back to the id when the API omits a display name', async () => {
        stubModelList([{ name: 'models/gemini-3.8-flash', ...GENERATE }]);

        const [model] = await listCompatibleModels(NOT_A_REAL_KEY);

        expect(model.displayName).toBe('gemini-3.8-flash');
    });
});

describe('getDefaultCompatibleModels', () => {
    it('shapes the built-in chain as a model list', () => {
        const defaults = getDefaultCompatibleModels();

        expect(ids(defaults)).toEqual([...MODEL_CHAIN]);
    });

    it('gives every entry a tier, a version and a display name', () => {
        for (const model of getDefaultCompatibleModels()) {
            expect(model.displayName.length).toBeGreaterThan(0);
            expect(Number.isFinite(model.version)).toBe(true);
            expect(['pro', 'flash', 'flash-lite', 'standard']).toContain(model.tier);
        }
    });

    it('offers the Flash Lite tail as a cheaper tier than the Flash head', () => {
        const defaults = getDefaultCompatibleModels();
        const head = defaults[0];
        const tail = defaults[defaults.length - 1];

        expect(head.tier).toBe('flash');
        expect(tail.tier).toBe('flash-lite');
    });

    it('is non-empty so the picker can never render nothing', () => {
        expect(getDefaultCompatibleModels().length).toBeGreaterThan(0);
    });
});