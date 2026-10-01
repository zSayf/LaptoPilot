/**
 * Tiny in-memory `localStorage` so `services/modelStore.ts` can be exercised in
 * the Node test environment without pulling in jsdom.
 *
 * Deliberately tiny: `modelStore` only ever calls getItem/setItem and wraps both
 * in try/catch, so a Map plus the three shape methods is the whole contract.
 */
export class MemoryStorage {
    private data = new Map<string, string>();

    get length(): number {
        return this.data.size;
    }

    clear(): void {
        this.data.clear();
    }

    getItem(key: string): string | null {
        return this.data.has(key) ? this.data.get(key)! : null;
    }

    key(index: number): string | null {
        return [...this.data.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }

    setItem(key: string, value: string): void {
        this.data.set(key, String(value));
    }
}

/** Install a fresh `globalThis.localStorage` and hand it back for assertions. */
export function installLocalStorage(): MemoryStorage {
    const storage = new MemoryStorage();
    (globalThis as unknown as Record<string, unknown>).localStorage = storage;
    return storage;
}

/**
 * Remove `localStorage` entirely, simulating a locked-down browser profile /
 * SSR, where even reading it throws.
 */
export function uninstallLocalStorage(): void {
    delete (globalThis as unknown as Record<string, unknown>).localStorage;
}