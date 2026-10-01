# LaptoPilot v1.0.0 - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Core Components](#core-components)
6. [API Integration](#api-integration)
7. [User Interface](#user-interface)
8. [Electron Desktop Application](#electron-desktop-application)
9. [Internationalization](#internationalization)
10. [Error Handling](#error-handling)
11. [Security](#security)
12. [Build and Deployment](#build-and-deployment)
13. [Development Setup](#development-setup)
14. [Project Structure](#project-structure)
15. [Release Notes](#release-notes)
16. [Known Limitations](#known-limitations)
17. [License](#license)

> **How to read this document.** It was written for v1.0.0 and has since drifted. Every claim below has been re-verified against the working tree; anything that could not be verified is marked ⚠️ as either **NOT IMPLEMENTED** or a known defect. The model set, framework versions and deployment story changed substantially after v1.0.0 — see [Unreleased](#unreleased-post-10-upgrade).

## Overview

LaptoPilot is an AI-powered laptop recommendation assistant that helps users find a laptop based on their needs, budget, and location. Using Google Gemini (default `gemini-3.8-flash`, user-selectable), it provides recommendations through a conversational interface while leveraging real-time web search for current pricing and availability.

The application was initially built using Google AI Studio Apps Builder which generated approximately 70% of the core functionality. The remaining 30% involved significant improvements, enhancements, and customizations. The AI Studio importmap that served React and the Gemini SDK from a CDN has since been removed; Vite now bundles both from `node_modules`.

LaptoPilot operates entirely client-side, ensuring user privacy by storing API keys locally and processing all data within the user's browser. There is no backend and no server-side storage. The application supports 12 different countries with localized currency handling and budget ranges tailored to each economy.

## Key Features

### 🧠 Advanced AI Analysis
- Uses Google Gemini, defaulting to `gemini-3.8-flash` (a 1M-context Flash model) for chat, search, extraction and feature analysis
- **User-selectable model**, populated from the API key's own `models.list` catalogue
- Multi-phase conversation flow to gather comprehensive user requirements
- Function calls are a **text protocol**, not SDK function calling: the model emits `<call:findLaptopRecommendations ... />` and the app parses it with a regex (`App.tsx:492`). The chat sessions are created with `tools: []` (`App.tsx:509`)
- Structured prompt engineering for consistent and relevant responses
- Context-aware responses that adapt to user preferences and requirements

### 🔍 Real-time Web Search
- Finds current pricing and availability from major retailers worldwide
- Uses Google Search grounding (`tools: [{ googleSearch: {} }]`) for accurate, up-to-date information
- Grounding sources provided for transparency, de-duplicated by URI
- Dynamic search queries based on user requirements and location
- Laptop images are **found by a second grounded search** and regex-extracted from the text — nothing is generated

### 🌐 Multi-language Support
- Full English and Egyptian Arabic support
- RTL (Right-to-Left) layout for Arabic, applied for Egypt, Saudi Arabia and the UAE
- Culturally appropriate messaging and phrasing
- Locale-specific formatting for currency and numbers
- Dynamic language switching without page reload

### 🎨 Modern Professional UI
- React 19 + Tailwind CSS v4 interface with responsive design
- Card and comparison views for laptop recommendations
- Animated transitions and interactive elements
- Dark theme optimized for extended usage
- Accessible design with proper contrast ratios and ARIA attributes (verified: `role="log"` + `aria-live` on the transcript, `aria-pressed` on the view toggle, labelled controls throughout)

### 🔒 Privacy Focused
- API keys stored locally in browser storage — **as plaintext `localStorage`, not hardened storage**
- No data transmission beyond necessary AI requests
- Client-side only architecture
- No tracking or analytics (verified: no analytics or telemetry code in the bundle)
- Transparent data handling with clear user controls

### ⚡ Lightning Fast
- Real-time recommendations with smooth conversational flow
- Per-model exponential backoff with jitter, and a paced walk down the fallback chain
- An explicit **budget of 3 image lookups per search** rather than a localStorage cooldown
- Single-flight guards so the opening chat turn, the search and the feature analysis cannot be issued twice
- ⚠️ No caching layer and no lazy loading are implemented

### 💻 Cross-Platform
- The **web app** works on Windows, macOS, and Linux
- Electron-based desktop application; packaging is configured for **Windows only** (`nsis` + `portable`)
- Responsive design for all device sizes
- Touch-friendly interface for tablet usage
- Keyboard navigation support for accessibility

## Technology Stack

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

### Frontend Technologies
- **React 19**: Component-based UI library with hooks for state management
- **TypeScript 5.8**: Strongly typed programming language that builds on JavaScript
- **Tailwind CSS v4**: Utility-first CSS framework, now a real npm dependency (`tailwindcss` + `@tailwindcss/vite`) rather than a CDN include
- **Vite 6**: Frontend tooling with fast hot module replacement

### AI Integration
- **Google Generative AI SDK** (`@google/genai`): Official SDK for interacting with Gemini models
- **Text-based call protocol**: `findLaptopRecommendations` is described to the model and parsed back out of the response text
- **Model Fallback Strategy**: Automatic switching between models based on availability and quotas, with the chain rebuilt from the key's own catalogue

### Desktop Application
- **Electron 38**: Framework for building cross-platform desktop applications
- **electron-builder 26**: Complete solution to package and build Electron apps
- **electron-squirrel-startup**: Handles Windows squirrel events for proper installation

## Architecture

LaptoPilot follows a client-side architecture with the following key components:

1. **Frontend Layer**: React application with TypeScript and Tailwind CSS
2. **AI Integration Layer**: Google Gemini API integration with fallback mechanisms
3. **Data Processing Layer**: Validation and formatting of laptop recommendations
4. **UI Components Layer**: Reusable React components for different views
5. **Electron Layer**: Desktop application wrapper for native experience
6. **State Management Layer**: React hooks for managing application state
7. **Storage Layer**: LocalStorage for persisting user preferences, the API key and the model selection

The application is designed to be completely client-side, with all data processing happening in the browser and API keys stored locally. This architecture ensures there is no backend infrastructure to operate. It does **not** mean the key is protected at rest — see [Security](#security).

### Component Architecture
```
App.tsx (Main Component; also hosts ErrorNotification inline)
├── Header.tsx                 (incl. the model-switcher button)
├── ChatInterface.tsx
│   └── MessageBubble.tsx      (defined inside ChatInterface.tsx)
├── RecommendationsDisplay.tsx
│   ├── LaptopCard.tsx
│   └── ComparisonTable.tsx
├── ModelSelector.tsx
├── Loader.tsx
└── ErrorNotification.tsx      (defined inside App.tsx)
```

### Service Architecture
```
services/
├── geminiService.ts
│   ├── Model discovery (listCompatibleModels, getDefaultCompatibleModels)
│   ├── API Key Validation (validateApiKey)
│   ├── Laptop Recommendations (getLaptopRecommendations)
│   ├── Image lookup by grounded search (generateLaptopImage)
│   └── Feature Analysis (analyzeBestFeatures)
├── modelStore.ts              (selected model + fallback chain, single source of truth)
└── urlSafety.ts               (http(s) allowlist for model-supplied links)
```

## Core Components

### App.tsx (Main Application Component)
The main application component manages the overall application state and flow:
- API key management and validation
- Model catalogue loading and model selection (`modelSelect` state)
- Multi-step user flow (apiKeySetup → welcome → chatting → results, plus modelSelect)
- State management for chat history, recommendations, and user preferences
- Error handling and notifications
- RTL (Right-to-Left) layout support for Arabic
- Dynamic direction switching based on language selection
- Application lifecycle management
- Staleness guards: a generation counter invalidates in-flight work when the user starts over, changes key, or edits the key mid-flight

#### State Management
The App component manages several key pieces of state:
- `appState`: Controls which view is displayed (apiKeySetup, welcome, chatting, results, modelSelect)
- `apiKey`: User's Gemini API key, written to `localStorage` under the key `geminiApiKey` as **plaintext, origin-readable text** (not encrypted, not hardened)
- `country`: Selected country for localization
- `budget`: User's budget range with dynamic min/max based on country
- `models` / `selectedModel` / `modelsLoading` / `modelNotice`: the model catalogue and the user's pick
- `chatHistory`: Array of chat messages between user and AI
- `recommendations`: Array of laptop recommendations with full specifications
- `favorites`: User's favorite laptop selections (cleared on Start Over — they are session-scoped)
- `error`: Error messages for user feedback

#### Lifecycle Methods
- `useEffect` hooks for managing side effects and component lifecycle
- API key validation on component mount (guarded against unmount, StrictMode double-invoke, and a newer key)
- Persisted model selection re-applied on mount
- Direction setting based on language selection
- Scroll management for smooth navigation between views
- Chat initialization and management

### Services Layer (geminiService.ts)
The service layer handles all AI integration:
- Google Gemini API integration with model fallback strategy
- Laptop recommendation generation with web search
- Image *lookup* (grounded search + regex), not image generation
- Feature analysis for recommended laptops
- API key validation

#### Key Functions
- `getAiInstance(apiKey)`: Creates GoogleGenAI instance with provided API key
- `validateApiKey(apiKey)`: Validates API key by walking the fallback chain, returns `{ valid, transient, reason, error }`
- `getLaptopRecommendations(args, apiKey)`: Main recommendation function
- `generateLaptopImage(modelName, apiKey)`: Finds a laptop image by grounded search
- `analyzeBestFeatures(laptops, userNeeds, apiKey, isEgypt)`: Analyzes standout features
- `listCompatibleModels(apiKey)`: Lists and filters the models this key can use
- `getDefaultCompatibleModels()`: Built-in chain shaped like a model list, used when `models.list` is unavailable
- `isQuotaExhausted(error)`: Distinguishes a spent daily cap from a momentary rate limit
- `resetQuotaExhaustedFlag()`: Re-arms image lookups for a fresh search

#### Model Fallback Strategy
1. **Primary (default)**: `gemini-3.8-flash` — best quality, 1M context
2. **Fallback 1**: `gemini-3.7-flash`
3. **Fallback 2**: `gemini-3.1-flash-lite` — lightweight alternative

In practice the chain is **not** fixed. Once your key's `models.list` resolves, the chain is rebuilt from that catalogue only: your pick first, then same-tier-then-cheaper candidates, newest version first, never escalating to a pricier tier, capped at `MAX_CHAIN_LENGTH = 4`, and never padded with ids the key cannot reach. The literals above are used only when no catalogue is available at all. The user's pick is persisted in `localStorage` under `laptopilot.selectedModel` and re-applied to both the selected model and the chain on reload.

#### Data Validation Levels
1. **Strict Validation** (`validateLaptopStrict`): Requires complete specification information
2. **Relaxed Validation** (`validateLaptopRelaxed`): Accepts partial specification information
3. **Minimal Validation** (`validateLaptopMinimal`): Requires only basic laptop information
4. **Last-resort salvage** (`hasRenderableShell`): a model name plus one real spec value, so a row that failed the stricter checks over a missing price or retailer URL still renders instead of blowing up

Validation escalates only when fewer than 2 laptops survive the previous level, and results are capped at 5.

### UI Components

#### Header.tsx
Provides navigation controls and branding:
- Application title with LaptoPilot branding
- Start Over button for resetting the flow (hidden on the API key and model screens)
- Change API Key button for updating credentials
- **Model switcher button** showing the active model id, opening the model picker
- Responsive design for all screen sizes
- Dynamic text based on selected language

#### ModelSelector.tsx
The user-facing model picker:
- Groups the available models into Pro / Flash / Flash Lite / Standard optgroups, skipping empty tiers
- Shows each model's context window next to its display name
- "Refresh list" button to re-run `models.list`
- Explains what the selection actually changes, and that fallback is automatic
- Arabic/Egyptian labels throughout, with a `Refresh list` state while loading
- Empty and error states (loading, "no compatible models", partial-list warning)

#### ChatInterface.tsx
Interactive chat interface for requirement gathering:
- Message bubbles for user and AI interactions
- Auto-scrolling to latest messages (scrolls the transcript container, not the page)
- Loading indicators and typing animations
- Responsive design for all screen sizes
- Textarea auto-resizing based on content
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- RTL support for proper text alignment, using logical properties so it does not double-mirror
- Refocuses the input after a turn completes, without stealing the viewport on mount
- `role="log"` + `aria-live="polite"` + `aria-busy` so screen readers announce new turns

##### MessageBubble Component
- Different styling for user vs AI messages
- Avatar icons for visual distinction
- Animation for message entry
- Proper text wrapping and overflow handling

#### RecommendationsDisplay.tsx
Displays laptop recommendations in multiple formats:
- Toggle between card view and comparison table (`aria-pressed` view switch)
- Continuous conversation capability for follow-up questions
- Data sources display for transparency, with each URI scheme-allowlisted
- Responsive grid layout for card view
- Horizontal scrolling for comparison table on small screens

#### LaptopCard.tsx
Individual laptop recommendation cards:
- Detailed specifications display
- Image display with fallback (a per-card `imageError` flag, so a failed image never leaks onto a different laptop after a refined search)
- Favorite functionality (`aria-pressed` toggle with a constant accessible name)
- Retailer link with validation — scheme-allowlisted via `safeHttpUrl`, and the **real destination host** is shown under the retailer name, because the retailer string is model output too
- Best feature highlighting
- Price formatting based on selected currency, guarded by try/catch and a currency-code regex so a bad value can never crash the render
- Responsive design for all screen sizes

##### SpecItem Component
- Reusable component for displaying specification items, defined inside `LaptopCard.tsx`
- Consistent iconography for different specification types
- ⚠️ No text truncation is implemented — long values wrap

#### ComparisonTable.tsx
Tabular comparison of all recommendations:
- Side-by-side specification comparison
- Price and feature highlighting
- Retailer links for each model, scheme-allowlisted
- Responsive design with horizontal scrolling on small screens
- Proper column alignment and spacing
- Dynamic spec ordering for consistent presentation

#### Loader.tsx
Simple loading component with animation:
- Robot icon with bounce animation
- Contextual loading message
- Centered positioning for visibility, with `role="status"` + `aria-live="polite"`
- ⚠️ Currently **dead code** — the file exists but nothing imports it; in-app loading is rendered inline by the chat and results screens

#### icons.tsx
Collection of all SVG icons used throughout the application:
- Consistent styling and sizing
- Proper viewBox and fill properties
- Reusable components for maintainability
- Note: the filename is lowercase `icons.tsx`; the import path is `'./components/icons'`

## API Integration

### Google Gemini Integration
LaptoPilot integrates with Google's Gemini API using the following approach:

1. **Model Fallback Strategy**:
   - Primary (default): `gemini-3.8-flash`
   - Fallbacks: `gemini-3.7-flash`, then `gemini-3.1-flash-lite`
   - In practice the chain is rebuilt from the key's own `models.list` catalogue, capped at 4, and never padded with ids the key cannot reach

2. **Function Calls (text protocol)**:
   - The model is told to emit `<call:findLaptopRecommendations country="..." budget="..." ... />`; the app matches it with a regex and parses `key="value"` pairs
   - `tools: []` on the chat sessions — this is **not** SDK function calling
   - Budget and currency fall back to the welcome-screen values, so a formatted budget like "3,000 USD" can no longer resolve to 0
   - Error handling for quota limits and API issues

3. **Web Search Integration**:
   - Real-time search for current laptop pricing via `tools: [{ googleSearch: {} }]`
   - Grounding sources for transparency, de-duplicated by URI
   - Data validation and sanitization; every rendered URL goes through an http(s) allowlist

4. **Structured Extraction**:
   - `responseMimeType: 'application/json'` plus a `responseSchema` over the laptop object
   - `thinkingConfig` is deliberately omitted — several Flash Lite models reject the field with 400, which would fail the whole step
   - An invalid currency code is repaired to the requested one before it can reach `Intl.NumberFormat`, which throws `RangeError` on anything that isn't three ASCII letters and would unmount the whole tree

#### API Key Management
- Stored in `localStorage` under `geminiApiKey` as **plaintext, origin-readable text** — not encrypted, not hardened, and readable by any script on the origin
- Validation before use: walks the whole fallback chain so one busy model is never reported as a bad key
- A completed HTTP response is itself the proof of a working key; the body is not inspected, because a thinking model can reply with thought parts only
- The failure is reported with a `reason` (`auth` / `model` / `transient`) so the UI can stop telling someone to replace a perfectly good key
- User feedback for invalid keys, and an option to change the API key at any time

#### Request Handling
- Asynchronous operations with proper error handling
- **Retry with exponential backoff and jitter** on transient failures (408/429/5xx and network errors with no status), 2 attempts per model, capped at 30s, from a longer 2s base on a 429
- **Chain pacing** of 1200ms + jitter between entries, because one search can fire ~60 requests back to back and a burst re-trips the free tier's per-minute limit
- Auth failures and quota exhaustion are **never** retried
- Quota exhaustion detection (`isQuotaExhausted`) latches off further image lookups; image lookups are separately capped at 3 per search
- ⚠️ There is **no request timeout or cancellation**: none of the SDK calls accept an `AbortSignal`, so abandoned work is neutralised by generation counters in `App.tsx` rather than by cancelling the promise

### Model Discovery
- `listCompatibleModels(apiKey)` calls `models.list` **scoped to the key**, so a free-tier key returns a smaller catalogue than a billed one
- Filters to `gemini-*` ids that support `generateContent`, accepting either `supportedActions` or `supportedGenerationMethods`, and treating an absent capability field as "unknown" rather than "no"
- Drops families that cannot run this app: embedding, imagen, `-image`/`image-preview`, tts, live, native-audio, audio-dialog, veo, music, robotics, computer-use, gemma, learnlm, transcribe, omni
- Sorts best tier first, then newest version within a tier
- If the catalogue cannot be fetched, `getDefaultCompatibleModels()` supplies the built-in chain so the picker is never empty

### Data Validation
The application implements multiple levels of data validation:

#### Strict Validation
- Complete specification information required
- Specific CPU model information (not generic families)
- Dedicated GPU information (integrated graphics acceptable if explicitly stated)
- Specific RAM amount with GB designation
- Storage capacity with GB/TB designation
- Display size with inch designation
- Webcam specifications with resolution
- Keyboard features with specific details
- Port information with specific types

#### Relaxed Validation
- Partial specification information accepted
- Generic CPU families acceptable
- Basic GPU information acceptable
- RAM amount without specific designation
- Storage information without specific designation
- Display information without specific designation

#### Minimal Validation
- Basic laptop information required
- Model name must be present
- Price validation (helpful but not required)
- At least one specification must be present

### Response Processing
- JSON parsing with error handling
- Data structure validation
- Fallback mechanisms for incomplete data
- Deduplication of grounding sources
- Proper error propagation to UI layer

## User Interface

### Multi-step Flow
1. **API Key Setup**: API key entry and validation
   - Password-masked input field
   - Validation with a real request that walks the whole fallback chain
   - Link to Google AI Studio for key acquisition
   - Error handling for invalid keys
   - On-screen copy states the key is stored locally in the browser; it is plaintext, not hardened

2. **Welcome Screen**: Country selection and budget setting
   - Dropdown for country selection with 12 supported countries
   - Dynamic budget slider with min/max/step based on country
   - Currency formatting based on selected country
   - RTL layout support for Arabic interface

3. **Chat Interface**: Conversational requirement gathering
   - Message bubbles for user and AI interactions
   - Auto-scrolling to latest messages
   - Loading indicators and typing animations
   - Textarea for message input with auto-resizing

4. **Results Display**: Laptop recommendations with detailed specs
   - Toggle between card view and comparison table
   - Continuous conversation for follow-up questions
   - Favorite functionality for saving preferred options
   - Data sources display for transparency

5. **Model Select** (reached from the header, returns to wherever you came from)
   - Every model your key can use, grouped by tier with context windows
   - Refresh button, loading/empty/error states, and a note about automatic fallback
   - Changing the model makes no API call, so browsing the list costs nothing

### Responsive Design
- Mobile-first approach with responsive breakpoints
- Flexible grid layouts for different screen sizes
- Adaptive components for various viewports
- Touch-friendly interface for tablet usage
- Proper spacing and sizing for all devices

### Accessibility
- Semantic HTML structure
- Proper ARIA attributes (`aria-pressed` toggles, `aria-label` on every icon-only control, `aria-live` on the transcript, `role="status"` on loaders)
- Keyboard navigation support
- Color contrast compliance
- Focus management for interactive elements, including `focus-visible` rings and refocusing the chat input after a turn
- Screen reader compatibility
- ⚠️ There is **no React error boundary**: a render-time throw unmounts the app

### Animations and Transitions
- Smooth transitions between views
- Message entry animations
- Loading animations for better perceived performance
- Button hover and active states
- Focus states for interactive elements

## Electron Desktop Application

> **The entry point is `electron/main.cjs`** — `package.json` sets `"main": "electron/main.cjs"`, and the electron-builder `files` list ships `electron/*.cjs` only. Earlier duplicates (`main.ts`, `main.js`, `preload.ts`, `preload.js`) that predated the hardening have been **deleted**: they still pointed at the old dev port and lacked the sandbox/external-link guards, so leaving them in the tree only risked someone editing the wrong file.

### Main Process (`electron/main.cjs`)
- Browser window creation with appropriate dimensions (1200x800)
- Development vs. production loading logic
- Platform-specific window management (macOS `activate` re-creates the window)
- Squirrel startup handling for Windows installation, wrapped in try/catch so it degrades gracefully
- DevTools opening in development mode
- **External links are forced to the OS browser** via `setWindowOpenHandler`, refusing any non-http(s) scheme. Every retailer link and grounding source renders with `target="_blank"`, so without this an attacker-influenced page would load inside a chromeless app window
- **In-page navigation away from the app is blocked** with `will-navigate`, allowing only the dev server

#### Window Configuration
- Width: 1200px
- Height: 800px
- Node integration disabled for security
- Context isolation enabled for security
- `sandbox: true`, set explicitly rather than relying on the Electron >= 20 default
- Preload script for secure communication

#### Loading Logic
- Development: Loads from `http://localhost:3005` (bound to loopback by the Vite server)
- Production: Loads from local file system (`../dist/index.html`)

### Preload Script (`electron/preload.cjs`)
- Secure `contextBridge` exposing a single `electronAPI` object
- ⚠️ That object is **empty** — there is no exposed desktop functionality. The renderer never calls into the main process
- Electron security best practices implementation

### Build Configuration
- NSIS installer for Windows
- Portable executable option
- **Code signing: NOT IMPLEMENTED.** There is no certificate, no `win.signtoolOptions` / `forceCodeSigning` configuration, and no `CSC_*` environment variables anywhere in the repo. Shipped binaries are unsigned and will trip Windows SmartScreen (and macOS Gatekeeper, if the build were ever extended)
- **Auto-update: NOT IMPLEMENTED.** There is no `electron-updater` dependency, no update feed configuration, and no update check in the main process. New versions must be downloaded manually

#### Electron Builder Configuration
- Output directory: release/ (gitignored — ~100MB+ of binaries plus a full Chromium tree, published via GitHub Releases rather than git)
- App ID: com.laptopilot.app
- Product name: LaptoPilot
- File patterns for inclusion: `dist/**/*` and `electron/*.cjs`
- Windows targets: NSIS and Portable
- NSIS configuration: Non-one-click installer with installation directory selection
- ⚠️ **Windows only.** No macOS or Linux target is configured, so no other desktop artifacts are produced

### Distribution Options
1. **Installer Version**: Traditional NSIS installer for Windows (unsigned)
2. **Portable Version**: Standalone Windows executable that runs without installation (unsigned)
3. **Web Version**: Hosted on Cloudflare Pages at https://laptopilot.pages.dev — the only cross-platform option

## Internationalization

### Language Support
- English (default)
- Egyptian Arabic with RTL layout
- Dynamic language switching without page reload
- Context-appropriate translations

### Cultural Adaptation
- Currency localization based on country selection
- Budget ranges adjusted for different economies
- Culturally appropriate messaging and phrasing
- Number formatting based on locale — prices render through `Intl.NumberFormat` with `ar-EG` for Egypt, and Arabic-Indic digits for the results count

#### Supported Countries and Currencies
Verified against `constants.ts`:

1. Australia (AUD) - Budget range: $800-$6,000
2. Brazil (BRL) - Budget range: R$2,500-R$20,000
3. Canada (CAD) - Budget range: $600-$5,000
4. Egypt (EGP) - Budget range: E£10,000-E£80,000
5. France (EUR) - Budget range: €500-€4,000
6. Germany (EUR) - Budget range: €500-€4,000
7. India (INR) - Budget range: ₹30,000-₹250,000
8. Japan (JPY) - Budget range: ¥75,000-¥500,000
9. Saudi Arabia (SAR) - Budget range: SR2,000-SR15,000
10. United Arab Emirates (AED) - Budget range: AED2,000-AED15,000
11. United Kingdom (GBP) - Budget range: £400-£3,500
12. United States (USD) - Budget range: $500-$5,000

### RTL Support
- Direction is set from the selected country, not a language toggle: `EG`, `SA` and `AE` get `dir="rtl"`
- ⚠️ The Arabic *copy* is gated on `isEgypt` (i.e. `country === 'Egypt'`), so Saudi Arabia and the UAE get an RTL layout with the English interface
- Proper alignment and layout adjustments
- Icon positioning for RTL layouts, using logical properties (`-me-1`, `text-start`, `justify-start`) so they do not double-mirror
- Text alignment for natural reading flow
- Form element positioning

## Error Handling

### API Error Management
- Quota limit detection with automatic fallback
- API key validation with user feedback
- Network error handling with retry mechanisms (exponential backoff + jitter)
- Graceful degradation for non-critical features
- ⚠️ **No timeout handling** — see [Request Handling](#api-integration)

#### Error Types
1. **Quota Exceeded**: The chain is *not* short-circuited, because the daily cap is per project **per model** and another model may still have budget. Image lookups latch off entirely
2. **Invalid API Key**: Auth errors stop the chain immediately; the UI shows a clear message with a retry option
3. **Network Errors**: An error with no HTTP status at all is treated as transient (offline, DNS, captive portal) and retried
4. **Parsing Errors**: Extraction failures throw a readable message; feature analysis falls back to text extraction and then to "Analysis could not be generated."
5. **Rate Limiting**: No client-side rate limiter, but there is a per-search image budget and a paced chain walk
6. **Overload (503)**: Reported as `transient`, so a capacity blip never locks the user out of the app

### Data Validation
- Multiple validation levels for laptop recommendations
- Graceful degradation when data is incomplete
- User-friendly error messages in both languages
- Logging of validation failures for debugging
- Fallback data structures for missing information

### UI Error States
- Notification system for user feedback
- Loading states with contextual messages
- Form validation for user inputs
- Error boundaries for component failures
- Proper error logging for debugging

#### ErrorNotification Component
- Fixed positioning for visibility
- Dismissable with clear button
- Appropriate styling for error states
- Animation for appearance
- Accessibility considerations

## Security

> **Read this before trusting the app with a key.** "Client-side BYOK" is a privacy property, not a hardening one. The key is stored as plaintext in `localStorage`, where any script running on the origin — including a supply-chain-compiled one — can read it, and so can anyone with access to the browser profile. There is no key vault, no proxy and no server. Use a key scoped to this project, and treat the browser as the trust boundary.

### API Key Management
- Local storage only (no server-side storage) — stored under `localStorage.geminiApiKey`
- ⚠️ **Plaintext and origin-readable**, not encrypted or hardened. Do not describe it as "secure storage"
- Password-masked input field for key entry (hides it on screen; does not protect it at rest)
- Validation before use, walking the fallback chain
- User control for key changes
- No transmission of keys beyond the Gemini API

### Data Privacy
- No personal data collection
- Client-side only processing
- No tracking or analytics (verified: no analytics or telemetry code in the bundle)
- Transparent data handling
- User control over stored data

### Code Security
- URL validation for external links: `services/urlSafety.ts` enforces an http(s) allowlist on every model-supplied URL (`retailerUrl` and grounding `source.uri`), because those come from web-grounded output and are therefore attacker-influenceable. React's own `sanitizeURL` only blocks `javascript:`, so the explicit allowlist is the real control
- The **real destination host** is rendered next to the claimed retailer name, so a mismatch is visible
- `rel="noopener noreferrer nofollow"` on every external link
- Currency codes are validated before they reach `Intl.NumberFormat`, which throws `RangeError` and would unmount the tree
- Secure coding practices
- ⚠️ **Dependency vulnerability monitoring and regular security audits: NOT IMPLEMENTED.** There is no `npm audit` gate, no Dependabot config, and no audit process in the repo

### Electron Security
- Context isolation enabled
- Node integration disabled in renderer process
- `sandbox: true` set explicitly
- Secure preload script implementation
- Squirrel startup handling, in a try/catch
- External links forced to the OS browser, non-http(s) refused
- In-app navigation away from the app blocked
- `metadata.json` requests no frame permissions (`requestFramePermissions: []`)
- ⚠️ **No CSP is applied to the Electron renderer.** The strict policy in `public/_headers` only takes effect on Cloudflare Pages
- ⚠️ No code signing and no auto-update

## Build and Deployment

### Build Process
1. TypeScript compilation (`tsc --noEmit` as a type check)
2. Vite bundling and optimization
3. Asset optimization and minification
4. Electron packaging with electron-builder
5. ~~Code signing for trusted execution~~ — **NOT IMPLEMENTED**
6. Distribution package creation

#### Vite Configuration
- Base path `./` for relative asset loading, so the bundle works from any subpath
- Development server on **port 3005**, bound to `127.0.0.1` (not 0.0.0.0, which would expose the dev server to the LAN). Override with `PORT=...`
- Production build to `dist/` with `emptyOutDir`
- Asset and chunk file naming with hashes for cache busting
- `@` path alias for the repo root
- Tailwind v4 wired through the `@tailwindcss/vite` plugin, with `styles.css` as the CSS entry
- ⚠️ **No environment variable injection for API keys — deliberately.** This is a bring-your-own-key app; `GEMINI_API_KEY` is never baked into the client bundle, because that would publish it to every visitor. The only environment variables read are `PORT` and `NODE_ENV`

#### TypeScript Configuration
- ES2022 target for modern browser support
- `jsx: "react-jsx"` (the automatic React JSX transformation)
- `moduleResolution: "bundler"`
- `isolatedModules: true`
- Path aliases for easier imports (`@/*` → `./*`)
- `noEmit: true` — `tsc` only type-checks; Vite does the transpiling
- ⚠️ **`strict` is NOT enabled.** There is no `"strict": true` in `tsconfig.json`, so null/undefined and implicit-any checks are off. The code compensates with explicit guards, but "strict type checking" is not accurate

### Deployment Options
1. **Web Application**: Cloudflare Pages
   - `wrangler.jsonc` configures the `laptopilot` Pages project with `dist` as the build output dir
   - Deploy with `npm run deploy:cloudflare` (or `npm run deploy:cloudflare:preview` for a preview branch)
   - **Live at https://laptopilot.pages.dev** (verified responding)
   - `public/_headers` ships a strict CSP at the edge: `script-src 'self'` only, `connect-src` limited to `https://generativelanguage.googleapis.com`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and a `Permissions-Policy` disabling geolocation, microphone and camera
   - ⚠️ That CSP is Cloudflare-specific. The Electron build and `vite dev` do not get it

2. **Desktop Application** (Windows only, unsigned):
   - Installer version (NSIS) for Windows
   - Portable executable for Windows
   - No macOS or Linux targets are configured

### Release Management
- Version tagging with semantic versioning
- Release notes documentation (`GITHUB_RELEASE.md`)
- ⚠️ **GitHub release automation: NOT IMPLEMENTED.** `npm run release` invokes `scripts/create-release.js`, but the file on disk is `scripts/create-release.cjs`, so the script path is wrong; and that script only *prints* the `gh release create` command to follow by hand. No release is actually published
- ⚠️ **VirusTotal scanning: manual only.** `GITHUB_RELEASE.md` links two scan reports for the v1.0.0 binaries, but nothing in the build or release path performs a scan
- Distribution channel management

#### Release Process
1. Version bump in package.json
2. Update CHANGELOG.md
3. Build production assets
4. Create Electron packages
5. VirusTotal scanning
6. GitHub release creation
7. Distribution package upload

## Development Setup

### Prerequisites
- **Node.js v18 or higher** (Vite 6 requires `^18.0.0 || ^20.0.0 || >=22.0.0`; Node 24 and npm 11 are what this repo is developed against)
- Google Gemini API Key (only needed to *run* the app — it is pasted into the browser, not configured in the repo)
- Git (for version control)
- Code editor (VS Code recommended)
- Terminal/Command Prompt

### Installation
```bash
git clone https://github.com/zSayf/laptopilot.git
cd laptopilot
npm install
```

### Development Commands
```bash
# Run in development mode (http://127.0.0.1:3005)
npm run dev

# Run the unit tests
npm test

# Run Electron app in development
npm run electron:dev

# Build for production
npm run build

# Preview the production build locally
npm run preview

# Build Electron app
npm run electron:build

# Create release  (currently broken - see Known Limitations)
npm run release

# Deploy to Cloudflare Pages
npm run deploy:cloudflare
npm run deploy:cloudflare:preview
```

### Development Workflow
1. **Development Server**: `npm run dev` starts the Vite development server on port 3005, bound to loopback
2. **Electron Development**: `npm run electron:dev` starts Vite, waits for `tcp:3005`, then launches Electron with `NODE_ENV=development`
3. **Testing**: `npm test` runs the Vitest suite (5 files, 171 tests, no network — the Gemini SDK is stubbed). Manual testing is still done through the browser and the Electron app
4. **Building**: `npm run build` runs `tsc` as a type check, then `vite build`
5. **Packaging**: `npm run electron:build` produces Windows NSIS and portable builds into `release/`

### Environment Variables
- `PORT`: Overrides the Vite dev server port (default 3005)
- `NODE_ENV`: Environment detection (development/production), set by `npm run electron:dev`
- ⚠️ **There is no `GEMINI_API_KEY` environment variable.** The key lives in the browser. Nothing in the repo reads a key from the environment, and `vite.config.ts` explicitly refuses to inject one into the client bundle

### Code Quality
- TypeScript for type safety (⚠️ `strict` is **not** enabled — see [TypeScript Configuration](#build-and-deployment))
- Modern React patterns (hooks, functional components)
- 171 unit tests covering model selection, error classification, currency repair and URL safety
- ⚠️ **ESLint and Prettier are NOT configured.** There is no `.eslintrc*`, `eslint.config.*`, or `.prettierrc*` in the repo, and no `lint` or `format` npm script

## Project Structure

```
laptopilot/
├── components/
│   ├── ChatInterface.tsx
│   ├── ComparisonTable.tsx
│   ├── Header.tsx
│   ├── LaptopCard.tsx
│   ├── Loader.tsx
│   ├── ModelSelector.tsx
│   ├── RecommendationsDisplay.tsx
│   └── icons.tsx
├── electron/
│   ├── main.cjs          <- the entry point Electron actually loads
│   ├── preload.cjs
│   ├── main.cjs / preload.cjs   (the shipped entry point)
│   └── package.json
├── public/
│   └── _headers          (Cloudflare Pages CSP + security headers)
├── services/
│   ├── geminiService.ts
│   ├── modelStore.ts
│   └── urlSafety.ts
├── tests/
│   ├── helpers/localStorage.ts
│   ├── geminiService.currency.test.ts
│   ├── geminiService.errors.test.ts
│   ├── geminiService.models.test.ts
│   ├── modelStore.test.ts
│   └── urlSafety.test.ts
├── release/              (gitignored build output: win-unpacked/, builder-*.yml)
├── scripts/
│   └── create-release.cjs
├── App.tsx
├── CHANGELOG.md
├── GITHUB_RELEASE.md
├── LICENSE
├── README.md
├── constants.ts
├── create-release.bat
├── create-release.sh
├── electron.ts
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── styles.css            (Tailwind v4 entry: @import "tailwindcss")
├── test-electron.cjs
├── test-electron.js
├── tsconfig.json
├── types.ts
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc
```

### Component Directory
- **ChatInterface.tsx**: Main chat interface with message handling (also hosts `MessageBubble`)
- **ComparisonTable.tsx**: Tabular view of laptop comparisons
- **Header.tsx**: Application header with navigation controls, including the model switcher
- **LaptopCard.tsx**: Individual laptop recommendation display (also hosts `SpecItem`)
- **Loader.tsx**: Loading state component — currently unused dead code
- **ModelSelector.tsx**: The user-facing model picker, grouped by tier
- **RecommendationsDisplay.tsx**: Container for recommendation views
- **icons.tsx**: Collection of SVG icons used throughout the app

### Electron Directory
- **main.cjs**: Main Electron process entry point (the only main file in the packaged build)
- **preload.cjs**: Preload script for secure renderer communication
- **package.json**: Electron-specific package configuration
- ✅ The stale duplicate Electron entry points (`main.ts`, `main.js`, `preload.ts`, `preload.js`) have been deleted. `electron/` now contains only `main.cjs`, `preload.cjs` and `package.json`, so the unguarded variants can no longer be edited by mistake

### Services Directory
- **geminiService.ts**: All AI integration, model discovery, retry/backoff and data processing logic
- **modelStore.ts**: Selected model plus the fallback chain, persisted and capped
- **urlSafety.ts**: http(s) allowlist for model-supplied retailer and grounding URLs

### Tests Directory
- **`npm test` runs `vitest run`**, 5 files / 171 tests, in a plain Node environment with no DOM and no network
- `vitest.config.ts` exists so Vitest does not load `vite.config.ts` and drag the React + Tailwind plugins into every run

### Root Files
- **App.tsx**: Main application component
- **constants.ts**: Application constants (countries, currencies, budget ranges)
- **index.html**: HTML entry point
- **index.tsx**: React application entry point (imports `styles.css`)
- **styles.css**: Tailwind v4 entry point
- **types.ts**: TypeScript type definitions
- **vite.config.ts**: Vite build configuration
- **vitest.config.ts**: Test configuration
- **wrangler.jsonc**: Cloudflare Pages configuration
- **public/_headers**: CSP and security headers, published to the edge

## Release Notes

### v1.0.0 - 2025-09-30

> ⚠️ **Historical.** These notes describe the v1.0.0 tag, not the working tree. The app has since moved to `gemini-3.8-flash` with a user-selectable model, React 19 / Vite 6 / Electron 38, and a Cloudflare Pages deployment. Anything below that describes a model, version or capability marked ⚠️ is **not** current.

#### Added
- Initial release of LaptoPilot - AI-Powered Laptop Recommendation Assistant
- Multi-language support with English and Egyptian Arabic interfaces
- Integration with Google Gemini 2.5 Pro/Flash models for intelligent recommendations (⚠️ superseded — now `gemini-3.8-flash`, user-selectable)
- Real-time web search for current laptop pricing and availability
- Support for 12 countries with localized currency and budget ranges
- Advanced AI model fallback strategy — ⚠️ **superseded, see [Unreleased](#unreleased-post-10-upgrade). The chain shipped as `gemini-2.5-pro → gemini-2.5-pro → gemini-2.5-flash-lite`, which listed the same model twice**
- Professional React/Tailwind CSS interface with responsive design
- Electron-based desktop application (⚠️ packaging is configured for **Windows only**; the "macOS" claim was never backed by a build target)
- Local storage of API keys for user privacy (⚠️ plaintext `localStorage`)
- Interactive chat interface for requirement gathering
- Detailed laptop recommendations with specifications and justifications
- Feature highlighting for each recommended model
- RTL (Right-to-Left) layout support for Arabic interface
- Animated UI elements for enhanced user experience
- Comprehensive error handling with user feedback
- Data validation at multiple levels
- Release helper scripts for Windows and macOS (`create-release.bat` / `create-release.sh`)

#### Changed
- Enhanced error handling for API quota limits with automatic model fallback
- Improved function calling implementation for better AI interaction
- ⚠️ "Optimized token usage and cost monitoring" — no cost monitoring exists in the code; superseded by the explicit per-search image budget
- Enhanced validation for laptop specifications and pricing data
- Improved user experience with persistent API key storage
- Better handling of rate limiting for image lookups
- Refactored component structure for better maintainability
- Updated dependency versions for security and performance
- Improved accessibility with proper ARIA attributes
- Enhanced responsive design for all device sizes

#### Fixed
- Issues with function call execution where AI was writing function calls as text instead of executing them
- Quota exceeded errors with improved fallback mechanisms
- "Analysis could not be generated" errors with more robust parsing
- Rate limiting issues with image lookups
- Minor UI/UX improvements for better user experience
- RTL layout issues in Arabic interface
- Image loading errors with proper fallback handling
- Data validation edge cases
- Performance issues with large recommendation sets

---

## Unreleased (post-1.0.0 upgrade)

`package.json` is still at `1.0.0` and `CHANGELOG.md` has not been updated, so everything below is **shipped in the working tree but not in any release**. Recorded here so this document is not read as describing v1.0.0 when it is not.

### Added
- **User-selectable model.** `services/modelStore.ts` is the single source of truth; `components/ModelSelector.tsx` renders the picker, opened from a new header button. `models.list` is called scoped to the user's key and filtered to models that support both search grounding and structured output. The pick persists in `localStorage` (`laptopilot.selectedModel`) and re-applies to both the selected model and the chain
- **Model catalogue-derived fallback chain.** Cap of 4, never padded with ids the key cannot reach, never escalating to a pricier tier than the selection
- **Per-model retry with exponential backoff + jitter**, a 1200ms+jitter pause between chain entries, and explicit non-retry of auth errors and quota exhaustion
- **Quota-exhaustion handling.** `isQuotaExhausted()` distinguishes a spent daily cap from a momentary rate limit and latches off image lookups; a budget of 3 image lookups per search replaced a racy localStorage cooldown
- **Cloudflare Pages deployment.** `wrangler.jsonc`, `npm run deploy:cloudflare`, `npm run deploy:cloudflare:preview`; live at https://laptopilot.pages.dev
- **Content-Security-Policy** via `public/_headers`, plus `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`
- **`npm test`.** Vitest, 5 files / 171 tests, offline: model-store chain contract, model-catalogue filtering and ranking, auth/transient/quota classification, currency repair, URL safety
- Tailwind promoted from a CDN include to a real dependency (`tailwindcss` + `@tailwindcss/vite` 4.3.3), with `styles.css` as the CSS entry
- Model ids upgraded: `gemini-3.8-flash` primary, `gemini-3.7-flash` and `gemini-3.1-flash-lite` as fallbacks
- Electron hardening in `main.cjs`: `sandbox: true`, external links forced to the OS browser with a scheme allowlist, in-app navigation blocked
- `services/urlSafety.ts`: http(s) allowlist for every model-supplied URL, with the real destination host rendered
- Staleness guards in `App.tsx` (generation counters, synchronous single-flight flags) so abandoned work cannot overwrite the current session

### Changed
- **React 18 → 19**, **Vite 4 → 6**, **Electron 31 → 38**, TypeScript `~5.8.2`
- Dev server moved from port 3000 to **3005**, bound to `127.0.0.1`
- The AI Studio importmap serving React and `@google/genai` from `aistudiocdn.com` was **deleted**; Vite bundles both locally
- Electron entry point is now `main.cjs`, not `main.ts`
- `GEMINI_API_KEY` is explicitly never injected into the client bundle

### Removed / not implemented
- Code signing — no certificate, no `signtoolOptions`, no `forceCodeSigning`
- Auto-update — no `electron-updater` dependency and no update check

### Known defects
- `npm run release` references `scripts/create-release.js`, but the file is `scripts/create-release.cjs`; that script only prints `gh release create` instructions
- `electron/` now ships only `main.cjs` and `preload.cjs`; the earlier `main.ts` / `main.js` / `preload.ts` / `preload.js` copies were removed so the unguarded versions cannot be edited or restored by accident
- `Loader.tsx` is dead code — nothing imports it
- `tsconfig.json` does not enable `strict`

---

## Known Limitations

- **The key lives in the browser, in plaintext.** `localStorage.geminiApiKey` is readable by any script on the origin and by anyone with access to the browser profile. The Cloudflare CSP reduces the blast radius, but there is no vault, no proxy and no server. A future reader must not treat this as hardened.
- **Free-tier keys are capped at 250 requests/day** per project per model, and the app is not shy about spending them: one search costs a grounded search, a structured extraction, a feature-analysis call and up to 3 image lookups. The per-minute and per-day 429s are indistinguishable, which is a documented limit of the `isQuotaExhausted` heuristic.
- **`release/` binaries are unsigned** and there is no auto-update path, so every new version is a manual download.
- **Desktop packaging is Windows-only**; macOS and Linux are supported through the web app alone.
- **`npm run release` is broken** and never published anything automatically.
- **The CSP is now applied on both targets.** `public/_headers` sets it at the Cloudflare edge, and `index.html` repeats it as a `<meta http-equiv>` so the Electron `file://` load is covered too. `frame-ancestors` is edge-only (browsers ignore it in a `<meta>` tag), so `X-Frame-Options: DENY` backs it up.
- **No error boundary, no request timeout, no cancellation.** Abandoned Gemini work is neutralised by generation counters, not by aborting requests — a call left in flight still consumes quota.
- **`strict` TypeScript is off**, and there is no linter or formatter configured.

## License

This project is licensed under the MIT License:

MIT License

Copyright (c) 2025 Seif Elsayed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.