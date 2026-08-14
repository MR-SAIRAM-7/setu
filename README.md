<div align="center">

# SETU — The Cognitive Operating System

**A bridge between dense digital worlds and the neurodivergent mind.**

A browser extension that reshapes any website in real time, a web workspace that turns
any topic into an interactive mind map, and one shared AI engine behind both.

Built for Capgemini Hack4Positive 2026 · Disability Inclusion & Accessibility

</div>

---

## The three surfaces

| Surface | What it is | Where |
|---|---|---|
| **SETU Lens** | Chrome extension. Rewrites the page you are on — bionic text, line focus, reader view, read-aloud, and an AI agent that navigates the page for you. | `chrome-extension/` |
| **SETU Sanctuary** | React workspace. Ask about any topic; it researches it and draws an interactive mind map you can expand branch by branch. | `frontend/` |
| **SETU Engine** | The shared AI orchestration layer both surfaces call. | `backend/` |

---

## Quick start

You need **Node 18+** and a free [Google AI Studio](https://aistudio.google.com/) API key.

### 1. Configure

```bash
cp .env.example .env
```

Put your key in `.env`:

```
GEMINI_API_KEY=your_key_here
```

### 2. Start the engine

```bash
cd backend && npm install && npm start
```

Runs on `http://localhost:3000`. Verify with `npm run smoke` in a second terminal — it
exercises every endpoint end to end.

### 3. Start the workspace

```bash
cd frontend && npm install && npm run dev
```

Opens on `http://localhost:5173`.

### 4. Load the extension

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select the `chrome-extension/` folder

The extension works on every site immediately — no reload needed for tabs you already
have open.

---

## What the extension does

**Reading tools** — all composable, run as many at once as you like:

| Tool | Shortcut | What it does |
|---|---|---|
| Bionic Reading | `Alt+B` | Bolds the leading fixation of each word to anchor the eye |
| Line Focus | `Alt+L` | Dims the page and lights only the line you're on, snapped to real text |
| Reading Ruler | `Alt+H` | A highlight that follows your line, word, or paragraph |
| Focus Mode | `Alt+F` | Sanitised reader view — no ads, scripts, or clutter |
| Read Aloud | `Alt+T` | Speech with the spoken word highlighted live |
| Auto Scroll | `Alt+S` | Hands-free scrolling at your words-per-minute |
| Gaze Scroll | `Alt+E` | Webcam head-position tracking scrolls as you read |
| Reading themes | — | Sepia, dark, calm, AAA contrast, and a dyslexia-friendly profile |

**AI features:**

- **SETU Commander** (`Alt+Shift+C`) — say what you want to do on the page; the agent
  reads the live DOM, plans the steps, and executes them one at a time.
- **3-step path** — collapses an overwhelming portal into exactly three calm steps.
- **Explain a chart** — point at any diagram, table, or image for a plain-language read-out.
- **Breathe Protocol** — detects rage-clicking and erratic scrolling, then offers a
  box-breathing pause and to simplify the page.
- **Send to Sanctuary** — hands the page to the web workspace as a mind map.

`Alt+X` turns everything off at once.

---

## What the workspace does

**Mind Map Chat** is the centre of it. Ask about anything in plain language:

> *"How do vaccines actually work?"*

The agent researches the topic, then draws a map you can navigate:

- Click any node to select it; **double-click or press `+`** to research one level deeper
- Collapse branches you have finished with
- Arrow keys move through the whole map — it is fully keyboard navigable
- Follow-up questions are answered against the map already on screen
- Export any map to Markdown

Maps are saved to your **Library**, in your browser only. Nothing is uploaded.

**Modes** holds the seven cognitive tools — Start, Simplify, Learn, Meet, Practice,
Write, and Guide.

---

## Architecture

```
                    ┌──────────────────────────┐
                    │      SETU Engine         │
                    │  Express · Node 18+      │
                    │                          │
                    │  Gemini  →  OpenAI       │
                    │  (model fallback chain)  │
                    └────────────┬─────────────┘
                                 │  JSON schema-enforced responses
                  ┌──────────────┴──────────────┐
                  │                             │
        ┌─────────▼─────────┐         ┌─────────▼─────────┐
        │    SETU Lens      │         │  SETU Sanctuary   │
        │  Manifest V3      │  ─────► │  React 18 · Vite  │
        │  Shadow-DOM UI    │ send to │  Mind map canvas  │
        └───────────────────┘  page   └───────────────────┘
```

**Three design decisions worth knowing:**

1. **Every overlay lives in its own Shadow DOM root.** Hostile page CSS cannot restyle
   SETU, and SETU's CSS cannot leak into the page. This is what makes the extension work
   identically across the whole web rather than on a list of tested sites.

2. **Model names are a chain, not a constant.** A retired model no longer takes the
   product down; the engine walks the chain and caches the first that answers.

3. **Irreversible actions are gated.** The agent runs on banking and government portals.
   Any step that submits, pays, sends, or deletes is flagged server-side and will not
   fire without an explicit click — not even during Auto-Run. The offline fallback
   planner runs through the same safety pass.

### Compute ladder

```
L0  LOCAL          0 ms · fully private · no key needed
    Bionic, line focus, ruler, reader view, auto scroll, themes, TTS

L1  ENGINE         ~1-3 s · structured JSON
    Seven modes, page agent, task chunking, explanations

L2  RESEARCH       ~10-20 s · grounded when quota allows
    Topic research → mind map, node expansion, vision breakdown
```

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness + whether a key is configured |
| `GET /api/health/ai` | Live model round-trip |
| `POST /api/chat` | Mind-map chat (Server-Sent Events) |
| `POST /api/research/mindmap` | Topic → mind map |
| `POST /api/research/expand` | Grow one node deeper |
| `POST /api/agent/plan` | Goal + page snapshot → action plan |
| `POST /api/agent/chunk` | Dense page → 3 steps |
| `POST /api/agent/explain` | Plain-language explanation, any language |
| `POST /api/agent/describe-image` | Chart / diagram description |
| `POST /api/{start,simplify,learn,meet,practice,write,guide}` | The seven modes |
| `POST /api/summarize`, `POST /api/export` | Utilities |

Every AI endpoint degrades to a deterministic local result if the model is unreachable,
and says so via `fallback: true` and `fallbackReason` — it never silently substitutes.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | Primary provider ([free key](https://aistudio.google.com/)) |
| `OPENAI_API_KEY` | — | Optional fallback provider |
| `GEMINI_MODEL` | auto | Pin a model instead of using the chain |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for the OpenAI path |
| `PORT` | `3000` | Engine port |
| `AI_TIMEOUT_MS` | `45000` | Per-request timeout |
| `AI_MAX_RETRIES` | `2` | Retries per provider |

**Note on the free tier:** Gemini's free tier allows 20 requests/minute and does not
include Google Search grounding quota. Research still works from model knowledge, and
maps are labelled `model knowledge` rather than showing sources, so nothing implies
rigour it does not have. A paid key enables grounded research with citations.

---

## Accessibility

- WCAG 2.1 AA+ contrast throughout; a AAA high-contrast theme is included
- Full keyboard navigation, including the mind map canvas
- Focus is never removed, only restyled
- `prefers-reduced-motion` respected across both surfaces
- Every control has an accessible name; live regions announce state changes
- OpenDyslexic typeface and three text sizes in Settings
