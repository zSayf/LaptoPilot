import type { CompatibleModel, ModelTier } from '../types';

/**
 * Single source of truth for which Gemini model the app talks to.
 *
 * Lives in its own module (rather than in geminiService) so geminiService can
 * read the active chain without a circular import back through itself.
 *
 * Selection + chain contract:
 *
 * - `selectedModel` is the user's explicit pick. It is always chain slot 0 and
 *   is what the chat surface talks to.
 * - `chain` is the ordered list of ids a request should try, selected model
 *   first. Callers walk it in order and move on only when a call fails, so a
 *   short chain is cheap but a padded chain is *actively harmful*: an id the key
 *   cannot use is a guaranteed 404 that burns a round trip before failing.
 * - The chain is therefore built from the catalogue the key actually returned
 *   (see `setSelectedModel`). The hard-coded `MODEL_CHAIN` literals are a
 *   fallback for the one case where we have no catalogue at all - they are never
 *   used to pad a chain we do have data for.
 * - The chain is never empty, and is always capped at `MAX_CHAIN_LENGTH`.
 * - `getModelChain()` hands back a defensive copy; callers treat it as read-only
 *   and must not mutate the array they get back.
 */

const STORAGE_KEY = 'laptopilot.selectedModel';

/**
 * Default model + fallback chain. Primary is Gemini 3.8 Flash, our most
 * intelligent Flash model with a 1M context window. The fallbacks are used
 * when the primary hits a quota or rate limit so the user still gets a result.
 */
export const GEMINI_MODELS = {
    /** Best quality - used for chat, search, extraction and feature analysis. */
    primary: 'gemini-3.8-flash',
    /** Ordered fallback chain for quota / rate-limit failures. */
    fallbacks: ['gemini-3.7-flash', 'gemini-3.1-flash-lite'] as const,
} as const;

/** Ordered list of models to try, most capable first. */
export const MODEL_CHAIN: string[] = [GEMINI_MODELS.primary, ...GEMINI_MODELS.fallbacks];

/** Hard cap on fallbacks so a wide model list can't stall a request. */
const MAX_CHAIN_LENGTH = 4;

const TIER_RANK: Record<ModelTier, number> = {
    pro: 0,
    flash: 1,
    'flash-lite': 2,
    standard: 3,
};

let selectedModel: string = GEMINI_MODELS.primary;
let chain: string[] = [...MODEL_CHAIN];

/**
 * Order candidate fallbacks: same tier first, then progressively cheaper tiers,
 * newest version first within each. Already-tried ids are excluded.
 *
 * Note this deliberately never escalates to a *more* expensive tier than the
 * selected one. A fallback exists because the current model failed; reaching for
 * a pricier model would spend more quota for the same problem.
 */
function orderCandidates(
    candidates: CompatibleModel[],
    exclude: Set<string>
): string[] {
    const selectedRank = TIER_RANK[classify(selectedModel)];

    return candidates
        .filter((m) => !exclude.has(m.id))
        .filter((m) => TIER_RANK[m.tier] >= selectedRank)
        .slice()
        .sort(
            (a, b) =>
                TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
                b.version - a.version
        )
        .map((m) => m.id);
}

function classify(id: string): ModelTier {
    if (/flash-lite/i.test(id)) return 'flash-lite';
    if (/flash/i.test(id)) return 'flash';
    if (/-pro/i.test(id)) return 'pro';
    return 'standard';
}

/**
 * Select a model and rebuild the fallback chain from the models this key can
 * actually use. Persisted so the choice survives a reload.
 *
 * `available` is the catalogue for the *current* key. When it is non-empty it is
 * treated as authoritative: the chain is exactly the selected model plus models
 * drawn from it, and nothing else. Backfilling with `MODEL_CHAIN` literals here
 * would inject ids this key has no access to, and each one costs a guaranteed
 * 404 round trip while halving the effective depth of the chain we do have.
 *
 * The literals are only used when `available` is empty - the genuine
 * "couldn't fetch the catalogue" case - so we still degrade to something
 * tryable rather than a chain of length one.
 */
export function setSelectedModel(
    id: string,
    available: CompatibleModel[] = []
): void {
    selectedModel = id;

    const used = new Set<string>([id]);
    const next: string[] = [id, ...orderCandidates(available, used)];

    // Only pad when we have no catalogue to trust. See above.
    if (available.length === 0) {
        for (const fallback of MODEL_CHAIN) {
            if (next.length >= MAX_CHAIN_LENGTH) break;
            if (!next.includes(fallback)) next.push(fallback);
        }
    }

    // Never empty: `id` is always the head, whatever the catalogue looked like.
    chain = next.slice(0, MAX_CHAIN_LENGTH);

    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        // Private browsing / storage disabled - selection just won't persist.
    }
}

/** The model currently in use. */
export function getSelectedModel(): string {
    return selectedModel;
}

/**
 * Ordered chain to try on failure: selected model first, then fallbacks.
 *
 * Returns a copy. The internal array is module state that callers are not
 * allowed to reshape - a sorted or spliced chain would silently change retry
 * behaviour everywhere until the next selection.
 */
export function getModelChain(): string[] {
    return [...chain];
}

/**
 * Re-apply a persisted selection at startup, if one exists.
 *
 * The chain is rebuilt here too, not just `selectedModel`. Otherwise the two
 * disagree after a reload: getSelectedModel() returns the user's pick (used by
 * the chat) while getModelChain() still returns the default chain (used by every
 * grounded/JSON call), so a deliberately chosen model would be silently ignored
 * by the entire search pipeline.
 */
export function hydrateModelSelection(): void {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            selectedModel = saved;
            // No catalogue is available yet at startup; seed the chain from the
            // known-good defaults so the pick is first and actually gets used.
            // loadModels() rebuilds it properly once models.list resolves.
            chain = [saved, ...MODEL_CHAIN.filter((m) => m !== saved)].slice(
                0,
                MAX_CHAIN_LENGTH
            );
        }
    } catch {
        // Ignore storage failures and keep the default model.
    }
}