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
| **SETU Sanctuary** | Redesigned Broadsheet React workspace. Research any topic into an interactive talking mind map, 8 cognitive tools, reflective support, a reward system, 3-step onboarding, command palette, and focus sessions. | `frontend/` |
| **SETU Mobile** | React Native + TypeScript Expo Android client with SVG touch mind maps, camera OCR document ingestion, 7 cognitive modes, and ADHD focus timers. | `mobile/` |
| **SETU Engine** | The shared AI orchestration layer and MongoDB persistence service that all surfaces call transparently via `x-user-id`. | `backend/` |

---

## Clinical review — what the specialist changed

On **17 August 2026** the team reviewed SETU with **Dr. Prakhar Jain**. Several of his findings
contradicted assumptions the app was built on, so the web application was reworked against them.

| What the review established | What changed in `frontend/` |
|---|---|
| "Dyslexia" is three separate conditions — dyslexia (reading), **dyscalculia** (numbers), **dysgraphia** (writing). A person may have one, two, or all three. | Onboarding lists all three separately. A dedicated **Numbers** mode was added for dyscalculia. |
| Bigger fonts and bionic reading are **largely ineffective** — the difficulty is comprehension and decoding, not eyesight. | Bionic reading is demoted to an honestly-labelled comfort option. A new **Comprehension Support** section leads with audio and diagrams. |
| Mind maps only help if they carry **no text**, or if text is **spoken when the cursor reaches it**. | Branches speak on hover *and* on keyboard focus. **Picture mode** strips the prose and moves detail to the voice. |
| Maths must be taught with **countable physical objects inside a story** — apples and bananas, the way special education does it. | **Numbers** mode renders the actual objects on screen, one step at a time, narrated aloud. |
| ADHD needs work made **interesting and gamified** — milestones and points, not long text reports. | A full reward engine: points, levels, streaks, and 11 milestones, summarised as one ring. |
| **Working memory** is impaired; long-term memory is not. | The **parking lot** (`Alt+P`) offloads an interrupting thought from anywhere without losing your place. |
| ~40% also experience anxiety or depression; add **AI listener support** so they can express frustration. | **Listen** — a reflective listener with a hardcoded crisis path and real helplines. |
| Design should be **calm, engaging, gamified**; no evidence for particular colours. | Rewards are quiet by default and can be switched off entirely without losing progress. |

### Read-aloud runs on Sarvam AI

Every "read to me" surface — mind map branches on hover, Numbers step narration, Listen replies,
mode results, document playback — goes through **Sarvam AI's Bulbul TTS** for a natural human
voice, defaulting to the female voice **Priya** on `bulbul:v3`. Thirteen other female voices are
selectable in Settings, each auditioning on click.

This is a functional requirement rather than polish. Audio is the primary accommodation for a
reader whose difficulty is decoding text, and a flat robotic voice is measurably harder to follow —
people simply stop using it. The key lives server-side only; the browser calls `/api/speech` and
never sees it.

Long passages are split on sentence boundaries and **pipelined** — the next clip is fetched while
the current one plays, so the first sentence starts in about a second instead of after the whole
passage has synthesised. Clips are cached on both sides, which matters because hovering across a
map re-requests the same handful of labels constantly.

**Without `SARVAM_API_KEY` everything still works** on the browser's built-in speech synthesis. The
engine says so explicitly (`fallbackToBrowser: true`) and the client switches engines rather than
leaving the user in silence — including mid-passage if Sarvam fails partway through.

### Eleven Indian languages

SETU holds a conversation in **English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi,
Odia, Punjabi, Tamil, and Telugu** — the full set Sarvam Bulbul can speak. One picker in Settings
switches everything at once: mind maps, mode results, the listener, chat replies, and the voice.

Changing only the voice would give you a Hindi speaker reading English sentences, so
`backend/config/languages.js` is the single source of truth for both halves — the Sarvam
`language_code` and the instruction that makes the model answer in that language. Voices are
multilingual, so language and voice stay independent choices.

Two details that matter in practice:

- **Schema enums stay English.** Effort levels, action-item priorities, and the `operation` value
  on each Numbers step are compared as literal strings by the client. A model that helpfully
  translates `"High"` would silently break priority badges and stop objects rendering. The language
  directive forbids translating enum values and JSON keys; the smoke test asserts it.
- **The chunker knows the danda.** `।` and `॥` end sentences in Devanagari, Bengali, Gujarati,
  Gurmukhi, and Odia. Without them a Hindi paragraph reads as one enormous sentence and gets cut
  mid-clause.

App chrome (buttons, menus) stays in English — this changes what SETU *writes and says*, not its
own labels. Full UI localisation is a separate piece of work.

**The crisis script is deliberately not translated.** Running a suicide-risk message through a
translation model is the worst possible place for a subtle error, and nobody here can verify eleven
versions. It stays in English, leads with phone numbers (which need no translation), and notes that
Tele-MANAS answers in 20+ Indian languages and KIRAN in 13. These strings want a professional human
translation before this ships to non-English users.

### Safety note on Listen

Crisis language is detected **server-side before any model call**, and answered from a fixed,
reviewed script carrying Tele-MANAS (14416), KIRAN, AASRA, and an international directory. A crisis
reply is never sampled from a model, never depends on the AI being reachable, and never scores
points. Journal entries are written to a local-only key and are **never** mirrored to MongoDB.

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

# Natural read-aloud voice — https://dashboard.sarvam.ai/
# Optional: without it, read-aloud uses the browser's built-in voice.
SARVAM_API_KEY=your-sarvam-key-here
SARVAM_TTS_SPEAKER=priya
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

The extension works on every site immediately — no reload needed for tabs you
already have open. On first install it opens its options page so you can point
it at the engine (default `http://localhost:3000`); the status pill in the popup
shows whether that connection is live.

The reading tools — bionic text, line focus, reading ruler, reader view, themes,
auto-scroll, browser read-aloud — need no engine at all. Only the AI features
(Commander, the 3-step path, chart descriptions) do.

To package it for the Chrome Web Store:

```bash
cd chrome-extension && node build.js
```

That verifies the manifest's references, parses every shipped script, checks the
icons, and writes `dist/setu-lens-<version>.zip`. See
[`chrome-extension/README.md`](chrome-extension/README.md) for the architecture
and [`chrome-extension/STORE_LISTING.md`](chrome-extension/STORE_LISTING.md) for
the submission checklist.

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

Runs the 32-point automated smoke test verifying health probes, AI model round-trips, database
persistence, all 8 cognitive modes, document OCR, streaming endpoints, Sarvam voice synthesis
across all 11 languages, that Hindi and Tamil responses keep their schema enums in English,
reward-progress merge safety, and that crisis language routes to the fixed helpline script rather
than to a model.

Point it at a non-default port with `SETU_API=http://127.0.0.1:3999 npm run smoke`.

---

## License

Built for Capgemini Hack4Positive 2026.
