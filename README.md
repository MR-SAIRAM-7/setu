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

You need **Node 18+** and a free [Google AI Studio](https://aistudio.google.com/) API key. MongoDB is supported for cloud/local persistence with seamless local browser fallback.

### 1. Configure

```bash
cp .env.example .env
```

Put your key and optional MongoDB URI in `.env`:

```env
GEMINI_API_KEY=your_key_here
MONGODB_URI=mongodb://127.0.0.1:27017/setu
```

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
| `savedsummaries` | `SavedSummary` | Saved outputs from cognitive modes (Simplify, Meet, Write, etc.) |
| `usersettings` | `UserSettings` | Accessibility preferences (profile, font, size, motion) |
| `sessionlogs` | `SessionLog` | Audit logs and interaction records |

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Cheap liveness probe (AI + MongoDB status) |
| `/api/health/ai` | GET | Deep AI model round-trip & DB status check |
| `/api/mindmaps` | GET / POST / DELETE | MongoDB mind map persistence |
| `/api/summaries` | GET / POST | MongoDB summaries persistence |
| `/api/settings` | GET / POST / PUT | MongoDB user settings sync |
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
- Atkinson Hyperlegible and OpenDyslexic letterforms to eliminate letter flipping
