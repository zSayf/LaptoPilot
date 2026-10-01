import { describe, expect, it } from 'vitest';
import { displayHost, isSafeHttpUrl, safeHttpUrl } from '../services/urlSafety';

/**
 * `safeHttpUrl` is the control on values that came out of web-grounded LLM
 * output (`retailerUrl`, grounding `source.uri`) and are rendered into an `href`.
 * Anything a model can be talked into emitting must be filtered here - React's
 * own sanitizeURL only blocks `javascript:`.
 */

const REJECTED: Array<[string, string]> = [
    ['javascript: URL', 'javascript:alert(document.domain)'],
    ['uppercase JavaScript: URL', 'JAVASCRIPT:alert(1)'],
    ['padded javascript: URL', '   javascript:alert(1)   '],
    // The URL parser strips control characters, so this is still javascript:.
    ['javascript: split by a newline', 'java\nscript:alert(1)'],
    ['javascript: split by a tab', 'java\tscript:alert(1)'],
    ['data: URL', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['data: URL with inline markup', 'data:text/html,<img src=x onerror=alert(1)>'],
    ['data: URL with a leading space', '  data:text/html,<b>x</b>'],
    ['blob: URL', 'blob:https://evil.test/2b0f1a4c-0d1e-4a3b-9c77-000000000000'],
    ['vbscript: URL', 'vbscript:msgbox("hi")'],
    ['file: URL', 'file:///C:/Windows/System32/drivers/etc/hosts'],
    ['ftp: URL', 'ftp://files.test/payload'],
    ['mailto: URL', 'mailto:someone@test.invalid'],
    ['empty string', ''],
    ['whitespace only', '   \t\n  '],
    ['bare scheme', 'http'],
    ['scheme with no host', 'https://'],
    ['scheme with no host and a port', 'http://:8080/x'],
    ['missing scheme', '://example.com'],
    ['protocol-relative URL', '//evil.test/path'],
    ['prose, not a URL', 'retailer link: bestbuy'],
];

const ACCEPTED: Array<[string, string, string]> = [
    ['plain http URL', 'http://retailer.test/product/1', 'http://retailer.test/product/1'],
    ['plain https URL', 'https://retailer.test/product/1', 'https://retailer.test/product/1'],
    ['query + fragment', 'https://retailer.test/p?ref=lp#specs', 'https://retailer.test/p?ref=lp#specs'],
    ['explicit non-default port', 'https://retailer.test:8443/p', 'https://retailer.test:8443/p'],
    ['localhost', 'http://localhost:3005/p', 'http://localhost:3005/p'],
    ['punycode host', 'https://xn--80ak6aa92e.com/p', 'https://xn--80ak6aa92e.com/p'],
    ['userinfo in the URL', 'https://user:pw@retailer.test/p', 'https://user:pw@retailer.test/p'],
    // Normalisation is the point of returning `parsed.href` rather than the input.
    ['padded input is trimmed', '  https://retailer.test/p  ', 'https://retailer.test/p'],
    ['uppercase scheme + host', 'HTTPS://Retailer.TEST/p', 'https://retailer.test/p'],
    ['bare host gains a root path', 'https://retailer.test', 'https://retailer.test/'],
];

describe('safeHttpUrl', () => {
    it.each(REJECTED)('rejects a %s', (_label, raw) => {
        expect(safeHttpUrl(raw)).toBeNull();
    });

    it.each(ACCEPTED)('accepts and normalises a %s', (_label, raw, expected) => {
        expect(safeHttpUrl(raw)).toBe(expected);
    });

    it('rejects non-string input rather than coercing it', () => {
        for (const value of [null, undefined, 42, 0, true, false, {}, [], () => 'https://a.test']) {
            expect(safeHttpUrl(value)).toBeNull();
        }
    });

    it('never returns an empty string, which would render href=""', () => {
        for (const [, raw] of REJECTED) {
            const result = safeHttpUrl(raw);
            expect(result === null || result.length > 0).toBe(true);
        }
    });
});

describe('isSafeHttpUrl', () => {
    it.each(REJECTED)('returns false for a %s', (_label, raw) => {
        expect(isSafeHttpUrl(raw)).toBe(false);
    });

    it.each(ACCEPTED)('returns true for a %s', (_label, raw) => {
        expect(isSafeHttpUrl(raw)).toBe(true);
    });

    it('agrees with safeHttpUrl on non-string input', () => {
        for (const value of [null, undefined, 42, {}, []]) {
            expect(isSafeHttpUrl(value)).toBe(false);
        }
    });
});

describe('displayHost', () => {
    it('strips a leading "www." label', () => {
        expect(displayHost('https://www.bestbuy.com/site/laptop')).toBe('bestbuy.com');
    });

    it('strips "www." regardless of case in the scheme and host', () => {
        expect(displayHost('HTTPS://WWW.BestBuy.COM/site/laptop')).toBe('bestbuy.com');
    });

    it('leaves a host alone when it has no "www." label', () => {
        expect(displayHost('https://bestbuy.com/site/laptop')).toBe('bestbuy.com');
        expect(displayHost('https://shop.example.test/x')).toBe('shop.example.test');
    });

    it('only strips the first "www." label', () => {
        expect(displayHost('https://www.www.example.test/x')).toBe('www.example.test');
    });

    it('does not strip lookalike labels such as "www2"', () => {
        expect(displayHost('https://www2.example.test/x')).toBe('www2.example.test');
        expect(displayHost('https://www-shop.example.test/x')).toBe('www-shop.example.test');
    });

    it('reports the real destination host when userinfo mimics a brand', () => {
        // "https://bestbuy.com@evil.test" navigates to evil.test; the label must
        // say so, otherwise the brand check is worthless.
        expect(displayHost('https://bestbuy.com@evil.test/p')).toBe('evil.test');
    });

    it('keeps sub-domains visible instead of hiding them behind the brand', () => {
        expect(displayHost('https://bestbuy.com.evil.test/p')).toBe('bestbuy.com.evil.test');
    });

    it('omits credentials and port from the displayed host', () => {
        expect(displayHost('https://user:pw@www.example.test:8443/p')).toBe('example.test');
    });

    it('returns null for anything safeHttpUrl rejects', () => {
        for (const [, raw] of REJECTED) {
            expect(displayHost(raw)).toBeNull();
        }
    });

    it('returns null for non-string input', () => {
        for (const value of [null, undefined, 42, {}, []]) {
            expect(displayHost(value)).toBeNull();
        }
    });
});