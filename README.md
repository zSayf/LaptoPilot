# 🚀 LaptoPilot - AI-Powered Laptop Recommendation Assistant

<div align="center">

![LaptoPilot](https://img.shields.io/badge/LaptoPilot-v1.0.0-2196F3?style=for-the-badge&logo=react&logoColor=white)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Electron](https://img.shields.io/badge/Electron-38-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)

**AI-powered laptop recommendation assistant with Google Gemini**

 [🚀 Quick Start](#-quick-start)
 [🧠 Models](#-models)
 [☁️ Deployment](#-deployment)
 [⚠️ Known Limitations](#-known-limitations)

</div>

## 🎯 What is LaptoPilot?

LaptoPilot is an **AI-powered laptop recommendation assistant** that helps users find a laptop based on their needs, budget, and location. It runs **entirely in your browser** on **Google Gemini 3.8 Flash**, grounding on live Google Search for current pricing and availability, and it lets **you pick which model to use** from the ones your own API key can access.

Everything runs client-side and there is no backend: you paste your own Gemini API key, and it is sent only to Google.

### 🌟 Development Process

This application was initially built using **Google AI Studio Apps Builder** which generated approximately 70% of the core functionality. The remaining 30% involved significant improvements, enhancements, and customizations. The AI Studio importmap that served React and the Gemini SDK from a CDN has since been removed — Vite now resolves and bundles both from `node_modules`, and the app is deployed to Cloudflare Pages.

### 🌟 Why Choose LaptoPilot?

- **🧠 Advanced AI Analysis**: Multi-phase Gemini conversation, defaulting to `gemini-3.8-flash`, with **your choice of model** from a per-key catalogue
- **🔍 Real-time Web Search**: Finds current pricing and availability from major retailers worldwide
- **🌐 Multi-language Support**: Full English and Egyptian Arabic support with RTL layout
- **🎨 Modern Professional UI**: React 19 + Tailwind CSS v4 interface with responsive design
- **🔒 Bring Your Own Key**: Your key stays in your browser's `localStorage` and is sent only to Google — but it is stored **in plaintext**, readable by any script on the origin (see [Known Limitations](#-known-limitations))
- **⚡ Resilient**: Per-model exponential backoff with jitter, plus an automatic fallback chain when a model hits a quota or rate limit
- **💻 Cross-Platform**: The web app runs everywhere; the Electron desktop build is configured for **Windows**

---
## 📸 Screenshots

<div align="center">

### 🏠 Welcome Screen
*Country and budget selection with clean, intuitive interface*

![Welcome Screen](https://github.com/zSayf/LaptoPilot/blob/main/Assests/Home%20Page.png)

### 💬 AI Chat Interface
*Conversational AI gathering user requirements*

![AI Chat Interface](https://github.com/zSayf/LaptoPilot/blob/main/Assests/Ai%20Chat.png)

### 💻 Laptop Recommendations
*Detailed laptop recommendations with specifications and feature highlights*

![Laptop Recommendations](https://github.com/zSayf/LaptoPilot/blob/main/Assests/recommendation.png)

</div>

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js** (v18 or higher — Vite 6 requires `^18.0.0 || ^20.0.0 || >=22.0.0`)
- **Google Gemini API Key** ([Get free key](https://ai.google.dev/gemini-api))

### ⚡ Installation Methods

#### **Method 1: Live Web App (Easiest)**
- Open **https://laptopilot.pages.dev**
- No installation, no Node.js — bring your own API key

#### **Method 2: From Source**
```bash
# Clone the repository
git clone https://github.com/zSayf/laptopilot.git
cd laptopilot

# Install dependencies
npm install

# Run the application in development mode (http://127.0.0.1:3005)
npm run dev

# Run the test suite
npm test
```

#### **Method 3: Pre-built Windows Executable**
- Download an executable from the [Releases](https://github.com/zSayf/laptopilot/releases) page
- Run it to start the desktop app — no Node.js installation required
- ⚠️ These binaries are **unsigned** and are not configured for auto-update (see [Known Limitations](#-known-limitations))

### 🎮 First Run Guide

1. **🚀 Start the application**
   ```bash
   # Use the live web app at https://laptopilot.pages.dev
   # Or run in development mode:
   npm run dev
   ```

2. **🔑 Configure API key**
   - Get your free API key from [Google AI Studio](https://ai.google.dev/gemini-api)
   - Enter it in the API key dialog and press **Validate and Continue**
   - The key is saved to `localStorage` under `geminiApiKey` as **plaintext**, and is only ever sent to Google's Gemini API

3. **🤖 Optional: pick your model**
   - Use the model button in the header to open the model picker
   - LaptoPilot calls `models.list` with *your* key and offers only the models that key can actually use

4. **🌍 Select your country**
   - Choose from 12 supported countries
   - Currency and budget range adjust automatically

5. **💰 Set your budget**
   - Use the slider to set your approximate budget
   - Budget ranges automatically adjust based on selected country

6. **💬 Start the conversation**
   - Click "Start Discovery" to begin the AI-guided requirement gathering
   - Answer questions about your laptop usage and preferences

7. **💻 Get recommendations**
   - Receive up to 5 personalized laptop recommendations
   - View in card or comparison format
   - Ask follow-up questions about the recommendations

---

## 🛠️ Technology Stack

| Component | Technology | Purpose | Version |
|-----------|------------|---------|---------|
| **AI Engine** | Google Gemini (user-selectable) | Intelligent recommendations | `gemini-3.8-flash` default |
| **AI SDK** | `@google/genai` | Official Gemini client | `^1.21.0` |
| **Frontend Framework** | React | Modern web interface | `^19.1.1` |
| **Language** | TypeScript | Type safety and developer experience | `~5.8.2` |
| **Styling** | Tailwind CSS | Responsive design system | `^4.3.3` (via `@tailwindcss/vite`) |
| **Build Tool** | Vite | Fast development and building | `^6.2.0` |
| **Testing** | Vitest | Unit tests (`npm test`) | `^5.0.3` |
| **Desktop App** | Electron | Cross-platform desktop shell | `^38.2.0` |
| **Desktop Packaging** | electron-builder | NSIS + portable Windows builds | `^26.0.12` |
| **Hosting** | Cloudflare Pages | Static web deployment | `wrangler ^4.145.0` |
| **State Management** | React Hooks | Application state management | Built-in |
| **Package Manager** | npm | Dependency management | 11.x recommended |

> Tailwind is a **real dependency** now (`tailwindcss` + `@tailwindcss/vite` in `package.json`), wired through the `@tailwindcss/vite` plugin in `vite.config.ts` with `styles.css` as the CSS entry point. Earlier versions loaded Tailwind from a CDN.

---

## 🧠 Models

LaptoPilot does not hard-code a single model. Model selection lives in `services/modelStore.ts`, which is the single source of truth:

- **Default / primary:** `gemini-3.8-flash`
- **Fallback chain:** `gemini-3.8-flash → gemini-3.7-flash → gemini-3.1-flash-lite`

### The model selector

- When your key validates, the app calls `models.list` **scoped to that key**, so a free-tier key sees a smaller catalogue than a billed one
- The list is filtered to models that can actually power this app. LaptoPilot needs two capabilities — **Google Search grounding** (for live pricing) and **JSON-schema structured output** (for extraction and feature analysis) — so embedding, image, TTS, live, Veo, music, robotics, computer-use, Gemma, LearnLM, transcribe and omni families are dropped up front
- Your pick is stored in `localStorage` (`laptopilot.selectedModel`) and re-applied on reload, to both the selected model *and* the fallback chain
- **The fallback chain is rebuilt from your key's own catalogue**, never padded with ids the key cannot reach (a padded chain costs a guaranteed 404 per entry). It is capped at 4 entries and never escalates to a more expensive tier than the one you picked
- Changing the model makes **no API call** — a capability probe on every change used to burn 1-2 requests each time, enough to spend a free-tier day's quota just by opening the dropdown

### Retry, backoff and quota handling

- **Per-model retry:** transient failures (408/429/5xx, and network errors with no status at all) retry twice with exponential backoff **plus jitter** — 1s, 2s, 4s, capped at 30s, starting from a longer 2s base on a 429
- **Chain pacing:** a 1200ms + jitter pause between chain entries, so a burst of retries does not immediately re-trip the free tier's per-minute limit
- **Never retried:** auth failures (401/403) and quota exhaustion — retrying either just burns requests that cannot succeed
- **Quota exhaustion latches:** once a 429 reports the daily cap is spent, the app stops issuing decorative laptop-image lookups and keeps that state until the next search resets it. Image lookups are separately capped at 3 per search
- **Honest key validation:** validation walks the chain and reports *why* it failed — bad key (`auth`), a key that cannot reach any model (`model`), or a temporary outage (`transient`). A capacity blip does not lock you out of the app

---

## ☁️ Deployment

The app is a fully client-side static site — no Worker functions, no server-side secrets.

```bash
npm run deploy:cloudflare             # production
npm run deploy:cloudflare:preview     # preview branch
```

- Config: `wrangler.jsonc` (project `laptopilot`, output dir `dist`)
- **Live at https://laptopilot.pages.dev**
- `public/_headers` ships a strict **Content-Security-Policy** (`script-src 'self'`, `connect-src` limited to `https://generativelanguage.googleapis.com`, `frame-ancestors 'none'`) alongside `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and a `Permissions-Policy` that disables geolocation, microphone and camera
- ⚠️ The CSP only applies on Cloudflare Pages. Neither `electron/main.cjs` nor `vite dev` ships one.

---

## 🧪 Tests

```bash
npm test        # vitest run - 5 files, 171 tests, no network
```

Coverage is the pure logic worth protecting: model-catalogue filtering and ranking (`tests/geminiService.models.test.ts`), the fallback-chain contract (`tests/modelStore.test.ts`), auth/transient/quota error classification and retry counts (`tests/geminiService.errors.test.ts`), currency-code repair so a bad model value cannot crash `Intl.NumberFormat` (`tests/geminiService.currency.test.ts`), and retailer/grounding URL sanitisation (`tests/urlSafety.test.ts`). The Gemini SDK is stubbed, so runs are offline and fast.

---

## ⚠️ Known Limitations

- **The key lives in the browser, in plaintext.** `localStorage.geminiApiKey` is readable by any script running on the origin, and by anyone with access to the browser profile. The CSP on `laptopilot.pages.dev` reduces the blast radius, but this is *not* hardened storage — do not use a key you would not paste into a page yourself. There is no key vault, no proxy, and no server.
- **Free-tier keys are capped at 250 requests/day** per project per model. A single search costs a grounded search, a structured extraction, a feature-analysis call and up to 3 image lookups, so a handful of searches can exhaust a day. The app paces and falls back automatically, but it cannot manufacture quota. The per-minute and per-day 429s are indistinguishable, which is a known limit of the quota heuristic.
- **`release/` binaries are unsigned.** There is no signing certificate and no signing configuration, so Windows SmartScreen will warn (macOS Gatekeeper would block them outright). There is also **no `electron-updater` dependency and no auto-update implementation** — new versions must be downloaded manually.
- **Desktop packaging is configured for Windows only** (`nsis` + `portable` in the `electron-builder` config). The web app is cross-platform; no macOS or Linux desktop artifacts are produced.
- **`npm run release` is currently broken**: it invokes `scripts/create-release.js`, but the file on disk is `scripts/create-release.cjs` — and that script only prints `gh release create` instructions, it does not publish anything.
- **The Electron build is not in parity with the web build.** The entry point is `electron/main.cjs` (sandbox on, external links forced to the OS browser, in-app navigation blocked). It picks up the same CSP as the web build via a `<meta http-equiv>` tag in `index.html`, since Cloudflare's `public/_headers` only applies at the edge.
- **No server-side hardening, rate limiting or auth** — any static host serves the same unprotected bundle.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**⭐ Star this repository if LaptoPilot helped you find your perfect laptop! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/zSayf/LaptoPilot?style=social)](https://github.com/zSayf/LaptoPilot/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/zSayf/LaptoPilot?style=social)](https://github.com/zSayf/LaptoPilot/network/members)
[![GitHub issues](https://img.shields.io/github/issues/zSayf/LaptoPilot?style=social)](https://github.com/zSayf/LaptoPilot/issues)


**Made with ❤️ for laptop shoppers everywhere**

*Professional AI-powered laptop recommendations for everyone*

</div>