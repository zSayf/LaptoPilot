import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      // Relative, not absolute. The same dist/ is published two ways: Cloudflare
      // Pages serves it from a subpath (https://<project>.pages.dev/<something>/)
      // and Electron loads it with loadFile() over file://. Only a relative base
      // resolves correctly in both, and every emitted reference - <script src>,
      // <link rel=modulepreload>, CSS url(), and crucially the relative URL
      // inside each dynamic import() - is derived from this value.
      base: './',
      server: {
        // 3005, not 3000: another local project (D:\Awni Finance) already binds
        // :3000, and on Windows both sockets can end up "listening", leaving
        // this server unreachable at localhost:3000. Override with PORT=... if
        // 3005 is taken.
        port: Number(process.env.PORT) || 3005,
        // Bind loopback only. 0.0.0.0 exposes the dev server (and, via the
        // Electron dev flow, the app) to the whole LAN.
        host: '127.0.0.1',
      },
      plugins: [react(), tailwindcss()],
      // NOTE: GEMINI_API_KEY is deliberately NOT injected into the client
      // bundle. This is a bring-your-own-key app - the key lives in the user's
      // browser and is sent straight to Google, so baking it in here would
      // publish it to every visitor.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            assetFileNames: 'assets/[name]-[hash][extname]',
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',

            // Split the two large vendors out of the app chunk.
            //
            // Why: before this, one 511 kB chunk held the Gemini SDK, React and
            // every app module, so its content hash changed on *any* edit
            // anywhere. That defeated browser caching completely - a one-line
            // copy tweak invalidated 511 kB of already-downloaded vendor code
            // for every returning visitor.
            //
            // Measured composition of the old single chunk (rollup's own
            // per-module renderedLength, i.e. pre-minification):
            //   @google/genai/dist/web/index.mjs  729.2 kB  51.9%
            //   react-dom (client+dom)             525.7 kB  37.4%
            //   react + scheduler + jsx-runtime     29.9 kB   2.1%
            //   all app code                       116.9 kB   8.3%
            //
            // Both vendors are third-party and change only when their package
            // version changes, so isolating them makes their hashes stable
            // across deploys. This does NOT defer them: the entry still
            // imports both statically, so the same total bytes are fetched on
            // first paint - it is purely a caching win. Getting them off the
            // critical path needs a dynamic import() at the App.tsx ->
            // services/geminiService.ts edge, which is a source change.
            manualChunks(id) {
              // Normalise first: Rollup hands out native paths, so on Windows
              // these needles would not match without the swap.
              const norm = id.split('\\').join('/');
              if (!norm.includes('node_modules/')) return undefined;

              // @google/genai ships as a single 760 kB pre-bundled dist/web
              // .mjs, so there is nothing finer to split inside it.
              if (norm.includes('node_modules/@google/genai/')) return 'genai';

              // react-dom/client, react-dom, react/jsx-runtime, scheduler.
              if (/\/node_modules\/(react|react-dom|scheduler)\//.test(norm)) return 'react';

              // Catch-all so a future dependency lands in its own stable chunk
              // instead of silently re-entering the app chunk.
              return 'vendor';
            }
          }
        }
        // NOTE: chunkSizeWarningLimit is deliberately left at the Vite default
        // of 500 kB. No chunk comes close now - the largest is the genai chunk
        // at 243.97 kB (41.21 kB gzipped) - so the warning is genuinely
        // resolved rather than silenced. If it ever fires again it means a real
        // chunk grew, which is the signal worth keeping.
      }
    };
});
