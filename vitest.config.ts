import { defineConfig } from 'vitest/config';

/**
 * Test-only Vite config.
 *
 * Having a `vitest.config.ts` also stops Vitest from loading `vite.config.ts`,
 * which would otherwise drag the React + Tailwind plugins into every run.
 *
 * Everything under test here is pure logic, so the environment is plain Node:
 * no DOM, no jsdom, and - critically - no real network calls. The Gemini SDK is
 * replaced with a stub wherever a test needs to stand in for an HTTP response.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            // electron-builder unpacks a whole Chromium tree in here.
            'release/**',
            '.wrangler/**',
            '.playwright-mcp/**',
        ],
    },
});