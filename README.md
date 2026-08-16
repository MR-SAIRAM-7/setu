<div align="center">

# SETU — The Cognitive Operating System

**A bridge between dense digital worlds and the neurodivergent mind.**

A browser extension that reshapes any website in real time, a redesigned Broadsheet web workspace that turns
any topic into an interactive mind map, and one shared AI engine with MongoDB database persistence behind both.

Built for Capgemini Hack4Positive 2026 · Disability Inclusion & Accessibility

</div>

---

## The three surfaces

| Surface | What it is | Where |
|---|---|---|
| **SETU Lens** | Chrome extension. Rewrites the page you are on — bionic text, line focus, reader view, read-aloud, and an AI agent that navigates the page for you. | `chrome-extension/` |
| **SETU Sanctuary** | Redesigned Broadsheet React workspace. Research any topic into an interactive mind map, 7 cognitive disability tools, 3-step onboarding, command palette, and focus sessions. | `frontend/` |
| **SETU Engine** | The shared AI orchestration layer and MongoDB persistence service both surfaces call. | `backend/` |

---

## Quick start

You need **Node 18+** and one AI key — [OpenRouter](https://openrouter.ai/keys) is the primary
provider, with Google Gemini and OpenAI as direct fallbacks. MongoDB is optional: without it the
web app keeps everything in the browser and the engine keeps working.

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

### 2. Start the engine

```bash
cd backend && npm install && npm start
```

Runs on `http://localhost:3000`.

### 3. Start the workspace

```bash
cd frontend && npm install && npm run dev
```

Opens on `http://localhost:5173`.

### 4. Load the extension

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select the `chrome-extension/` folder

The extension works on every site immediately — no reload needed for tabs you already have open.

---

## Demo data

The web app seeds its own reference library on first run, so the Library and Mind Map screens are
never empty — six researched maps covering WCAG 2.2, the RPwD Act 2016, screen readers, ADHD and
executive function, dyslexia and typeface design, and transformers.

To put the same content plus conversations, uploaded documents, and saved mode outputs into
MongoDB:

```bash
cd backend && npm run seed
```

| Command | Effect |
|---|---|
| `npm run seed` | Upsert the demo set under `demo_user` |
| `npm run seed:reset` | Delete the seeded records, then re-create them |
| `npm run seed:clean` | Delete the seeded records and stop |
| `npm run seed -- --user=<id>` | Seed under a specific user id |

Only records tagged `metadata.seeded` are ever removed, so real data is never touched. To point a
browser at the seeded account, run this in the console and reload:

```js
localStorage.setItem('setu.user.v1', 'demo_user')
```

Settings also has **Restore reference library**, which puts the seeded maps back without disturbing
anything you researched yourself.

---

## Running it as one service

The engine serves the built web app when `frontend/dist` exists, so production can be a single
process:

```bash
cd frontend && npm run build
cd ../backend && npm start
```

Everything is then on `http://localhost:3000` — the SPA at `/`, the API under `/api`. Set
`SERVE_STATIC=false` when the frontend is hosted separately (for example on a CDN).

### Verifying a deploy

```bash
cd backend && npm run smoke
```

Exercises health probes, database persistence, all seven modes, mind map research and expansion,
the SSE chat stream, and the in-page agent. Exits non-zero on any failure, so it can gate a release.

---

## Broadsheet Design System (Sanctuary)

SETU Sanctuary follows the **Broadsheet** newsprint design system tailored for cognitive accessibility:
- **Light by default**: Near-black Source Serif 4 (`#201e1d`) on paper ground (`#f3f2f2`).
- **Four process plate inks**: Cyan (`#0088b0`), Magenta (`#d6006c`), Yellow (`#edbb00`), and Ink (`#201e1d`).
- **Accessible Typography**: Source Serif 4, Atkinson Hyperlegible (for dyslexic readers), and System sans, with Normal (1×), Comfortable (1.1×), and Large (1.22×) scaling.
- **Micro-features**: 3-step onboarding walkthrough, `⌘K` / `Ctrl+K` command palette, 25-minute focus session timer with calm break dialog, staged 3-line research loader, and Lens ↔ Sanctuary handoff banner.

---

## Database Architecture (MongoDB)

SETU integrates with **MongoDB** (via Mongoose ODM) with complete offline/local storage fallback:

| Collection | Model | Purpose |
|---|---|---|
| `mindmaps` | `MindMap` | Hierarchical mind map trees, topics, key facts, sources |
| `conversations` | `Conversation` | Research chat threads and their current topic |
| `messages` | `Message` | Individual turns, with intent, sources, and attachments |
| `documentfiles` | `DocumentFile` | Uploaded files: extracted text, summary, key points |
| `savedsummaries` | `SavedSummary` | Saved outputs from cognitive modes (Simplify, Meet, Write, etc.) |
| `usersettings` | `UserSettings` | Accessibility preferences (profile, font, size, motion) |
| `sessionlogs` | `SessionLog` | Audit logs and interaction records |

Records are scoped by an `x-user-id` header. The web app mints a random id per browser and stores
it in `localStorage` — it identifies a browser, not a person, and carries no personal data. Without
it every visitor would share one library.

---

## Configuration

Everything below is optional; sensible defaults let the app run from a clone.

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Primary provider. Without any key the offline engine is used. |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | — | Direct fallbacks if OpenRouter is unreachable. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/setu` | Persistence. Failure here is non-fatal. |
| `CORS_ORIGINS` | reflect any origin | Comma-separated allow-list. Set it in production. |
| `SERVE_STATIC` | `true` | Serve `frontend/dist` from the API process. |
| `RATE_LIMIT_AI_MAX` | `30` | AI calls per user per minute. |
| `RATE_LIMIT_MAX` | `240` | All other API calls per user per minute. |
| `AI_TIMEOUT_MS` | `60000` | Per-request AI timeout. |

The engine never refuses to start over configuration. Missing keys are reported as warnings at boot
and the affected feature degrades rather than failing.

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Cheap liveness probe (AI + MongoDB status) |
| `/api/health/ai` | GET | Deep AI model round-trip & DB status check |
| `/api/mindmaps` | GET / POST / DELETE | MongoDB mind map persistence |
| `/api/summaries` | GET / POST | MongoDB summaries persistence |
| `/api/settings` | GET / POST / PUT | MongoDB user settings sync |
| `/api/files/upload` | POST | Upload PDF, DOCX, TXT, MD, CSV, JSON, or image (25MB max) |
| `/api/files` | GET | List uploaded documents |
| `/api/files/:id` | GET / DELETE | Fetch or remove one document |
| `/api/files/:id/mindmap` | POST | Build a mind map from an uploaded document |
| `/api/files/:id/query` | POST | Ask a question grounded in one document |
| `/api/conversations` | GET / POST | Chat threads |
| `/api/conversations/:id` | GET / PUT / DELETE | One thread and its messages |
| `/api/chat` | POST | Mind-map chat stream (Server-Sent Events) |
| `/api/research/mindmap` | POST | Non-streaming topic → mind map generator |
| `/api/research/expand` | POST | Grow one node deeper via AI research |
| `/api/start` | POST | Mode 1: Break task freeze (Wall of Awful) |
| `/api/simplify` | POST | Mode 2: Plain language rewrite (Grade 6) |
| `/api/learn` | POST | Mode 3: Study material → outline & self-quiz |
| `/api/meet` | POST | Mode 4: Meeting transcript rescue & jargon decode |
| `/api/practice` | POST | Mode 5: Hard conversation rehearsal scripts |
| `/api/write` | POST | Mode 6: Accessible writing & clarity critique |
| `/api/guide` | POST | Mode 7: Step-by-step workflow with success signals |
| `/api/agent/plan` | POST | In-page navigation planner for Chrome extension |
| `/api/agent/chunk` | POST | Collapse dense page into 3 steps |
| `/api/agent/explain` | POST | Visual & diagram plain-language explanation |

---

## Accessibility Commitments

- WCAG 2.1 AA+ contrast compliance throughout
- Full keyboard navigation including the interactive mind map canvas (`←` collapse, `→` expand/research deeper, `↑`/`↓` navigate nodes)
- Focus is never removed, only styled with accessible 2px cyan outline rings
- `prefers-reduced-motion` and in-app "Keep it still" toggle completely suppress animations
- Atkinson Hyperlegible is offered alongside Source Serif 4 and system sans. Its letterforms
  deliberately differentiate the characters most often confused (`b`/`d`, `I`/`l`/`1`, `O`/`0`).
  We do not ship a "dyslexia font" as a fix: the evidence for those is weak, while the evidence for
  spacing, line length, and letter distinguishability is solid — so the reader picks what works
