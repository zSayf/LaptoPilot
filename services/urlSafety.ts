/**
 * URL safety helpers.
 *
 * `retailerUrl` and grounding `source.uri` originate from web-grounded LLM
 * output, which means an attacker who can get a page indexed can influence them
 * (indirect prompt injection). The rendered values land in `href`.
 *
 * React's `sanitizeURL` blocks `javascript:` only - not `data:`, `blob:`, or
 * arbitrary hosts - so an explicit http/https allowlist is the real control.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns a normalised http(s) URL, or null if the input is unusable or uses
 * any other scheme.
 */
export function safeHttpUrl(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;

    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return null;
    }

    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
}

/** Convenience predicate for render sites. */
export function isSafeHttpUrl(raw: unknown): boolean {
    return safeHttpUrl(raw) !== null;
}

/**
 * The hostname to show next to a retailer name, so a mismatch between the
 * claimed brand and the real destination is visible to the user.
 */
export function displayHost(raw: unknown): string | null {
    const safe = safeHttpUrl(raw);
    if (!safe) return null;
    try {
        return new URL(safe).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}