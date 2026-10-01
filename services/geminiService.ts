import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import type { Laptop, GroundingSource, RecommendationArgs, CompatibleModel, ModelTier } from '../types';
import { getModelChain, getSelectedModel, MODEL_CHAIN } from './modelStore';

// Re-exported so existing importers can keep pulling model types/constants from
// this module instead of reaching into modelStore / types.
export type { CompatibleModel, ModelTier };
export { GEMINI_MODELS, MODEL_CHAIN, getSelectedModel, setSelectedModel } from './modelStore';

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

/** Rank used to order tiers best-first. */
const TIER_RANK: Record<ModelTier, number> = {
    pro: 0,
    flash: 1,
    'flash-lite': 2,
    standard: 3,
};

/**
 * Model families that cannot run this app, even though they support
 * generateContent. This app needs two capabilities: Google Search grounding
 * (for live pricing/retailer lookups) and JSON-schema structured output (for
 * the extraction + feature-analysis steps). None of these families offer both,
 * so we drop them up front instead of letting the user pick a broken model.
 */
const UNSUPPORTED_PATTERNS: RegExp[] = [
    /embedding/i,       // text-embedding-*       -> vectors only
    /imagen/i,          // imagen-*               -> image generation
    /-image$/i,         // gemini-3.1-flash-image -> image generation (Nano Banana)
    /image-preview/i,
    /tts/i,             // *-tts                  -> speech synthesis
    /live/i,            // *-live                 -> realtime audio/video
    /native-audio/i,
    /audio-dialog/i,
    /veo/i,             // veo-*                  -> video generation
    /music/i,
    /robotics/i,
    /computer-use/i,
    /gemma/i,           // no Google Search grounding on the Gemini API
    /learnlm/i,
    // Verified against a live models.list: these advertise generateContent but
    // are not general-purpose text models, so grounding/extraction would fail.
    /transcribe/i,      // gemini-3.5-transcribe   -> audio transcription only
    /omni/i,            // gemini-omni-*           -> modality-specific, no search
];

function classifyTier(id: string): ModelTier {
    if (/flash-lite/i.test(id)) return 'flash-lite';
    if (/flash/i.test(id)) return 'flash';
    if (/-pro/i.test(id)) return 'pro';
    return 'standard';
}

/** "gemini-3.8-flash" -> 3.8, so newest models sort first. */
function parseVersion(id: string): number {
    const m = id.match(/(\d+)\.(\d+)/);
    return m ? parseFloat(`${m[1]}.${m[2]}`) : 0;
}

/**
 * Fetch every model the provided key can use, filtered down to the ones that
 * can actually power this app. Scoped to the key, so a free-tier key returns a
 * smaller list than a billed one.
 */
export async function listCompatibleModels(apiKey: string): Promise<CompatibleModel[]> {
    const ai = getAiInstance(apiKey);
    const pager = await ai.models.list();

    const out: CompatibleModel[] = [];
    for await (const m of pager) {
        if (!m.name) continue;

        // API returns "models/gemini-3.8-flash"; we want the bare id.
        const id = m.name.replace(/^models\//, '');

        if (!id.startsWith('gemini-')) continue;
        if (UNSUPPORTED_PATTERNS.some((re) => re.test(id))) continue;

        // The capability field is named `supportedActions` in the SDK types, but
        // the live API has also returned `supportedGenerationMethods`. Accept
        // either, and treat an absent field as "unknown" rather than "no".
        const caps = (m as any).supportedActions ?? (m as any).supportedGenerationMethods;
        if (Array.isArray(caps) && !caps.includes('generateContent')) continue;

        out.push({
            id,
            displayName: m.displayName || id,
            description: m.description,
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit,
            tier: classifyTier(id),
            version: parseVersion(id),
        });
    }

    return out.sort((a, b) =>
        TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.version - a.version
    );
}

/**
 * The built-in default chain, shaped like a model list.
 *
 * Used as a fallback when models.list is unavailable (rate limited, offline),
 * so the picker still offers something instead of rendering empty.
 */
export function getDefaultCompatibleModels(): CompatibleModel[] {
    return MODEL_CHAIN.map((id) => ({
        id,
        displayName: id,
        tier: classifyTier(id),
        version: parseVersion(id),
    }));
}


export const findLaptopRecommendationsTool: FunctionDeclaration = {
    name: 'findLaptopRecommendations',
    description: 'Finds the top 5 laptop recommendations based on user criteria.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            country: {
                type: Type.STRING,
                description: 'The country the user is in, e.g., "United States".'
            },
            budget: {
                type: Type.NUMBER,
                description: 'The user\'s budget.'
            },
            currency: {
                type: Type.STRING,
                description: 'The currency for the user\'s budget, e.g., "USD", "CAD", "EGP".'
            },
            primaryUse: {
                type: Type.STRING,
                description: 'The primary use case for the laptop, e.g., "Gaming", "Student", "Software Development".'
            },
            secondaryUse: {
                type: Type.STRING,
                description: 'A secondary use case for the laptop.'
            },
            specificNeeds: {
                type: Type.STRING,
                description: 'A summary of other specific needs like desired screen size, battery life, specific games or software to be used.'
            },
        },
        required: ['country', 'budget', 'currency', 'primaryUse', 'specificNeeds'],
    },
};

const laptopSpecSchema = {
    type: Type.OBJECT,
    properties: {
        cpu: { type: Type.STRING, description: "Processor model, e.g., 'Intel Core i7-13650HX'" },
        gpu: { type: Type.STRING, description: "Graphics card model, e.g., 'NVIDIA GeForce RTX 4060'" },
        ram: { type: Type.STRING, description: "Amount of RAM, e.g., '16GB DDR5'" },
        storage: { type: Type.STRING, description: "Storage capacity and type, e.g., '1TB NVMe SSD'" },
        display: { type: Type.STRING, description: "Display size and resolution, e.g., '16-inch QHD+ 165Hz'" },
        operatingSystem: { type: Type.STRING, description: "Operating system, e.g., 'Windows 11 Home'" },
        webcam: { type: Type.STRING, description: "Webcam quality, e.g., '1080p FHD IR Webcam'" },
        keyboard: { type: Type.STRING, description: "Keyboard features, e.g., 'Backlit Chiclet Keyboard RGB'" },
        ports: { type: Type.STRING, description: "A summary of available ports, e.g., '1x Thunderbolt 4, 2x USB-A 3.2, 1x HDMI 2.1'" },
    },
    required: ['cpu', 'gpu', 'ram', 'storage', 'display', 'operatingSystem', 'webcam', 'keyboard', 'ports'],
};

const laptopSchema = {
    type: Type.OBJECT,
    properties: {
        modelName: { type: Type.STRING, description: "The specific model name of the laptop." },
        price: { type: Type.NUMBER, description: "The price of the laptop as a number." },
        currency: { type: Type.STRING, description: "The currency code for the price, e.g., 'USD', 'CAD', 'EGP'." },
        retailer: { type: Type.STRING, description: "The name of the retailer selling the laptop." },
        retailerUrl: { type: Type.STRING, description: "The direct, working URL to the product page. If not found, this MUST be an empty string." },
        specs: laptopSpecSchema,
        justification: { type: Type.STRING, description: "A clear explanation of why this specific laptop's specs address the user's needs." },
    },
    required: ['modelName', 'price', 'currency', 'retailer', 'retailerUrl', 'specs', 'justification'],
};

// Function to create AI instance with provided API key
export function getAiInstance(apiKey: string) {
    return new GoogleGenAI({ apiKey });
}

/**
 * Pause between two entries of the fallback chain.
 *
 * Every entry is a real request, and one search fires several chains back to
 * back (search, extraction, feature analysis, then up to IMAGE_BUDGET_PER_SEARCH
 * image lookups). Walking the chain with no gap at all turns that into a burst
 * of ~60 requests in a few seconds, which on the free tier's 15 requests/minute
 * is a guaranteed 429 - the fallback would then fail for the same reason the
 * primary did. The jitter keeps concurrent clients from falling through in
 * lockstep and re-colliding on the same window.
 */
const CHAIN_STEP_DELAY_MS = 1200;
const CHAIN_STEP_JITTER_MS = 400;

// New function to handle model fallback strategy
async function callWithFallback<T>(
    apiKey: string,
    operation: (model: string) => Promise<T>
): Promise<T> {
    // Read the chain live so a user-selected model takes effect immediately,
    // falling back to the built-in chain if the store has not been seeded.
    const models = getModelChain();
    let lastError: any;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            return await runWithRetry(model, operation);
        } catch (error: any) {
            console.warn(`Model ${model} failed:`, error.message);
            lastError = error;

            // Deliberately NOT breaking here on quota exhaustion. The free-tier
            // daily cap is per-project *per-model*
            // (GenerateRequestsPerDayPerProjectPerModel), so a different model
            // may still have budget left. runWithRetry already prevents us
            // re-hammering the same model, so walking the chain costs one
            // request each rather than a full retry storm.

            // Space the attempts out, but only when the failure was itself
            // transient - that is exactly the case where pacing can help. A 400
            // or 404 will not improve by waiting, and sleeping through those
            // would only delay surfacing a real error to the user. 429 is
            // included on purpose: isQuotaExhausted cannot tell a blown daily cap
            // from a blown per-minute window, and the pause is what rescues the
            // second case.
            if (i < models.length - 1 && isTransientError(error)) {
                const pause = CHAIN_STEP_DELAY_MS + Math.random() * CHAIN_STEP_JITTER_MS;
                console.warn(`Pausing ${Math.round(pause)}ms before trying the next model...`);
                await sleep(pause);
            }
        }
    }
    
    // If all models failed, throw the last error
    throw lastError;
}

/** Why a key check failed, so the UI can say something truthful about it. */
export type ApiKeyCheckReason = 'auth' | 'model' | 'transient';

export interface ApiKeyCheck {
    valid: boolean;
    /**
     * True only when the failure was genuinely temporary - rate limit, model
     * overloaded (503 UNAVAILABLE), or a network blip. False means either the
     * key itself is bad or the request was permanently unacceptable (a 404 for
     * a model this key cannot reach, a 400 for a malformed request); neither
     * improves by retrying. Callers must not tell a user their key is invalid,
     * and must not tell them "Google's servers are busy", when this is true.
     */
    transient: boolean;
    /**
     * Distinguishes a bad key ('auth'), a key that cannot reach the model
     * ('model') and a temporary outage ('transient'). `transient` stays the
     * backwards-compatible flag; this exists so the UI can stop telling a user
     * to replace a perfectly good key because no model in the chain was
     * available to it.
     */
    reason?: ApiKeyCheckReason;
    error?: string;
}

/** HTTP statuses / error codes that mean "the key is wrong", not "try later". */
const AUTH_ERROR_PATTERN =
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|invalid api key/i;

function isAuthError(error: any): boolean {
    const status = error?.status;

    // 401/403 are always credential problems.
    if (status === 401 || status === 403) return true;

    const msg = String(error?.message ?? '');

    // A bare 400 is usually a malformed request (e.g. a config field this model
    // does not support), NOT a bad key. Only treat it as auth when the message
    // actually talks about the key - otherwise a valid key gets rejected.
    if (status === 400) return /api[-_ ]?key/i.test(msg);

    return AUTH_ERROR_PATTERN.test(msg);
}

/**
 * Currency codes are fed straight into `new Intl.NumberFormat({ currency })`
 * during render. That constructor throws RangeError on anything that isn't
 * exactly three ASCII letters, which would unmount the whole React tree - the
 * user would lose the results AND the follow-up chat, not just one card.
 * The extraction prompt explicitly invites the model to leave fields empty, so
 * "currency": "" is an expected outcome, not a hypothetical.
 */
function isValidCurrencyCode(value: unknown): boolean {
    return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value);
}

/** Overload / rate-limit / gateway statuses that are worth retrying. */
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function isTransientError(error: any): boolean {
    // No HTTP status at all means the request never reached Google - offline,
    // DNS failure, captive portal. That is the single most common transient
    // error and it must be retried, not written off as permanent.
    if (error?.status === undefined) return true;
    return TRANSIENT_STATUSES.has(error?.status);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with jitter, per Google's documented retry guidance:
 * https://ai.google.dev/gemini-api/docs/troubleshooting#retry_strategy
 * (~1s, 2s, 4s, 8s, randomised so concurrent clients don't retry in lockstep).
 * A 429 starts from a longer base because it signals quota pressure rather
 * than a momentary blip.
 */
function backoffDelayMs(attempt: number, status?: number): number {
    const base = status === 429 ? 2000 : 1000;
    const exponential = base * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponential + jitter, 30_000);
}

/**
 * True when a 429 means the account's quota is spent, not that we were briefly
 * rate limited. Google's message is explicit: "You exceeded your current
 * quota, please check your plan and billing details."
 *
 * This distinction matters a lot: a quota-exhausted key is a VALID key, and no
 * amount of retrying or model-switching will help until the quota resets.
 *
 * **Known limit of the heuristic:** the API reports a blown per-minute
 * (requests-per-project) window with the same 429 / RESOURCE_EXHAUSTED status
 * as a blown daily cap, and its "quota exceeded" wording can satisfy this
 * pattern too. So a request burst can be misread as "the quota is gone" and
 * latch off every remaining image lookup, even though the user still has a
 * normal short window to retry in. That is a deliberate trade: erring toward
 * "transient" only costs one wasted search, while ignoring a genuinely spent
 * daily cap burns the user's last remaining requests. Do not loosen the
 * pattern without re-checking the two callers that latch state on it.
 */
export function isQuotaExhausted(error: any): boolean {
    if (error?.status !== 429) return false;
    return /exceeded your current quota|quota exceeded|RESOURCE_EXHAUSTED/i.test(
        String(error?.message ?? '')
    );
}

/**
 * Run `op` against a single model, retrying transient failures with exponential
 * backoff. Only 429/408/5xx and network errors are retried - never 4xx client
 * errors, which indicate bad syntax or a bad key.
 *
 * Quota exhaustion is excluded: retrying it just burns requests that can never
 * succeed.
 */
async function runWithRetry<T>(
    model: string,
    op: (model: string) => Promise<T>,
    retries = 2
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await op(model);
        } catch (error: any) {
            lastError = error;

            const retryable =
                attempt < retries &&
                !isAuthError(error) &&
                !isQuotaExhausted(error) &&
                isTransientError(error);
            if (!retryable) break;

            const delay = backoffDelayMs(attempt, error?.status);
            console.warn(
                `${model} hit ${error?.status ?? 'a network error'}, retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Validate the API key by making a real request.
 *
 * Walks the fallback chain, because a single busy model must not be reported as
 * a bad key: Gemini 3.x answers 503 UNAVAILABLE ("high demand") fairly often,
 * and the next model in the chain usually succeeds.
 *
 * Note that a completed HTTP response is itself the proof. The body is not
 * inspected: a thinking model can reply with thought parts only, leaving
 * `response.text` empty, and treating that as a bad key would lock out a
 * perfectly good one.
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyCheck> {
    const ai = getAiInstance(apiKey);
    let lastError: any;
    let sawTransient = false;
    let sawPermanent = false;

    for (const model of getModelChain()) {
        try {
            await runWithRetry(model, (m) =>
                ai.models.generateContent({
                    model: m,
                    contents: 'Reply with the single word: ok',
                })
            );
            return { valid: true, transient: false };
        } catch (error: any) {
            console.warn(`Key validation failed on ${model}:`, error?.message);

            // A rejected key will be rejected on every model - stop immediately.
            if (isAuthError(error)) {
                return {
                    valid: false,
                    transient: false,
                    reason: 'auth',
                    error: String(error?.message ?? error),
                };
            }

            // Not an auth failure, so the key is probably fine - but this model
            // could not serve it. Keep walking the chain either way: a 404 on
            // the primary just means we should try the next model, and a 503 on
            // every model still means Google's capacity, not the user.
            lastError = error;
            if (isTransientError(error)) {
                sawTransient = true;
            } else {
                sawPermanent = true;
            }
        }
    }

    console.error('API key validation failed on every model in the chain:', lastError);
    return {
        valid: false,
        // A single transient failure anywhere in the chain is enough to call
        // this temporary. Reporting transient only when the *last* model failed
        // transiently would be worse: a 404 on model 3 says nothing about the
        // 503 model 1 already hit, and the user should not be locked out over
        // what was a capacity blip.
        transient: sawTransient,
        reason: sawTransient ? 'transient' : sawPermanent ? 'model' : undefined,
        error: lastError ? String(lastError?.message ?? lastError) : undefined,
    };
}

export async function getLaptopRecommendations(
  args: RecommendationArgs,
  apiKey: string
): Promise<{ laptops: Laptop[], sources: GroundingSource[] }> {
  const ai = getAiInstance(apiKey);

  const searchPrompt = `
    Find the top 5 best laptop recommendations based on the following criteria for a user in ${args.country}:
    - **Budget:** Around ${args.budget} ${args.currency}
    - **Primary Use:** ${args.primaryUse}
    - **Secondary Use:** ${args.secondaryUse || 'Not specified'}
    - **Specific Needs & Preferences:** ${args.specificNeeds}

    **Instructions & Workflow:**
    1.  **SEARCH:** Use Google Search to find potential laptops from well-known, reputable retailers that operate in and ship to **${args.country}**.
    2.  **NAVIGATE & VERIFY:** For each potential laptop, navigate to the retailer's product page. On that page, extract as much of the following information as possible:
        a.  The exact, current price.
        b.  Availability status ('in stock', 'available for purchase', 'out of stock', etc.)
        c.  Processor model (specific model preferred, but general family is acceptable)
        d.  Graphics card model (dedicated GPU preferred, but integrated graphics are acceptable)
        e.  Amount of RAM (specific amount preferred)
        f.  Storage type and capacity (specific details preferred)
        g.  Display size and resolution (specific details preferred)
        h.  Operating system
        i.  Webcam specifications (resolution and features if available)
        j.  Keyboard features (backlighting, numpad, etc. if available)
        k.  Available ports (USB, HDMI, etc. if available)
    3.  **PRIORITY:** Prioritize laptops where you can verify the price and basic specs, but include laptops even if some details are missing.
    4.  **VALIDATE URL:** The 'retailerUrl' MUST be the final, direct, working URL to the product page.
    5.  **VALIDATE RETAILER:** The 'retailer' name MUST be the official name of the store from the product page.
    6.  **JUSTIFY:** For each recommendation, write a specific justification explaining how its features meet the user's stated needs.
  `;

  try {
    // Use fallback strategy for the search operation
    const searchResponse = await callWithFallback(apiKey, async (model) => {
        return await ai.models.generateContent({
            model: model,
            contents: searchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
    });

    const groundedText = searchResponse.text;
    
    if (!groundedText) {
        throw new Error("The web search did not return any results. This might be a temporary issue.");
    }

    const extractionPrompt = `Based on the following text, extract the information for up to 5 laptop recommendations.
    
    **Rules:**
    1. Only extract data that is explicitly present in the provided text.
    2. If a piece of information (like a URL) is missing or mentioned as unavailable, leave the corresponding JSON field as an empty string. Do not invent or guess any information.
    3. Include laptops even if some information is missing - partial information is better than no recommendation.
    4. **PRIORITY:** Prioritize laptops where you can verify the price and basic specifications.
    5. If you find more than 5 good options, select the 5 most relevant to the user's needs.

    Text: """
    ${groundedText}
    """
    `;

    // Use fallback strategy for the extraction operation
    const extractionResponse = await callWithFallback(apiKey, async (model) => {
        return await ai.models.generateContent({
            model: model,
            contents: extractionPrompt,
            config: {
                responseMimeType: "application/json",
                // thinkingConfig is deliberately omitted: several Flash Lite
                // models reject the field with 400 INVALID_ARGUMENT, which would
                // fail this entire extraction step.
                responseSchema: {
                    type: Type.ARRAY,
                    items: laptopSchema,
                },
            },
        });
    });

    // The HTTP call succeeded, so an empty/malformed body is a content problem,
    // not a transport one - and it must not be blamed on the model, which would
    // otherwise be skipped over when we could just try the next one.
    let parsed: unknown;
    try {
        parsed = JSON.parse(extractionResponse.text ?? '');
    } catch (parseError) {
        console.warn('Extraction returned unparseable JSON:', parseError);
        throw new Error(
            'The model returned a response we could not read. Please try again.'
        );
    }

    if (!Array.isArray(parsed)) {
        throw new Error(
            'The model returned an unexpected response shape. Please try again.'
        );
    }

    const laptops = (parsed as Laptop[]).map((laptop) => ({
        ...laptop,
        // Repair an unusable currency rather than letting it crash the render.
        // The extraction prompt tells the model to leave missing fields empty, so
        // "currency": "" is an expected output, not an edge case.
        currency: isValidCurrencyCode(laptop?.currency)
            ? laptop.currency.toUpperCase()
            : args.currency,
        specs: laptop?.specs ?? ({} as Laptop['specs']),
    }));

    // Add validation to ensure all required fields are populated with specific information
    const validateLaptopStrict = (laptop: Laptop): boolean => {
        // Check that all basic fields are present
        if (!laptop.modelName || !laptop.retailer || !laptop.retailerUrl) {
            console.warn(`Laptop missing basic information: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Check that price is a valid number greater than 0
        if (typeof laptop.price !== 'number' || laptop.price <= 0) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            return false;
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for specific, non-generic values
        const isValidCpu = specs.cpu && 
                          specs.cpu.length > 0 && 
                          !specs.cpu.includes('i3/i5') && 
                          !specs.cpu.includes('i5/i7') && 
                          !specs.cpu.includes('Ryzen 3/5') && 
                          !specs.cpu.includes('Ryzen 5/7') &&
                          (specs.cpu.includes('Intel Core') || specs.cpu.includes('AMD Ryzen') || specs.cpu.includes('Apple M'));
                          
        if (!isValidCpu) {
            console.warn(`Laptop has invalid or generic CPU: ${laptop.modelName} - ${specs.cpu}`);
            return false;
        }
        
        // Check for specific GPU information (integrated graphics are acceptable if explicitly stated)
        const isValidGpu = specs.gpu && specs.gpu.length > 0;
        if (!isValidGpu) {
            console.warn(`Laptop has invalid GPU: ${laptop.modelName} - ${specs.gpu}`);
            return false;
        }
        
        // Check for specific RAM information
        const isValidRam = specs.ram && specs.ram.length > 0 && specs.ram.includes('GB');
        if (!isValidRam) {
            console.warn(`Laptop has invalid RAM: ${laptop.modelName} - ${specs.ram}`);
            return false;
        }
        
        // Check for specific storage information
        const isValidStorage = specs.storage && specs.storage.length > 0 && 
                              (specs.storage.includes('GB') || specs.storage.includes('TB'));
        if (!isValidStorage) {
            console.warn(`Laptop has invalid storage: ${laptop.modelName} - ${specs.storage}`);
            return false;
        }
        
        // Check for specific display information
        const isValidDisplay = specs.display && specs.display.length > 0 && 
                              (specs.display.includes('inch') || specs.display.includes('"'));
        if (!isValidDisplay) {
            console.warn(`Laptop has invalid display: ${laptop.modelName} - ${specs.display}`);
            return false;
        }
        
        // Check for specific webcam information
        const isValidWebcam = specs.webcam && specs.webcam.length > 0;
        if (!isValidWebcam) {
            console.warn(`Laptop has invalid webcam: ${laptop.modelName} - ${specs.webcam}`);
            return false;
        }
        
        return true;
    };
    
    // Less strict validation for fallback
    const validateLaptopRelaxed = (laptop: Laptop): boolean => {
        // Check that all basic fields are present
        if (!laptop.modelName || !laptop.retailer || !laptop.retailerUrl) {
            console.warn(`Laptop missing basic information: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Check that price is a valid number greater than 0
        if (typeof laptop.price !== 'number' || laptop.price <= 0) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            return false;
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for CPU information (allowing some generic terms as fallback)
        const hasCpu = specs.cpu && specs.cpu.length > 0;
        if (!hasCpu) {
            console.warn(`Laptop missing CPU info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for GPU information
        const hasGpu = specs.gpu && specs.gpu.length > 0;
        if (!hasGpu) {
            console.warn(`Laptop missing GPU info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for RAM information
        const hasRam = specs.ram && specs.ram.length > 0;
        if (!hasRam) {
            console.warn(`Laptop missing RAM info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for storage information
        const hasStorage = specs.storage && specs.storage.length > 0;
        if (!hasStorage) {
            console.warn(`Laptop missing storage info: ${laptop.modelName}`);
            return false;
        }
        
        return true;
    };
    
    // Even more relaxed validation for minimal requirements
    const validateLaptopMinimal = (laptop: Laptop): boolean => {
        // Check that we at least have a model name and price
        if (!laptop.modelName) {
            console.warn(`Laptop missing model name: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Price is helpful but we can work without it if other info is good
        if (laptop.price && (typeof laptop.price !== 'number' || laptop.price <= 0)) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            // Don't fail on price alone, just note it
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for at least some basic specs
        const hasBasicSpecs = (specs.cpu && specs.cpu.length > 0) || 
                             (specs.gpu && specs.gpu.length > 0) || 
                             (specs.ram && specs.ram.length > 0);
        
        if (!hasBasicSpecs) {
            console.warn(`Laptop missing basic specs: ${laptop.modelName}`);
            return false;
        }
        
        return true;
    };
    
    /**
     * The bare minimum the rest of the app assumes exists: a name to put on the
     * card, and a specs block holding at least one real value.
     *
     * Deliberately looser than validateLaptopMinimal - any of the nine spec
     * fields counts here, not just cpu/gpu/ram - so it can still rescue a row
     * that failed the stricter checks over a missing price or retailer URL while
     * never rescuing one that would render as a blank shell.
     */
    const hasRenderableShell = (laptop: Laptop): boolean => {
        if (typeof laptop?.modelName !== 'string' || laptop.modelName.trim().length === 0) {
            return false;
        }

        // `laptops` is cast straight from untrusted JSON, so `specs` is not
        // guaranteed to be an object even though the repair step above defaults
        // a missing one to {}.
        const specs = laptop?.specs as unknown as Record<string, unknown> | undefined | null;
        if (!specs || typeof specs !== 'object') return false;

        return Object.values(specs).some(
            (value) => typeof value === 'string' && value.trim().length > 0
        );
    };
    
    // First try with strict validation
    let validLaptops = laptops.filter(validateLaptopStrict);
    
    // If we don't have enough laptops, try with relaxed validation
    if (validLaptops.length < 2) {
        console.warn(`Only ${validLaptops.length} laptops passed strict validation. Trying relaxed validation.`);
        validLaptops = laptops.filter(validateLaptopRelaxed);
        
        // If we still don't have enough, try with minimal validation
        if (validLaptops.length < 2) {
            console.warn(`Only ${validLaptops.length} laptops passed relaxed validation. Trying minimal validation.`);
            validLaptops = laptops.filter(validateLaptopMinimal);
        }
        
        // Limit to 5 laptops maximum
        if (validLaptops.length > 5) {
            validLaptops = validLaptops.slice(0, 5);
            console.warn(`Found ${laptops.length} laptops, limited to 5 for display.`);
        }
    } else {
        // Limit to 5 laptops maximum
        if (validLaptops.length > 5) {
            validLaptops = validLaptops.slice(0, 5);
            console.warn(`Found ${validLaptops.length} laptops passing strict validation, limited to 5 for display.`);
        }
    }
    
    // If we still have no laptops, salvage whatever is still renderable rather
    // than returning rows that break the screen. A blind slice here used to hand
    // back laptops whose specs block was empty: analyzeBestFeatures interpolates
    // l.specs.cpu into its prompt and LaptopCard reads the same fields, so those
    // rows rendered as a blank shell (or blew up on an undefined deref) instead
    // of a degraded card. Requiring a name plus one real spec value is looser
    // than validateLaptopMinimal, so this still rescues rows that failed it for
    // an unrelated reason such as a missing retailer URL.
    if (validLaptops.length === 0 && laptops.length > 0) {
        const salvaged = laptops.filter(hasRenderableShell).slice(0, 3);
        if (salvaged.length > 0) {
            console.warn(`No laptops passed validation. Returning top ${salvaged.length} laptop(s) with partial specs.`);
            validLaptops = salvaged;
        }
    }
    
    if (validLaptops.length === 0) {
        throw new Error("I couldn't find any laptops that match your criteria. Try adjusting your budget or requirements - for example, consider a higher budget range or different use case.");
    }
    
    console.log(`Returning ${validLaptops.length} laptop recommendations.`);
    
    const rawSources = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources: GroundingSource[] = rawSources
      .map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title,
      }))
      .filter((source: GroundingSource) => source.uri && source.title)
      // Deduplicate sources based on URI
      .filter((source, index, self) => index === self.findIndex(s => s.uri === source.uri));


    return { laptops: validLaptops, sources };

  } catch (error) {
    console.error("Error in getLaptopRecommendations:", error);
    // Re-throw the original error so the UI layer can handle it appropriately.
    // The previous implementation was hiding specific errors like 'quota exceeded'.
    throw error;
  }
}

/**
 * Set once a quota-exhausted 429 is seen. Images are pure decoration, so after
 * this point we stop issuing image requests entirely rather than burning the
 * user's remaining quota on searches that cannot succeed.
 */
let quotaExhausted = false;

/**
 * Images are decorative but cost real quota: two grounded searches per laptop.
 * Cap how many we chase per search instead of rate-limiting on a clock.
 *
 * A previous version used a 60s localStorage cooldown, which was wrong twice
 * over: the read/write was a check-then-act race (all 5 Promise.all siblings
 * passed it), and once made atomic it suppressed 4 of every 5 lookups, leaving
 * most cards with no image. An explicit budget is predictable and self-documenting.
 */
const IMAGE_BUDGET_PER_SEARCH = 3;
let imageBudget = IMAGE_BUDGET_PER_SEARCH;

export function resetQuotaExhaustedFlag(): void {
    quotaExhausted = false;
    imageBudget = IMAGE_BUDGET_PER_SEARCH;
}

export async function generateLaptopImage(modelName: string, apiKey: string): Promise<string | null> {
    // Quota already known to be spent, or budget spent: don't issue the request.
    if (quotaExhausted || imageBudget <= 0) return null;

    // Claim a slot synchronously, before any await, so concurrent siblings in a
    // Promise.all fan-out can't all pass this check.
    imageBudget -= 1;

    try {
        const ai = getAiInstance(apiKey);
        // Instead of generating images, search for them using Google Search
        const searchPrompt = `Find an official product image for '${modelName}' laptop from manufacturer website or major retailer. Return only the image URL.`;

        // Use fallback strategy for image search
        const response = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: searchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });

        // Extract image URL from the search results
        const urlRegex = /(https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|webp))/gi;

        if (response.text) {
            const matches = response.text.match(urlRegex);
            if (matches && matches.length > 0) {
                // Return the first valid image URL found
                return matches[0];
            }
        }

        // Only retry once, and never on quota exhaustion. The old code always
        // issued a second search, doubling image requests for zero benefit when
        // the failure was a 429 rather than a genuinely fruitless search.
        console.warn(`No image found for "${modelName}" in initial search. Trying fallback search.`);
        const fallbackResponse = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: `Find a high-quality product image for ${modelName} laptop. Return only the image URL.`,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });

        if (fallbackResponse.text) {
            const matches = fallbackResponse.text.match(urlRegex);
            if (matches && matches.length > 0) {
                return matches[0];
            }
        }

        console.warn(`No image found for "${modelName}" after fallback search.`);
        return null;

    } catch (error) {
        // Latch the quota state so sibling image lookups stop firing.
        if (isQuotaExhausted(error)) {
            quotaExhausted = true;
            console.warn('Image lookup skipped for remaining laptops: API quota exhausted.');
            return null;
        }
        console.error(`Error searching for image for "${modelName}":`, error);
        // Log additional details if available
        if (error instanceof Error) {
            console.error(`Error name: ${error.name}`);
            console.error(`Error message: ${error.message}`);
            // If it's a Google API error, log additional details
            if ('status' in error) {
                console.error(`API Status: ${(error as any).status}`);
                // If we hit rate limits, record the time to prevent further requests
                if ((error as any).status === 429) {
                    // Diagnostic only - the real throttle is the imageBudget
                    // counter above, since this key is never read back. Storage
                    // is also unavailable in private mode, where both getItem and
                    // setItem throw a SecurityError, so guard it rather than
                    // letting a logging side effect replace the real error with
                    // a confusing one.
                    try {
                        localStorage.setItem('lastImageRequestTime', Date.now().toString());
                    } catch {
                        // Storage disabled / private browsing - nothing to record.
                    }
                }
            }
            if ('code' in error) {
                console.error(`API Code: ${(error as any).code}`);
            }
            if ('details' in error) {
                console.error(`API Details: ${(error as any).details}`);
            }
        }
        // Return null to allow the overall recommendation process to continue gracefully.
        return null;
    }
}

export async function analyzeBestFeatures(
    laptops: Laptop[],
    userNeeds: RecommendationArgs | null,
    apiKey: string,
    isEgypt: boolean = false
): Promise<string[]> {
    const ai = getAiInstance(apiKey);
    if (!userNeeds) return laptops.map(() => 'N/A');
    
    const prompt = isEgypt ? 
        `أنت خبير تكنولوجيا بتلخص لليوزر اختيارات اللابتوبات.
        احتياجات اليوزر الأساسية هي:
        - الاستخدام: ${userNeeds.primaryUse}
        - الميزانية: ~${userNeeds.budget} ${userNeeds.currency}
        - احتياجات تانية: ${userNeeds.specificNeeds}

        دول ${laptops.length} لابتوبات موصى بيها:
        ${laptops.map((l, i) => `
        لابتوب ${i + 1}: ${l.modelName}
        - CPU: ${l.specs.cpu}
        - GPU: ${l.specs.gpu}
        - RAM: ${l.specs.ram}
        - Display: ${l.specs.display}
        - OS: ${l.specs.operatingSystem}
        - Webcam: ${l.specs.webcam}
        - Keyboard: ${l.specs.keyboard}
        - Ports: ${l.specs.ports}
        `).join('')}

        **مهماتك:**
        لو كل لابتوب من دول، اكتب جملة واحدة بس، مختصرة، بتسلط الضوء على أهم feature أو ميزة متميزة ليه بالنسباللاليوزر ده.
        ركز على إيه اللي بيخليه اختيار ممتاز.
        مثال: "Features the most powerful GPU in this list for gaming." أو "Boasts a stunning OLED display ideal for creative work."

        ابعتلي بس JSON object فيه key واحد اسمه "features" واللي هو array من ${laptops.length} strings، واحدة لكل لابتوب بالترتيب اللي اديتهالك.
        ` :
        `
        You are a tech expert summarizing laptop options for a user.
        The user's primary needs are:
        - Use Case: ${userNeeds.primaryUse}
        - Budget: ~${userNeeds.budget} ${userNeeds.currency}
        - Other Needs: ${userNeeds.specificNeeds}

        Here are ${laptops.length} recommended laptops:
        ${laptops.map((l, i) => `
        Laptop ${i + 1}: ${l.modelName}
        - CPU: ${l.specs.cpu}
        - GPU: ${l.specs.gpu}
        - RAM: ${l.specs.ram}
        - Display: ${l.specs.display}
        - OS: ${l.specs.operatingSystem}
        - Webcam: ${l.specs.webcam}
        - Keyboard: ${l.specs.keyboard}
        - Ports: ${l.specs.ports}
        `).join('')}

        **Your Task:**
        For each of the ${laptops.length} laptops, provide a single, concise sentence that highlights its **single best feature or standout highlight** for this user.
        Focus on what makes it a great choice.
        For example: "Features the most powerful GPU in this list for gaming." or "Boasts a stunning OLED display ideal for creative work."

        Return ONLY a JSON object with a single key "features" which is an array of exactly ${laptops.length} strings, one for each laptop in the order they were provided.
        `;

    try {
        // Use fallback strategy for feature analysis
        const response = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            features: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                            },
                        },
                        required: ['features'],
                    },
                },
            });
        });

        // Try to parse the response
        let result;
        try {
            result = JSON.parse(response.text);
        } catch (parseError) {
            console.warn("Failed to parse JSON response for feature analysis:", response.text);
            // Try to extract features from the text response directly
            const lines = response.text.split('\n');
            const features: string[] = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('}') && !trimmed.includes('"features"') && trimmed.length > 10) {
                    // This might be a feature description
                    if (!trimmed.includes('Laptop') && !trimmed.includes(':') && trimmed.length > 20) {
                        features.push(trimmed);
                        if (features.length === laptops.length) break;
                    }
                }
            }
            
            if (features.length === laptops.length) {
                return features;
            }
            
            // If we still can't get the right format, return fallback
            throw new Error("Could not extract features from response");
        }

        // Validate the parsed result
        if (result && result.features && Array.isArray(result.features) && result.features.length === laptops.length) {
            return result.features;
        } else {
            // Try to extract features from the text response directly
            const lines = response.text.split('\n');
            const features: string[] = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('}') && !trimmed.includes('"features"') && trimmed.length > 10) {
                    // This might be a feature description
                    if (!trimmed.includes('Laptop') && !trimmed.includes(':') && trimmed.length > 20) {
                        features.push(trimmed);
                        if (features.length === laptops.length) break;
                    }
                }
            }
            
            if (features.length === laptops.length) {
                return features;
            }
            
            throw new Error(`AI response for feature analysis did not match the expected format. Expected ${laptops.length} features, got ${result?.features?.length || 0}`);
        }

    } catch (error) {
        console.error("Error analyzing laptop best features:", error);
        // Return a fallback array in case of an error as this is non-critical
        return laptops.map(() => "Analysis could not be generated.");
    }
}