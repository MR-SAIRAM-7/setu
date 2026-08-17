<div align="center">

# SETU — The Cognitive Operating System

**A bridge between dense digital worlds and the neurodivergent mind.**

A browser extension that reshapes any website in real time, a redesigned Broadsheet web workspace that turns
any topic into an interactive mind map, an Android mobile application built with React Native and Expo, and one shared AI engine with MongoDB database persistence behind all three.

Built for Capgemini Hack4Positive 2026 · Disability Inclusion & Accessibility

</div>

---

## The Four Connected Surfaces

```
                                ┌───────────────────────────────────────┐
                                │   Unified SETU Backend (Express.js)   │
                                │   - OpenRouter / Gemini AI Fallback   │
                                │   - MongoDB & Local Rule Engine       │
                                │   - Identity via x-user-id header     │
                                └──────────────────┬────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                │                                  │                                  │
  ┌─────────────▼────────────┐       ┌─────────────▼────────────┐       ┌─────────────▼────────────┐
  │     Chrome Extension     │       │     Web Application      │       │     Mobile Application   │
  │  - Content Script & DOM  │       │  - React 18 + Vite       │       │  - React Native + Expo   │
  │  - Lens Reading Tools    │       │  - Full Broadsheet Desk  │       │  - Touch Canvas & Haptics│
  │  - Handoff to Sanctuary  │       │  - SSE Streaming & Sync  │       │  - Offline-first Local DB│
  └──────────────────────────┘       └──────────────────────────┘       └──────────────────────────┘
```

| Surface | What it is | Where |
|---|---|---|
| **SETU Lens** | Chrome extension. Rewrites the page you are on — bionic text, line focus, reader view, read-aloud, and an AI agent that navigates the page for you. | `chrome-extension/` |
| **SETU Sanctuary** | Redesigned Broadsheet React workspace. Research any topic into an interactive mind map, 7 cognitive disability tools, 3-step onboarding, command palette, and focus sessions. | `frontend/` |
| **SETU Mobile** | React Native + TypeScript Expo Android client with SVG touch mind maps, camera OCR document ingestion, 7 cognitive modes, and ADHD focus timers. | `mobile/` |
| **SETU Engine** | The shared AI orchestration layer and MongoDB persistence service that all surfaces call transparently via `x-user-id`. | `backend/` |

---

## Quick start

You need **Node 18+** and one AI key — [OpenRouter](https://openrouter.ai/keys) is the primary
provider, with Google Gemini and OpenAI as direct fallbacks. MongoDB is optional: without it the
web and mobile apps keep everything in local storage and the engine keeps working.

### 1. Configure

```bash
cp .env.example .env
```

Put your key and optional MongoDB URI in `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
MONGODB_URI=mongodb://127.0.0.1:27017/setu
```

With no key at all the engine still starts and every mode degrades to the deterministic
offline rule engine, clearly labelled as such in the UI.

### 2. Start the Engine (Backend)

```bash
cd backend && npm install && npm start
```

Runs on `http://localhost:3000`.

### 3. Start the Web Sanctuary

```bash
cd frontend && npm install && npm run dev
```

Opens on `http://localhost:5173`.

### 4. Start the Mobile Application

```bash
cd mobile && npm install && npm start
```

- Run on Android Emulator: `npm run android`
- Run on Physical Phone: Scan QR code with the **Expo Go** app.

### 5. Load the Chrome Extension

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select the `chrome-extension/` folder

The extension works on every site immediately — no reload needed for tabs you already have open.

---

## Production Deployment

### Single-Process Web & API Deploy
The engine automatically serves the built SPA from `/frontend/dist`:

```bash
cd frontend && npm run build
cd ../backend && npm start
```
The entire application is live on `http://localhost:3000`.

### Android Mobile Standalone APK / EAS Build
```bash
cd mobile
eas build -p android --profile preview
```

### Verifying a Deploy

```bash
cd backend && npm run smoke
```

Runs the 21-point automated smoke test verifying health probes, AI model round-trips, database persistence, all 7 cognitive modes, document OCR, and streaming endpoints.

---

## License

Built for Capgemini Hack4Positive 2026.
