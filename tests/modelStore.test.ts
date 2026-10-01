import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    GEMINI_MODELS,
    MODEL_CHAIN,
    getModelChain,
    getSelectedModel,
    hydrateModelSelection,
    setSelectedModel,
} from '../services/modelStore';
import type { CompatibleModel, ModelTier } from '../types';
import {
    MemoryStorage,
    installLocalStorage,
    uninstallLocalStorage,
} from './helpers/localStorage';

/**
 * `orderCandidates` is module-private, so it is exercised through the public
 * surface (`setSelectedModel` -> `getModelChain`). The chain is what every
 * grounded/JSON call actually walks, so its shape is the contract.
 *
 * moduleStore holds its state in module-level variables, so every test resets it
 * explicitly; nothing here relies on test ordering.
 */

const STORAGE_KEY = 'laptopilot.selectedModel';

/** Mirrors TIER_RANK in services/modelStore.ts. Lower rank = more expensive. */
const TIER_RANK: Record<ModelTier, number> = {
    pro: 0,
    flash: 1,
    'flash-lite': 2,
    standard: 3,
};

/** Mirrors classify() in services/modelStore.ts. */
function rankOf(id: string): number {
    if (/flash-lite/i.test(id)) return TIER_RANK['flash-lite'];
    if (/flash/i.test(id)) return TIER_RANK.flash;
    if (/-pro/i.test(id)) return TIER_RANK.pro;
    return TIER_RANK.standard;
}

/** Mirrors MAX_CHAIN_LENGTH in services/modelStore.ts. */
const MAX_CHAIN_LENGTH = 4;

function model(id: string, tier: ModelTier, version: number): CompatibleModel {
    return { id, displayName: id, tier, version };
}

/**
 * A catalogue shaped like a real `models.list` result for a free-tier key:
 * three Flash models plus a Pro that a cheaper selection must not climb to.
 */
const CATALOGUE: CompatibleModel[] = [
    model('gemini-3.8-flash', 'flash', 3.8),
    model('gemini-3.7-flash', 'flash', 3.7),
    model('gemini-3.1-flash-lite', 'flash-lite', 3.1),
    model('gemini-2.5-flash-lite', 'flash-lite', 2.5),
    model('gemini-3.0-pro', 'pro', 3.0),
];

/**
 * Four cheap models. `MAX_CHAIN_LENGTH` is 4, so a chain built from these fills
 * completely, which is what lets the ordering assertions below be exact.
 */
const LITE_CATALOGUE: CompatibleModel[] = [
    model('gemini-3.1-flash-lite', 'flash-lite', 3.1),
    model('gemini-3.0-flash-lite', 'flash-lite', 3.0),
    model('gemini-2.5-flash-lite', 'flash-lite', 2.5),
    model('gemini-2.0-flash-lite', 'flash-lite', 2.0),
];

/** Never empty, never duplicated, always led by the user's pick. */
function expectSoundChain(chain: string[], selected: string): void {
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0]).toBe(selected);
    expect(new Set(chain).size).toBe(chain.length);
}

/** A fallback must never cost more than the model the user chose. */
function expectNoTierEscalation(chain: string[], selected: string): void {
    const selectedRank = rankOf(selected);
    for (const id of chain) {
        expect(rankOf(id), `${id} is a pricier tier than ${selected}`).toBeGreaterThanOrEqual(
            selectedRank,
        );
    }
}

/** Every entry must be an id this key actually reported as usable. */
function expectAllVerified(chain: string[], available: CompatibleModel[]): void {
    const verified = new Set(available.map((m) => m.id));
    for (const id of chain) {
        expect(verified.has(id), `${id} was never verified for this key`).toBe(true);
    }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = installLocalStorage();
    // Reset module-level state to the shipped default.
    setSelectedModel(MODEL_CHAIN[0]);
});

afterEach(() => {
    uninstallLocalStorage();
});

describe('setSelectedModel / getModelChain', () => {
    it('records the selection and puts it at the head of the chain', () => {
        setSelectedModel('gemini-3.1-flash-lite', CATALOGUE);

        expect(getSelectedModel()).toBe('gemini-3.1-flash-lite');
        expectSoundChain(getModelChain(), 'gemini-3.1-flash-lite');
    });

    it('orders candidates by tier first, then newest version within a tier', () => {
        // Pro is the cheapest rank, so every catalogue entry is a legal fallback.
        setSelectedModel('gemini-3.0-pro', CATALOGUE);

        expect(getModelChain()).toEqual([
            'gemini-3.0-pro',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.1-flash-lite',
        ]);
    });

    it('orders same-tier candidates newest-version-first', () => {
        setSelectedModel('gemini-3.1-flash-lite', LITE_CATALOGUE);

        expect(getModelChain()).toEqual([
            'gemini-3.1-flash-lite',
            'gemini-3.0-flash-lite',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash-lite',
        ]);
    });

    it('never escalates to a pricier tier than the one the user selected', () => {
        // A catalogue that also offers Flash and Pro: neither may be reached
        // from a Flash Lite selection.
        const catalogue = [
            ...LITE_CATALOGUE,
            model('gemini-3.8-flash', 'flash', 3.8),
            model('gemini-3.0-pro', 'pro', 3.0),
        ];

        setSelectedModel('gemini-3.1-flash-lite', catalogue);
        const cheapChain = getModelChain();

        expectNoTierEscalation(cheapChain, 'gemini-3.1-flash-lite');
        expect(cheapChain).not.toContain('gemini-3.8-flash');
        expect(cheapChain).not.toContain('gemini-3.0-pro');

        // A Pro selection may drop down to cheaper tiers, just not up.
        setSelectedModel('gemini-3.0-pro', catalogue);
        expectNoTierEscalation(getModelChain(), 'gemini-3.0-pro');
        expect(getModelChain()).toContain('gemini-3.8-flash');
    });

    it('uses only ids the key reported as usable when a catalogue is supplied', () => {
        setSelectedModel('gemini-3.0-pro', CATALOGUE);
        expectAllVerified(getModelChain(), CATALOGUE);
    });

    it('does not pad the chain with unverified ids when a catalogue is supplied', () => {
        // Regression: a thin catalogue used to be padded with the MODEL_CHAIN
        // literals. Every injected id is a guaranteed 404 that burns a round
        // trip and halves the effective depth of the chain the key can reach.
        const thin = [model('gemini-3.8-flash', 'flash', 3.8)];
        setSelectedModel('gemini-3.8-flash', thin);

        expect(getModelChain()).toEqual(['gemini-3.8-flash']);
        expectAllVerified(getModelChain(), thin);
    });

    it('does not escalate past the selected tier when the catalogue is thin', () => {
        const thin = [model('gemini-3.1-flash-lite', 'flash-lite', 3.1)];
        setSelectedModel('gemini-3.1-flash-lite', thin);

        expect(getModelChain()).toEqual(['gemini-3.1-flash-lite']);
        expectNoTierEscalation(getModelChain(), 'gemini-3.1-flash-lite');
    });

    it('hands out a copy, so a caller cannot reshape the shared chain', () => {
        setSelectedModel(MODEL_CHAIN[0], CATALOGUE);
        const snapshot = getModelChain();

        snapshot.sort();
        snapshot.push('gemini-injected');

        expect(getModelChain()).not.toContain('gemini-injected');
        expect(getModelChain()[0]).toBe(MODEL_CHAIN[0]);
    });

    it('never repeats the selected id, even when it is also in the catalogue', () => {
        setSelectedModel('gemini-3.8-flash', CATALOGUE);
        const chain = getModelChain();

        expect(chain.filter((id) => id === 'gemini-3.8-flash')).toHaveLength(1);
        expectSoundChain(chain, 'gemini-3.8-flash');
    });

    it('caps the chain so a wide catalogue cannot stall a request', () => {
        const wide = Array.from({ length: 25 }, (_, i) =>
            model(`gemini-3.${i}-flash`, 'flash', 3 + i / 100),
        );
        setSelectedModel('gemini-3.0-flash', wide);

        expect(getModelChain().length).toBe(MAX_CHAIN_LENGTH);
        expect(new Set(getModelChain()).size).toBe(MAX_CHAIN_LENGTH);
    });

    it('produces a usable chain for a model id it has never seen', () => {
        setSelectedModel('gemini-4.0-flash-ultra', CATALOGUE);

        expect(getSelectedModel()).toBe('gemini-4.0-flash-ultra');
        expect(getModelChain()[0]).toBe('gemini-4.0-flash-ultra');
        expect(new Set(getModelChain()).size).toBe(getModelChain().length);
    });

    it('falls back to the built-in literals when no catalogue is supplied', () => {
        setSelectedModel(GEMINI_MODELS.primary, []);

        expect(getModelChain()).toEqual([...MODEL_CHAIN]);
    });

    it('places a custom pick ahead of the built-in literals when no catalogue is supplied', () => {
        setSelectedModel('gemini-3.1-flash-lite', []);

        expect(getModelChain()).toEqual([
            'gemini-3.1-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
        ]);
    });

    it('exposes the chain as an array callers can iterate without crashing', () => {
        expect(Array.isArray(getModelChain())).toBe(true);
        for (const id of getModelChain()) {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        }
    });
});

describe('persistence', () => {
    it('writes the selection so it survives a reload', () => {
        setSelectedModel('gemini-3.1-flash-lite', CATALOGUE);

        expect(storage.getItem(STORAGE_KEY)).toBe('gemini-3.1-flash-lite');
    });

    it('a reload re-applies the persisted pick to the selected id AND the chain', async () => {
        const picked = 'gemini-3.1-flash-lite';
        setSelectedModel(picked, CATALOGUE);

        // Drop every in-memory trace of the choice and re-import the module, so
        // this is a genuine "reload": only localStorage survives.
        vi.resetModules();
        const reloaded = await import('../services/modelStore');

        expect(reloaded.getSelectedModel()).toBe(MODEL_CHAIN[0]);
        expect(reloaded.getModelChain()[0]).toBe(MODEL_CHAIN[0]);

        reloaded.hydrateModelSelection();

        expect(reloaded.getSelectedModel()).toBe(picked);
        // The regression: the chain used to stay on the defaults here, so the
        // user's pick drove chat while every grounded call ignored it.
        expect(reloaded.getModelChain()[0]).toBe(picked);
        expect(reloaded.getModelChain().length).toBeGreaterThan(0);
        expect(new Set(reloaded.getModelChain()).size).toBe(reloaded.getModelChain().length);
    });

    it('keeps the built-in default when nothing is persisted', () => {
        hydrateModelSelection();

        expect(getSelectedModel()).toBe(MODEL_CHAIN[0]);
        expect(getModelChain()).toEqual([...MODEL_CHAIN]);
    });

    it('does not throw when localStorage is unavailable (private browsing)', () => {
        uninstallLocalStorage();

        expect(() => setSelectedModel('gemini-3.8-flash', CATALOGUE)).not.toThrow();
        expect(() => hydrateModelSelection()).not.toThrow();
        expect(getSelectedModel()).toBe('gemini-3.8-flash');
        expect(getModelChain().length).toBeGreaterThan(0);
    });
});

describe('invariants that must hold for every selection', () => {
    const CATALOGUES: Array<[string, CompatibleModel[]]> = [
        ['no catalogue', []],
        ['a one-model catalogue', [model('gemini-3.8-flash', 'flash', 3.8)]],
        ['a full catalogue', CATALOGUE],
        ['a wide catalogue', Array.from({ length: 25 }, (_, i) =>
            model(`gemini-3.${i}-flash`, 'flash', 3 + i / 100),
        )],
    ];

    it.each(CATALOGUES)('never produces an empty chain from %s', (_label, catalogue) => {
        setSelectedModel(MODEL_CHAIN[0], catalogue);

        expect(getModelChain().length).toBeGreaterThan(0);
        expect(getModelChain().length).toBeLessThanOrEqual(MAX_CHAIN_LENGTH);
    });

    it.each(CATALOGUES)('never produces a duplicated chain from %s', (_label, catalogue) => {
        setSelectedModel(MODEL_CHAIN[0], catalogue);

        expect(new Set(getModelChain()).size).toBe(getModelChain().length);
    });

    it.each(CATALOGUES)('always leads with the selected id from %s', (_label, catalogue) => {
        setSelectedModel(MODEL_CHAIN[0], catalogue);

        expect(getModelChain()[0]).toBe(MODEL_CHAIN[0]);
    });
});