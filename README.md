# SETU — the Cognitive Bridge

**From overwhelm to action.**

*Setu* is Sanskrit for *bridge*. SETU is a runtime patch layer for the mismatch between
dense digital interfaces and the working-memory and executive-initiation capacity of the
people using them.

Existing accessibility tools **translate** the interface — read it aloud, enlarge it,
recolour it. None of them **reduce its structural demand** or **produce the next action**.
That gap is what SETU exists to close.

---

## What is built right now

This repository contains **the kernel, the extension, and the agent**. The Sanctuary web
app (ingest, mind maps, Memory Vault, Rewind) and SETU Go (Android) come next.

| Package | What it is | Status |
|---|---|---|
| `packages/core` | **The Cognitive Kernel.** Types, Zod contracts, prompts, router, compute ladder, extraction, PII scrub, Cognitive Load Score, bionic reading, focus-mode sanitiser, Breathe detector, DOM summariser, vault crypto, chunking, outbox. Zero DOM at import time, zero React, zero network. | ✅ complete, 43 tests passing |
| `apps/extension` | **SETU Lens** — Manifest V3 Chrome extension. Focus Mode, the load meter, bionic reading, the Breathe Protocol, the Panic button, START / EXPLAIN / WRITE panels, the COMMANDER agent surface, the Trust Ledger, demo mode. | ✅ complete, builds clean |
| `apps/web` | **SETU Edge** — the API surface *only*. `/api/transform` (the one door), `/api/commander` (the agent planner), `/api/ledger`, `/api/health`. Plus a status page. | ✅ complete, builds clean |
| `evals/` | Golden cases + property assertions + a pass-rate report. | ✅ complete, 16 cases |
| `apps/mobile` | SETU Go | ⏳ not started |
| Sanctuary UI | ingest · mind maps · Rewind · Trust page | ⏳ not started |

> **Why `apps/web` exists when the web app is deferred.** The extension must never hold a
> model provider's API key — anyone can unzip a Chrome extension and read it. So every
> cloud call goes through one server-side door, which is also the only place that enforces
> authentication, rate limits, consent, PII redaction, schema validation and cost
> accounting. `apps/web` today is that door and nothing else.

---

## Three commands to run it

```bash
corepack pnpm install
```

```bash
corepack pnpm --filter @setu/extension build
```

```bash
corepack pnpm --filter @setu/web dev
```

Then load the extension: `chrome://extensions` → **Developer mode** → **Load unpacked** →
`apps/extension/dist`.

> Plain `pnpm` works too if it is on your PATH. `corepack pnpm` is shown because
> `corepack enable` needs administrator rights on Windows and often is not available.

**Focus Mode, bionic reading, the load score and the Breathe Protocol all work with no
server, no key and no network.** That is not a fallback — it is the design (see the
Compute Ladder below). You only need the edge running for START, EXPLAIN, WRITE and
COMMANDER.

---

## Configuration

Copy `.env.example` to `apps/web/.env.local` and fill in what you need:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=     # required for any cloud mode
GROQ_API_KEY=                     # optional fallback rung
SETU_AUTH_MODE=open               # 'open' for the hackathon; 'supabase' once Sanctuary lands
SETU_ALLOWED_EXTENSION_IDS=       # your unpacked extension id, from chrome://extensions
```

Without a key the edge still runs. Cloud modes return an honest error **plus a
deterministic fallback artifact**, so the user never hits a dead end.

⚠️ **Verify the model IDs on day one.** `SETU_MODEL_FLASH` defaults to `gemini-2.5-flash`.
The Build Bible names `gemini-3.5-flash`, which is a placeholder for whatever the current
generation is called — a wrong model ID is a 404 that looks like a bug in your own code
for twenty confusing minutes. All three IDs are env-overridable.

---

## The three rules that govern this build

1. **The Contract Rule.** No AI output enters the UI unless it has passed a schema
   validator. Enforced in `packages/core/src/schemas.ts`, on the server in
   `apps/web/src/server/transform.ts`, **and again on the client** in
   `apps/extension/src/lib/api.ts`. This is why the demo will not embarrass you.
2. **The Ladder Rule.** Every capability degrades downward:
   cloud AI → on-device AI → deterministic code → cached result → honest empty state.
   Nothing has exactly one way of working.
3. **The Artifact Rule.** Every mode produces a checkable, editable, exportable artifact.
   If the output can only be read, it is too vague to win.

---

## The Compute Ladder

The "zero-compute" claim, stated precisely enough to survive a technical judge:

| Rung | What runs there | Cost | Offline | Leaves device |
|---|---|---|---|---|
| **L0** deterministic | Focus Mode · bionic · line guide · **Cognitive Load Score** · Breathe · PII detection · reading grade · chunking | ₹0 | ✅ | ❌ |
| **L1** on-device | Chrome Prompt API (Gemini Nano): EXPLAIN, WRITE, short START | ₹0 | ✅ | ❌ |
| **L2** cloud flash | START (complex) · MEET · EXPLAIN (image) · COMMANDER · GUIDE | free tier | ❌ | ✅ redacted |
| **L3** cloud pro | long-document LEARN | sparing | ❌ | ✅ redacted |

L0 is what a user touches every second of every session. That is where the claim is true,
and saying so precisely is stronger than overclaiming.

**Feature-detect L1 always.** It needs ~22GB free disk and a capable GPU. Assume the
judge's laptop does not qualify — never build a demo step that *requires* it.

---

## The agent, precisely

When a judge asks *"is this really agentic?"*, the wrong answer is "yes, it's all agentic."

| Kind | Where | Loop? | Tools? |
|---|---|---|---|
| **Transformer** | 7 of 9 modes | No — single shot | No |
| **Retriever** | Memory Vault | No — retrieve then transform | No |
| **Agent** | **COMMANDER only** | **Yes** — perceive / act / observe | **Yes** |

COMMANDER's safety rails, all implemented:

1. **The model plans, the human confirms, the browser executes.** Three separate parties,
   in three separate files (`server/commander.ts`, `content/overlays.ts`,
   `content/commander.ts`).
2. **Element ids are a closed set.** The model receives opaque handles (`e12`) from a
   summary *we* generated. It cannot invent `e57` if `e57` was never there, and a single
   invented id invalidates the **entire** plan — we do not drop the bad action and run the
   rest. *Constrain the action space by construction, not by hope.*
3. **Password, OTP and payment fields are stripped at perception time**, before the model
   ever sees the page — then re-checked before every fill.
4. **Irreversible actions need a typed confirmation**, not a click. A click is muscle
   memory; typing is a decision.
5. **Step budget of 6.** Loops terminate.
6. **A structural DOM change mid-run stops execution** and asks to re-plan. That
   re-perceive step is what makes this an actual perceive-act-observe loop rather than a
   batch script.
7. **Esc aborts instantly**, between any two steps.

⚠️ **Scope it honestly on stage.** COMMANDER acts on the *current page only*, with
confirmation. Do not demo "book the flight". Demo *"fill this form with my details"* and
*"take me to the submit button"*, and say plainly that cross-site autonomy is roadmap.

---

## Keyboard

| Keys | Does |
|---|---|
| `Alt+Shift+F` | Toggle Focus Mode |
| `Alt+Shift+Q` | **Panic** — collapse everything to one sentence and one action |
| `Alt+Shift+V` | Voice command (COMMANDER) |
| `Alt+Shift+D` | Toggle demo mode (local fixtures, network fully bypassed) |
| `Esc` | Cancels any overlay, instantly, at every point |

> The Build Bible specifies `Alt+Space` for voice. Windows uses that for the window system
> menu and swallows it before Chrome sees it, so this build uses `Alt+Shift+V`.

---

## Testing and evaluation

```bash
corepack pnpm --filter @setu/core test
```

43 kernel tests. The one that matters most is
`focusMode → NEVER hides an element containing a form control` — without that protection
pass, decluttering eventually hides the submit button on a government form, which is a
catastrophic failure for exactly the user this is built for. **Do not delete that test.**

```bash
corepack pnpm eval
```

Runs 16 golden cases against a live edge and prints a pass-rate table per mode, then names
the failures. Assertions are **properties, not exact strings** — LLM outputs are not
string-stable, and a suite that breaks on a synonym is a suite you will delete on day nine.

Put that table on a slide, *including the failures*. Almost no team measures their own AI;
volunteering your three worst cases is a credibility multiplier on everything else you claim.

---

## Deploying

**SETU Edge → Vercel.** Root directory `apps/web`, install command `pnpm install`.

```bash
pnpm dlx vercel link
pnpm dlx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
pnpm dlx vercel env add SETU_ALLOWED_EXTENSION_IDS production
pnpm dlx vercel --prod
```

Then set the extension's server URL in its Settings page, and add the deployed origin to
the extension's granted hosts.

**SETU Lens → Chrome.**

- *For the demo:* `corepack pnpm ext:build` → Load unpacked. **This is what you demo.**
  Never depend on a store listing on demo day.
- *For the story:* `corepack pnpm ext:zip` → submit to the Web Store. Review takes days to
  weeks; submitting is worth doing so you can say "it's in review" with a screenshot.

CI (`.github/workflows/ci.yml`) typechecks, tests, builds, and **greps the built extension
bundle for provider API keys**, failing the build if one is found.

---

## Honest limitations

Stated here because volunteering them is stronger than being caught:

- **The Cognitive Load Score is a proxy**, derived from WCAG heuristics and cognitive-load
  literature. It is not a clinical instrument. Correlating it with real task-completion
  outcomes is what a pilot study is for.
- **Bionic reading is disputed** at the population level. It ships off by default and
  user-controlled. The claim is user-selected fit, not a universal speed gain.
- **PII redaction is a heuristic net**, not a guarantee. It catches the shapes it knows —
  email, phone, Aadhaar-shaped, PAN-shaped, Luhn-valid cards, IBAN, tokens — and the user
  sees the redacted payload before consenting to send it.
- **The rate limiter is in-memory.** Correct for one instance; swap the `Map` in
  `apps/web/src/server/guards.ts` for Upstash Redis before a multi-instance deploy.
- **The server-side Trust Ledger is not persisted yet** — `/api/ledger` accepts and
  acknowledges but stores nothing until the Supabase tables land. The device-side ledger
  is complete and authoritative. `/api/ledger` says this in its own response rather than
  quietly pretending.
- **The vault crypto is implemented and tested, but nothing calls it yet** — it lands with
  Sanctuary, which is what owns document ingest.

---

## Layout

```
packages/core/src/
  types.ts schemas.ts errors.ts dna.ts ledger.ts cache.ts
  prompts/       constitution + mode briefs + deterministic fallbacks
  router/        resolveMode + chooseTier (the Compute Ladder)
  extract/       readability · blocks · transcripts · PII scrub
  metrics/       ⭐ cls.ts (the Cognitive Load Score) · reading grade
  transform/     ⭐ bionic.ts · sanitize.ts (Focus Mode)
  behaviour/     ⭐ breathe.ts (the overwhelm detector)
  dom/           summarise.ts (the agent's perception)
  vault/         chunk.ts · recall.ts (temporal parsing + RRF)
  crypto/        vault.ts (WebCrypto seal/unseal/KDF)
  sync/          outbox.ts

apps/extension/src/
  background/    the one door: tier selection, ledger, context menus, commands
  content/       focus · bionic · breathe · panic · overlays · commander executor · voice
  sidepanel/     Page · Start · Explain · Write · Commander · Trust
  options/       the DNA profile + 60-second onboarding
  lib/           messages · storage · api · nano (L1) · fixtures (demo mode)

apps/web/src/
  app/api/       transform · commander · ledger · health
  server/        transform (provider chain + repair) · commander (the agent) · guards · cors · env
```

---

*Built against the SETU Master Build Bible v1.0. Capgemini Tech4Positive Futures 2026.*
#   s e t u  
 