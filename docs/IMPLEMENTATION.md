# SETU — Implementation Reference

**Version 0.9.0 · 8 August 2026**
Everything that is built, how each piece works, how to run it, and what it does.

This is the deep reference. For the short version see [`README.md`](../README.md); for the
pitch see [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md) and [`JUDGE_QA.md`](JUDGE_QA.md).

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [What is built and what is not](#2-what-is-built-and-what-is-not)
3. [Architecture](#3-architecture)
4. [How to run it](#4-how-to-run-it)
5. [Functionality reference](#5-functionality-reference)
6. [The Cognitive Kernel, module by module](#6-the-cognitive-kernel-module-by-module)
7. [SETU Lens — the extension](#7-setu-lens--the-extension)
8. [SETU Edge — the agent backend](#8-setu-edge--the-agent-backend)
9. [Data flows, traced](#9-data-flows-traced)
10. [Testing and evaluation](#10-testing-and-evaluation)
11. [Deployment](#11-deployment)
12. [Verification log](#12-verification-log)
13. [Known limitations](#13-known-limitations)
14. [Complete file inventory](#14-complete-file-inventory)

---

## 1. What this is

*Setu* is Sanskrit for **bridge**.

The problem in one sentence:

> Dense digital interfaces impose a load that exceeds the working-memory and
> executive-initiation capacity of 15–20% of users. Existing tools **translate** the
> interface — read it aloud, enlarge it, recolour it — but do not **reduce its structural
> demand** or **produce the next action**. The gap is not perception. The gap is load and
> initiation.

SETU is a runtime patch layer for that mismatch. It rewrites the structure of live
interfaces on the user's own machine, measures the reduction as a number, and terminates
in a concrete first action.

The entire product is one function, implemented once and imported by every surface:

```ts
transform(artifact: Artifact, mode: Mode, dna: DNAProfile, ctx: Context)
  → Promise<Result<TransformArtifact>>
```

Three surfaces × nine modes would be 27 implementations built naively. With a shared
kernel it is 9 implementations plus thin renderers.

### The three rules

1. **The Contract Rule.** No AI output enters the UI unless it has passed a schema
   validator. If it cannot be validated, it cannot be rendered.
2. **The Ladder Rule.** Every capability degrades downward: cloud AI → on-device AI →
   deterministic code → cached result → honest empty state. Nothing has exactly one way of
   working.
3. **The Artifact Rule.** Every mode produces a checkable, editable, exportable artifact.
   Prose cannot be verified; artifacts can.

---

## 2. What is built and what is not

### Built

| Component | Package | State |
|---|---|---|
| **The Cognitive Kernel** | `packages/core` | Complete. 43 tests passing. |
| **SETU Lens** (Chrome MV3 extension) | `apps/extension` | Complete. Builds clean. |
| **SETU Edge** (agent backend, API only) | `apps/web` | Complete. Builds clean. |
| **Evaluation harness** | `evals/` | Complete. 16 golden cases, 5 assertion suites. |
| **CI** | `.github/workflows/ci.yml` | Typecheck · test · build · API-key leak scan. |

### Not built yet

| Component | Why it is deferred |
|---|---|
| **Sanctuary UI** — ingest, mind maps, Rewind, Trust page | Deferred by explicit scoping decision. `apps/web` today is the API surface only. |
| **SETU Go** — Android app | Same. The kernel is already surface-agnostic, so this is renderers, not re-implementation. |
| **Supabase persistence** | The DB schema is specified in the Build Bible §14 but no migration is applied. `SETU_AUTH_MODE=open` runs without it. |
| **LEARN / MEET / PRACTICE / GUIDE panels** | The schemas, prompts and fallbacks all exist in the kernel and the edge will serve them today. Only their *renderers* are missing, and their natural home is Sanctuary. |

> **Why `apps/web` exists when the web app is deferred.** The extension must never hold a
> model provider's API key — anyone can unzip a Chrome extension and read it. Every cloud
> call therefore goes through one server-side door, which is also the only place that
> enforces authentication, rate limits, consent, PII redaction, schema validation and cost
> accounting. `apps/web` today is that door and a status page, nothing more.

---

## 3. Architecture

```
┌───────────────────────────── USER'S BROWSER ──────────────────────────────┐
│                                                                           │
│  SETU LENS (Manifest V3)                                                  │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ content script      │  │ service worker   │  │ side panel + options │  │
│  │  DOM sanitiser  L0  │  │  the one door    │  │  React 18            │  │
│  │  bionic         L0  │◄─┤  tier selection  ├─►│  Page/Start/Explain  │  │
│  │  CLS meter      L0  │  │  Trust Ledger    │  │  Write/Commander/    │  │
│  │  breathe sensor L0  │  │  Prompt API  L1  │  │  Trust               │  │
│  │  commander exec     │  │  context menus   │  │  DNA onboarding      │  │
│  └─────────────────────┘  └────────┬─────────┘  └──────────────────────┘  │
│                                    │                                      │
│  ┌─────────────────────────────────▼──────────────────────────────────┐   │
│  │   @setu/core — the Cognitive Kernel (shared TypeScript package)     │   │
│  │   types · zod schemas · prompts · CLS · readability · bionic ·      │   │
│  │   breathe · PII · dom summary · crypto · chunking · router          │   │
│  └─────────────────────────────────┬──────────────────────────────────┘   │
└────────────────────────────────────┼──────────────────────────────────────┘
                                     │ HTTPS · bearer or device id
                                     │ ALL cloud traffic, one door
┌────────────────────────────────────▼──────────────────────────────────────┐
│  SETU EDGE  (Next.js 15 route handlers)                                   │
│    /api/transform   router → provider chain → validate → repair → cache   │
│    /api/commander   the agent planner → harden → refuse or plan           │
│    /api/ledger      Trust Ledger mirror                                   │
│    /api/health      capability probe                                      │
│  guards: identity · rate limit · consent · PII scrub · CORS allowlist     │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │  Gemini 2.5 Flash / Lite/Pro │
                      │  Groq (fallback rung)        │
                      └──────────────────────────────┘
```

### The one-door rule

Every arrow leaving a user device converges on the edge. Not for elegance — because it
gives exactly one place to enforce every cross-cutting concern. In a short build, one door
is the difference between a system you can reason about and a system that surprises you.

### The Compute Ladder

The "zero-compute" claim, stated precisely enough to survive a technical judge:

| Rung | What runs there | Cost | Offline | Leaves device |
|---|---|---|---|---|
| **L0** deterministic | Focus Mode · bionic · line guide · **Cognitive Load Score** · Breathe · PII detection · reading grade · chunking · DOM summary | ₹0 | ✅ | ❌ |
| **L1** on-device | Chrome Prompt API (Gemini Nano): EXPLAIN, WRITE, short START | ₹0 | ✅ | ❌ |
| **L2** cloud flash | START (complex) · MEET · EXPLAIN (image) · **COMMANDER** · GUIDE | free tier | ❌ | ✅ redacted |
| **L3** cloud pro | long-document LEARN | sparing | ❌ | ✅ redacted |

L0 is what a user touches every second of every session. That is where the claim is true.
Selection logic is in [`packages/core/src/router/tier.ts`](../packages/core/src/router/tier.ts).

The ladder's ordering is deliberate: the `cloudAI: 'never'` branch sits **above** every
other consideration, so no amount of "but it would work better in the cloud" can override
a user who said no.

---

## 4. How to run it

### Prerequisites

- Node **≥ 20.11** (developed on 24.16)
- pnpm 9 — via `corepack pnpm` if pnpm is not on your PATH
- Chrome **≥ 114**

> **On this machine, use `corepack pnpm`.** `corepack enable` needs administrator rights
> and fails without them, so there is no `pnpm` binary on PATH. Every root script routes
> through `scripts/workspace.mjs`, which re-invokes via `npm_execpath` and therefore works
> either way. Plain `pnpm` is fine wherever it is installed normally.

### First run

```bash
corepack pnpm install
```

```bash
corepack pnpm build
```

Then load the extension:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select `apps/extension/dist`
4. The DNA onboarding page opens automatically — it takes under a minute

**At this point Focus Mode, bionic reading, the load score, the line guide, Breathe and the
Panic button all work.** No server, no API key, no account, no network. That is the design,
not a degraded mode.

### Adding the cloud modes

START, EXPLAIN, WRITE and COMMANDER need the edge running.

```bash
cp .env.example apps/web/.env.local
```

Fill in at minimum:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
SETU_ALLOWED_EXTENSION_IDS=your-extension-id-from-chrome-extensions
```

```bash
corepack pnpm edge:dev
```

Then in the extension: **Settings → Connection → Test the connection**. It should report
which engines are available.

Without a key the edge still starts, and cloud modes return an honest error **plus a
deterministic fallback artifact** — the user never hits a dead end.

### Every command

| Command | Does |
|---|---|
| `corepack pnpm install` | Install all workspaces |
| `corepack pnpm build` | Build everything |
| `corepack pnpm typecheck` | Typecheck all three packages |
| `corepack pnpm test` | Kernel test suite (43 tests) |
| `corepack pnpm ext:build` | Build the extension only |
| `corepack pnpm ext:zip` | Build + package `setu-lens.zip` for the Web Store |
| `corepack pnpm edge:dev` | Run the edge on `:3000` |
| `corepack pnpm edge:build` | Production build of the edge |
| `corepack pnpm eval` | Run 16 golden cases against a live edge, print pass rates |
| `corepack pnpm dev` | Extension watch build + edge dev server, in parallel |

---

## 5. Functionality reference

### 5.1 FOCUS — "make this page survivable"

**Trigger:** `Alt+Shift+F`, the panel button, or an accepted Breathe offer.
**Tier:** L0 — fully deterministic, zero network, zero AI, zero cost.

Hides ads, cookie banners, popups, carousels, social widgets, sidebars, navigation and
footers; pauses autoplaying media; kills animation; constrains the reading column to 66
characters; applies DNA typography.

**The protection pass is the important part.** Before removing anything, it walks *up* from
every form control, label, deadline, alert and submit button, marking all ancestors as
protected. Without it, decluttering eventually hides the submit button on a government
form — a catastrophic failure for exactly the user this is built for.

Elements are **hidden, never deleted**, so undo always works. Nothing over 4,000 characters
of text is hidden regardless of its class name, because a container that large is the
article.

→ [`packages/core/src/transform/sanitize.ts`](../packages/core/src/transform/sanitize.ts)

### 5.2 The Cognitive Load Score

**Trigger:** automatic on page load, and recomputed after every transformation.
**Tier:** L0. Reports its own timing — typically 20–60 ms.

Turns accessibility impact into a number, 0 (calm) to 100 (overwhelming), from six weighted
axes:

| Axis | Weight | Measures |
|---|---|---|
| structural | 0.22 | node count, nesting depth |
| textual | 0.24 | sentence length, Flesch–Kincaid grade, character density |
| visual | 0.14 | distinct fonts, colours, sizes competing for attention |
| motion | 0.16 | animations, transitions, autoplay, carousels |
| decision | 0.16 | interactive elements above the fold |
| interruption | 0.08 | fixed/sticky overlays, iframes |

Each axis is passed through a saturating normaliser `sat(x, mid) = 100x/(x+mid)`, where
`mid` is the value considered "moderately bad" for that signal. The weights sum to exactly
**1.000**, so the score is bounded 0–100 by construction — there is a test asserting it.

The badge on the toolbar icon shows the live score. `topContributors` renders the three
worst axes in plain words: *"visual clutter, too many choices at once, popups and sticky
bars."*

**Honest caveat, stated before anyone asks:** CLS is a *proxy* for interface demand,
derived from WCAG heuristics and cognitive-load literature. It is not a clinical
instrument. Correlating it with real task-completion outcomes is what a pilot study is for.

→ [`packages/core/src/metrics/cls.ts`](../packages/core/src/metrics/cls.ts)

### 5.3 Bionic reading + line guide

**Trigger:** DNA profile toggle. **Off by default.**
**Tier:** L0.

Bolds the first *k* characters of each word as a fixation anchor, where *k* depends on word
length and a 0–3 intensity. Two invariants hold for every input: it never returns the whole
word length (which would defeat the purpose), and never returns 0 for words of 2+
characters. Both are tested across lengths 1–20 at every intensity.

Mutations are batched into `DocumentFragment`s so the browser reflows once per text node
rather than once per word — that is why it stays under 80 ms on a long article.

**⚠️ Accessibility position:** independent studies of bionic-style reading show mixed
results for reading speed at the population level. The claim here is *user-selected fit*,
not a universal speed gain. It ships off and fully user-controlled.

`bionicTokens()` is a pure-string variant with no DOM dependency — the same function will
render in React Native unchanged. That is the proof of the kernel.

→ [`packages/core/src/transform/bionic.ts`](../packages/core/src/transform/bionic.ts)

### 5.4 The Breathe Protocol

**Trigger:** behavioural, or `Trigger the pause offer now` in the panel's demo controls.
**Tier:** L0. Nothing is stored. Nothing is transmitted.

Five signals from pointer, scroll and click events in a 30-second ring buffer: pointer
jerk, scroll reversals, repeat clicks, dwell fragments, backtracks. Each is z-scored
against **that user's own rolling baseline** (Welford's online variance) — never a
population norm — then combined and smoothed with an EWMA so a single spike cannot fire it.

**The ethics rules are hard-coded, not configuration:**

- Never fires in the first 20 seconds on a page — "you look stressed" as a greeting is
  the wrong product
- Never more than once per 5 minutes; never more than 3 times per hour
- Never while a password/tel/number field has focus
- Never during video playback
- Two dismissals in a row drop the sensitivity one notch automatically
- Sensitivity 0 sets the threshold to `Infinity` — provably never fires
- Hysteresis: arms at the threshold, disarms 0.6 below it

**The overlay:** the page dims, a circle expands 4s → holds 4s → contracts 4s with the
words *in… hold… out*, and **only then** does the offer appear. Leading with a question is
what every other nudge product does and it is the wrong order for someone already at the
edge. `prefers-reduced-motion` replaces the animation with a static panel. `Esc` cancels
everything instantly.

**The wording is the feature.** The overlay says *"This page looks intense."* The word
"detected" never appears. SETU comments on the **page**, never on the **person**. That
distinction is the entire ethics of the feature and it is worth saying out loud.

→ [`packages/core/src/behaviour/breathe.ts`](../packages/core/src/behaviour/breathe.ts),
[`apps/extension/src/content/overlays.ts`](../apps/extension/src/content/overlays.ts)

### 5.5 The Panic button

**Trigger:** `Alt+Shift+Q` from anywhere.
**Tier:** L0.

The entire page collapses to a single card: one sentence saying where you are, and one
button for the most likely next action. Everything else goes away. `Esc` brings the page
back.

The "most likely next action" is a deliberate heuristic — it scores visible controls,
rewarding submit/continue/next/apply/register/pay/save and penalising
cancel/close/back/reject/logout.

This is the crudest feature in the product and it may be the most loved. When someone is at
the edge of overwhelm they cannot navigate a menu of helpful features. They need one key
that makes everything stop.

### 5.6 START — "I can't begin"

**Trigger:** panel, or right-click a selection → *I am stuck — break this into steps*.
**Tier:** L1 if Nano is available and the task is short, otherwise L2.

Produces a `StartResult`: the task restated calmly, at most **one** clarifying question,
a first action doable in under 10 minutes **today**, 3–7 micro-steps each with minutes /
effort / anxiety, an encouragement line, and an escape hatch that re-chunks smaller.

The panel's most prominent element is not the plan — it is the single first action, because
the gap was never knowledge, it was the translation of intent into a first physical action.

Anxiety ratings describe the **step**, never the person. Checkbox state is user-owned and
never overwritten by a re-render.

### 5.7 EXPLAIN — "what does this even mean"

**Trigger:** select text → right-click → *Explain this with SETU*, or the panel.
**Tier:** L1 for text, L2 for images.

Produces an `ExplainResult`: a plain-language definition at the DNA reading level, an
everyday analogy from the user's locale, "why this matters to you", optional procedure
steps, and a **vernacular translation** with text-to-speech.

Includes the **Reading Level Dial** — four positions (simple / plain / standard /
technical). Changing it re-runs at the new level, so the same content visibly re-renders.

This is the multilingual moment: selecting English legalese and hearing it explained in
Hindi or Tamil with a local analogy.

### 5.8 WRITE — "I can't get this out clearly"

**Trigger:** select text → right-click → *Rewrite this with SETU*, or the panel.
**Tier:** L1 preferred.

Produces a `WriteResult`: a rewrite, reading grade before/after, and every change listed
with its kind (passive / long-sentence / jargon / ambiguous / tone) and its reason.

Presented as an **accept/reject diff**, never a silent replacement. Each change can be
rejected individually. You are reducing friction, not rewriting someone's personality.

### 5.9 COMMANDER — the agent

Covered in full in [§9.2](#92-commander-the-agent-loop). Summary: the model plans, the
human confirms, the browser executes; element ids are a closed set; sensitive fields never
reach the model; step budget of 6; a structural page change stops the run.

### 5.10 The Trust Ledger

**Tier:** L0. Lives in `chrome.storage.local`, capped at 500 entries.

Every action SETU takes writes one row: when, which mode, which tier, which provider, how
many bytes left the device, and how many PII spans were redacted first.

**The design decision that makes it credible:** L0 and L1 rows are logged too, carrying a
green **"never left your device"** badge. A ledger that lists only cloud calls is a list of
accusations. A ledger that lists everything is a proof.

> "Most products put privacy in a policy. We put it in a log the user can read."

The header sentence is generated: *"47 actions. 41 ran entirely on this device (87%). 6 sent
2.3 KB of redacted text to a model, with 12 personal details removed first."*

### 5.11 The DNA profile

**Trigger:** first install (auto-opens), or the Settings page.
**Tier:** L0. Stored locally first, always.

A three-step onboarding under 60 seconds:

1. **"Which of these feels most like you?"** — four experience cards, multi-select:
   *I lose my place when reading* / *I can't get started* / *Busy pages overwhelm me* /
   *I forget what I was doing*
2. **A live preview** of the same paragraph re-rendering as bionic and spacing toggle —
   the user picks by **seeing**, not by reading settings names
3. **Language** and **cloud AI consent** (*Ask me each time* / *Yes* / *Never*)

It never asks "do you have ADHD?" SETU holds no opinion about whether a user has a
condition — only a record of what they said works for them. This is both an ethics
requirement and a legal one: inferred health data is special-category data under GDPR
Art. 9 and India's DPDP Act.

**Being signed out must never break Focus Mode.** The profile lives in local storage first
and syncs opportunistically, never the reverse. The person who most needs the calm page is
the person least able to complete a login flow.

→ [`packages/core/src/dna.ts`](../packages/core/src/dna.ts),
[`apps/extension/src/options/App.tsx`](../apps/extension/src/options/App.tsx)

### 5.12 Demo mode

**Trigger:** `Alt+Shift+D`, or the Settings toggle.

Every result renders from a local fixture in
[`apps/extension/src/lib/fixtures.ts`](../apps/extension/src/lib/fixtures.ts). The network
is bypassed entirely. The toolbar badge reads `DEMO` so you can never be in it by accident.

All fixtures are schema-valid by construction — the kernel test suite parses each of them
through `SCHEMA_BY_MODE`, so a fixture can never be the thing that breaks a demo.

### 5.13 PII redaction

**Tier:** L0, runs client-side **before** anything is transmitted, then again on the server.

Detects and replaces with typed placeholders (`⟦EMAIL_1⟧`): email addresses, Indian and
international phone numbers, Aadhaar-shaped 12-digit numbers, PAN-shaped codes,
Luhn-validated card numbers, IBAN, dates of birth, and API-key-shaped tokens.

Identical values receive the **same** placeholder, so the model can still reason about "the
same person appearing twice" without ever seeing who they are. After the model returns,
`rehydrate()` walks the entire result structure and puts the real values back.

The consent dialog shows the user the redacted payload and a plain-language summary —
*"3 items will be hidden before sending: 1 email address, 2 phone numbers"* — before they
agree to anything.

→ [`packages/core/src/extract/pii.ts`](../packages/core/src/extract/pii.ts)

---

## 6. The Cognitive Kernel, module by module

`packages/core` has three hard constraints: **zero DOM access at import time** (it loads
inside a service worker), **zero React**, **zero network**. Everything DOM-related is
inside a function that takes a `Document`.

| Module | Exports | Purpose |
|---|---|---|
| `types.ts` | `Artifact`, `Mode`, `DNAProfile`, `Context`, `Result`, `ComputeTier`, `DEFAULT_DNA` | The five kernel types. `ComputeTier` is declared here and imported by `router/tier.ts` — the reverse creates a circular import that bundlers resolve inconsistently. |
| `schemas.ts` | 9 Zod schemas, `SCHEMA_BY_MODE`, `buildTree` | The Contract Layer. Every `.describe()` becomes an instruction the model sees attached to the exact field it governs. |
| `errors.ts` | `SetuError`, `toSetuError` | Every error carries a `nextAction`. An error with no next action is a bug, not an error. |
| `dna.ts` | `dnaFromCards`, `normaliseDNA`, `mergeDNA` | Onboarding card → settings mapping. `normaliseDNA` merges over defaults so an old stored profile never produces `undefined` in a renderer. |
| `ledger.ts` | `newLedgerEntry`, `summariseLedger`, `describeLedger` | Trust Ledger types and its human-readable summary. |
| `cache.ts` | `cacheKey`, `createMemoryCache` | `sha256(mode｜dnaFingerprint｜contentHash)`. The fingerprint includes only fields that change *output* — not `fontStack`, which changes rendering. That distinction roughly doubles the hit rate. |
| `router/index.ts` | `resolveMode` | Mode selection: explicit > utterance keyword > artifact shape. **No LLM call in the happy path** — a classifier that costs 800 ms before the real work is a bad trade for a user whose problem is that waiting feels impossible. |
| `router/tier.ts` | `chooseTier`, `describeTier` | The Compute Ladder. Every branch is tested. |
| `prompts/index.ts` | `CONSTITUTION`, `MODE_BRIEF`, `buildSystem` | Three layers composed at call time. Never write a prompt inline in a route handler. |
| `prompts/fallbacks.ts` | `deterministicFallback` | String-template artifacts for all nine modes. They call nothing and cannot fail. |
| `extract/readability.ts` | `extractContent`, `findMainContent` | Dependency-free main-content scoring. No jsdom, because that would break two of the four target runtimes. |
| `extract/pii.ts` | `redactPII`, `rehydrate`, `luhn` | §5.13. |
| `extract/transcript.ts` | `normaliseTranscript` | `.vtt`/`.srt`/plain → clean text + speakers. |
| `metrics/cls.ts` | `computeCLS`, `computeTextCLS`, `describeCLS` | §5.2. |
| `metrics/readability-grade.ts` | `fleschKincaidGrade`, `countSyllables` | Clamped 0–20; grade-40 outliers are noise, not signal. |
| `transform/bionic.ts` | `fixationLength`, `applyBionic`, `bionicTokens` | §5.3. |
| `transform/sanitize.ts` | `focusMode`, `undoFocus` | §5.1. |
| `behaviour/breathe.ts` | `BreatheDetector`, `SignalCollector`, `RunningStats` | §5.4. The detector is pure and testable without a DOM; the collector handles browser events. |
| `dom/summarise.ts` | `summariseDom`, `resolveElement`, `isSensitiveField` | The agent's perception. §9.2. |
| `vault/chunk.ts` | `chunk`, `embeddableText` | Structural splitting with heading-path prefixes — that single trick improves retrieval more than any embedding-model upgrade. |
| `vault/recall.ts` | `parseTemporal`, `hasStrongTopic`, `rrf` | Temporal query parsing and Reciprocal Rank Fusion. |
| `crypto/vault.ts` | `deriveKEK`, `seal`, `unseal`, `sha256Hex` | WebCrypto, PBKDF2 600k iterations. Implemented and tested; wired up when Sanctuary lands. |
| `sync/outbox.ts` | `flush`, `createOutbox` | Offline queue, replayed in order, deduped on `clientId`, parked after 5 tries. |

---

## 7. SETU Lens — the extension

### 7.1 Manifest and permissions

```json
"permissions": ["activeTab", "scripting", "storage", "sidePanel", "contextMenus", "tts"],
"host_permissions": ["http://localhost:3000/*"],
"optional_host_permissions": ["http://*/*", "https://*/*"]
```

**There is deliberately no static `content_scripts` block.** A statically declared
`<all_urls>` entry triggers Chrome's *"read and change all your data on all websites"*
install warning, which directly undercuts the privacy story. Instead:

- **On-demand injection** via `activeTab` when the user explicitly acts
  (`ensureContent(tabId)` pings first, then injects only if there is no reply)
- **Persistent registration** via `chrome.scripting.registerContentScripts` only for
  origins the user has granted, offered as *"Always allow example.edu"* in the panel

This is slower to demo by two clicks and much stronger in the privacy conversation.

### 7.2 Build pipeline

Two Vite passes, because **a statically declared MV3 content script cannot be an ES
module** — bundling both in one pass is the most common way this build breaks.

| Pass | Config | Output | Format |
|---|---|---|---|
| 1 | `vite.config.ts` | `background.js`, `sidepanel.html/js`, `options.html/js`, `assets/*` | ES modules |
| 2 | `vite.content.config.ts` | `content.js` | IIFE, `emptyOutDir: false` |
| 3 | `scripts/postbuild.mjs` | `manifest.json`, `content.css`, `icons/*.png` | — |

`postbuild.mjs` also **generates the PNG icons** — a rounded square with a bridge arch,
written with a ~40-line PNG encoder using Node's zlib. Committing binaries would raise a
"where did this come from" question at review time; generating them keeps the repo
diffable. It then asserts all six required files exist and fails the build otherwise.

Built size: `content.js` 95 KB (27 KB gzip), `background.js` 13 KB, side panel 25 KB.

### 7.3 Source layout

| Path | Role |
|---|---|
| `src/background/index.ts` | The one door. Tier selection, PII redaction, ledger writes, context menus, commands, injection, auth handoff. |
| `src/content/index.ts` | Entry. Init, CLS, DNA application, Breathe wiring, message handling, SPA MutationObserver. |
| `src/content/overlays.ts` | Breathe, Panic, plan confirmation, corner suggestion, spotlight, line guide. All inside one shadow root. |
| `src/content/commander.ts` | The plan executor. |
| `src/content/voice.ts` | Web Speech, one utterance, Esc-cancellable. |
| `src/content/setu.css` | All injected styles, `@layer setu`-scoped. |
| `src/lib/messages.ts` | The fully-typed message bus. |
| `src/lib/storage.ts` | DNA, ledger, settings, consent, pending jobs. |
| `src/lib/api.ts` | Edge client. Re-validates every response against the schema. |
| `src/lib/nano.ts` | L1 via the Chrome Prompt API, with feature detection. |
| `src/lib/jsonschema.ts` | ~90-line Zod → JSON Schema converter for Nano's `responseConstraint`. Avoids shipping a dependency to every user's browser. |
| `src/lib/fixtures.ts` | Demo-mode fixtures. |
| `src/sidepanel/` | React 18 panel: Page, Start, Explain, Write, Commander, Trust. |
| `src/options/` | DNA onboarding + full settings. |
| `src/ui/` | Shared renderers and design tokens. |

### 7.4 SPA survival

A debounced (400 ms) `MutationObserver` re-applies Focus Mode hiding and bionic anchors on
route changes, and recomputes CLS when the path changes. It ignores mutations originating
inside `[data-setu-skip]` — otherwise it observes its own overlays and loops forever.
`data-setu-*` attributes guard against double-application.

Without this, SETU silently stops working on React sites, and half the web is a React site.

### 7.5 Accessibility of SETU itself

An accessibility product is judged on whether it is itself accessible.

- Minimum touch target 44×44 px throughout
- Focus ring `3px solid`, `outline-offset: 2px`, never `outline: none`
- Meaning never carried by colour alone — every badge carries its own word
- `prefers-reduced-motion` honoured globally, including the Breathe animation
- Tabs use real `role="tablist"` / `aria-selected` / `aria-controls`
- The CLS number is announced in words to screen readers, not left as a bare digit
- The panel applies the user's own DNA settings to itself
- `Esc` closes every overlay from every state

---

## 8. SETU Edge — the agent backend

### 8.1 Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/transform` | The one door. All nine modes, schema-validated, with repair and fallback. |
| `POST /api/commander` | The agent planner. Returns a plan; never executes anything. |
| `POST /api/ledger` | Trust Ledger mirror. Accepts and acknowledges; persistence lands with Sanctuary, and the response says so. |
| `GET /api/health` | Capability probe. Reveals *which* providers are configured, never any configuration. |

All four handle `OPTIONS` preflight.

### 8.2 Guards, in order

1. **Identity** — `SETU_AUTH_MODE=open` uses a per-install device id as the rate-limit
   bucket; `supabase` requires a verified bearer token. Flipping the mode touches no route
   handler.
2. **Rate limit** — in-memory token buckets, 30/min and 300/day per identity.
3. **Mode validation** — an unknown mode is a 400, not a crash.
4. **Size limits** — 200,000 characters, 6 MB images.
5. **Consent** — the client is the primary gate (it shows the redacted payload); this is
   the independent second check. Returns **428 Precondition Required**.
6. **PII redaction** — again, server-side. The extension already redacted; doing it twice
   means a request from any other client is held to the same standard.
7. **Cache** — `sha256(mode｜dnaFingerprint｜contentHash)`.

### 8.3 The provider chain

```
L3 request → gemini-2.5-pro (120k words)
             ↓ on failure
             gemini-2.5-flash (30k words)
             ↓
             gemini-2.5-flash-lite (12k words)
             ↓
             groq llama-3.3-70b (8k words, no vision)
             ↓
             deterministicFallback()  ← cannot fail
```

Within each rung: one attempt, then **one repair attempt** with a suffix explaining that
the previous response did not match the structure. A schema miss earns a repair at the same
rung (the model understood the task and got the shape wrong); a provider error moves down
immediately.

Rather than *skipping* a rung whose context window is too small, the input is **truncated to
it** at a sentence boundary. A slightly shorter input beats no answer.

`temperature: 0.2` for every structural mode. **Determinism is an accessibility
requirement, not a technical convenience** — for a user with ADHD or autism, an interface
that behaves differently each time forces re-learning on every use, which is precisely the
cost SETU exists to remove. PRACTICE is the one mode at 0.7, because variation is its point.

### 8.4 CORS

Allowlisted, never `*`. `SETU_ALLOWED_EXTENSION_IDS` holds the permitted extension ids; an
unlisted origin receives no `Access-Control-Allow-Origin` header at all. In development any
`chrome-extension://` origin is permitted, because the id changes on every unpacked reload
and hard-coding it would mean editing an env var twenty times a day — that branch is
unreachable in production.

---

## 9. Data flows, traced

### 9.1 A transform (START, EXPLAIN, WRITE)

```
 panel                  service worker              edge                   model
   │                          │                       │                      │
   ├─ start(req) ────────────►│                       │                      │
   │  redactPII → preview     │                       │                      │
   │  ◄─ consent dialog       │                       │                      │
   │     (user sees exactly   │                       │                      │
   │      what will be sent)  │                       │                      │
   ├─ TRANSFORM ─────────────►│                       │                      │
   │                          ├─ chooseTier()         │                      │
   │                          │   L1? → Prompt API ───┼──── stays on device  │
   │                          │   L2? ↓               │                      │
   │                          ├─ redactPII (again) ──►│                      │
   │                          │                       ├─ guards              │
   │                          │                       ├─ cache lookup        │
   │                          │                       ├─ redactPII (again) ──┤
   │                          │                       ├─ generateObject ────►│
   │                          │                       │◄─ validated object ──┤
   │                          │                       ├─ rehydrate + cache   │
   │                          │◄─ Result ─────────────┤                      │
   │                          ├─ rehydrate (local)    │                      │
   │                          ├─ writeLedger()        │                      │
   │◄─ Result ────────────────┤                       │                      │
   ├─ safeParse (again)       │                       │                      │
   └─ render                  │                       │                      │
```

The schema is validated **three times** — by `generateObject`, by the route handler, and by
the client before rendering. The last one is not redundant: a compromised or stale edge is
not a reason to put unvalidated data in front of a user who is already overwhelmed.

If anything fails, `deterministicFallback()` supplies an artifact anyway, and the panel
shows both the honest error and the fallback. The user never sees a dead end.

### 9.2 COMMANDER — the agent loop

```
Alt+Shift+V
  │
  ├─1─ PERCEIVE   summariseDom(document)
  │      • selects interactive + landmark elements, caps at 120
  │      • isSensitiveField() strips password/OTP/CVV/card ──► withheld: 2
  │      • assigns opaque handles e0…eN
  │      • stores WeakRef<HTMLElement> in a module-local Map
  │      → DomSummary { url, title, elements[], withheld }
  │
  ├─2─ HEAR       listenOnce()  — one utterance, 8s cap, Esc cancels
  │
  ├─3─ PLAN       POST /api/commander → planCommand()
  │      system = CONSTITUTION + COMMANDER brief + DNA brief
  │      prompt = utterance + page title + withheld note + the e0…eN lines
  │      generateObject(schema: CommanderPlan, temperature: 0.1, 12s abort)
  │
  ├─4─ HARDEN     harden(plan, dom)          ← server-side, non-negotiable
  │      • any unknown elementId    → wipe ALL actions, set cannotDo
  │      • more than 6 actions      → wipe ALL actions, set cannotDo
  │      • submit/fill/select       → risk escalated regardless of the model
  │      • target name matches pay|delete|send → escalated
  │      • needsConfirmation recomputed by us, not claimed by the model
  │
  ├─5─ VALIDATE   SCHEMA_BY_MODE.COMMANDER.safeParse()   ← client-side
  │
  ├─6─ CONFIRM    mountPlanConfirm()
  │      • every step in plain words + its risk badge
  │      • any irreversible action → button disabled until "OK" is TYPED
  │
  └─7─ EXECUTE    executePlan()
         per step:  resolve handle → re-check sensitivity → spotlight
                    → 400ms pause → act → 400ms pause → re-fingerprint
         page changed? ► STOP and report, do not continue
```

**The core safety idea.** The model never receives or emits a CSS selector. It gets opaque
handles:

```
e4 [textbox] "Full name" *required in form: Student registration
e9 [button] "Submit application" in form: Student registration
```

It can only reference `e4` or `e9`. If it hallucinates `e57`, lookup fails — and rather than
dropping that one action and running the rest, `harden()` **invalidates the entire plan**. A
plan built on an element that does not exist is a plan whose intent you no longer
understand, so running four of its five steps is worse than running none.

> Constrain the action space by construction, not by hope.

**What makes it an actual loop.** After every action, `structuralFingerprint()` recomputes
`pathname｜forms,inputs,buttons,dialogs`. If that changes — a modal opened, a route changed,
a validation error appeared — the remaining handles may now point at different things, so
execution **stops and reports** rather than continuing against a stale model of the page.
That perceive → act → *observe* → decide cycle is the difference between an agent and a
batch script.

**Termination.** `executePlan` returns a typed report, never an exception:

| Outcome | Means |
|---|---|
| `done` | All steps completed |
| `aborted` | User pressed Esc |
| `element-missing` | A handle no longer resolves |
| `page-changed` | Structure changed mid-run |
| `blocked` | A fill targeted a sensitive field |
| `budget` | The plan exceeded 6 steps — the whole run is refused |

Every non-`done` outcome surfaces a card saying what happened and that nothing further was
changed.

**When the planner is unreachable**, `commanderFallback()` returns `actions: []` with a
reason. A refusal, never a guess — as the mode brief tells the model: *"A refusal is a
correct answer."*

### 9.3 Three kinds of AI usage

Being precise about this is a scoring advantage. When asked *"is this really agentic?"*,
the wrong answer is "yes, it's all agentic."

| Kind | Where | Loop? | Tools? |
|---|---|---|---|
| **Transformer** | 7 of 9 modes | No — single shot | No |
| **Retriever** | Memory Vault | No — retrieve then transform | No |
| **Agent** | **COMMANDER only** | **Yes** — perceive/act/observe | **Yes** |

---

## 10. Testing and evaluation

### 10.1 Kernel tests

```bash
corepack pnpm test
```

**43 tests, all passing.** Coverage follows Build Bible Appendix D — the tests worth
writing under time pressure:

| Suite | Asserts |
|---|---|
| `fixationLength` | The full verified table for lengths 1–20 × intensities 1–3; never returns `n`; never returns 0 for n≥2; `bionicTokens` round-trips the source string exactly |
| CLS | `sat()` saturates correctly; **weights sum to exactly 1.000**; a hostile document scores above a calm one and stays within 0–100 |
| **`focusMode`** | **NEVER hides an element containing a form control** — including an ad-classed wrapper that happens to contain the form; genuine noise still hidden; undo restores everything |
| PII | Catches email/phone/Aadhaar/PAN/Luhn card; rejects Luhn-invalid digits; identical values share a placeholder; round-trips through `rehydrate` including nested structures; no-op on clean text |
| Chunking | Heading path prepended; overlap applied; empty input returns `[]` not an empty chunk |
| `chooseTier` | Every branch: FOCUS always L0 · `cloudAI:'never'` → L1 or throws, never silently escalates · offline · small-job L1 preference · long LEARN → L3 · consent refusal · images never on-device |
| Breathe | Sensitivity 0 provably never fires; a burst inside the first 20s is suppressed; a sustained burst fires at most once; two dismissals drop sensitivity; `forceFire` bypasses every gate |
| Schemas | Every mode schema accepts its own deterministic fallback; rejects known-bad payloads; `buildTree` survives a completely malformed node list; fan-out limit enforced even when the model ignores it |
| Router | Explicit beats heuristic; utterance beats artifact shape; long page → LEARN, short → FOCUS |
| Retrieval | Temporal parsing ("yesterday afternoon"); topic vs pure-time discrimination; **RRF ranks A > C > B > D** for semantic `[A,B,C]` + lexical `[C,A,D]` |
| DOM summariser | **Withholds password, OTP and payment fields**; assigns opaque handles, not selectors |

> The `focusMode` form-control test is the one test in this repo that must never be
> deleted. Without that protection pass, a regression silently hides the submit button on a
> government form.

### 10.2 The eval harness

```bash
corepack pnpm eval                    # all 16 cases against localhost:3000
corepack pnpm eval -- --mode START    # one mode
corepack pnpm eval -- --runs 3        # repeat, to measure structural determinism
corepack pnpm eval -- --base https://your-edge.vercel.app
```

16 golden cases across START, EXPLAIN, LEARN, MEET, COMMANDER and WRITE, checked against
**property assertions, not exact strings** — LLM outputs are not string-stable, and a suite
that breaks on a synonym is a suite you delete on day nine.

**Universal assertions** (every mode): schema valid · no shaming language (`just`, `simply`,
`easy`, `obviously`) · never diagnoses or labels · no markdown fences leaked · PII
placeholders preserved and never invented.

**Mode-specific highlights:**

- **START** — first action ≤ 10 min · 3–7 steps · the first two steps are the lowest-anxiety
  ones · steps begin with an action · grade ≤ 8 · no exclamation marks · no invented dates
- **LEARN** — exactly one root · depth ≤ 2 · every parent exists · no node restates its
  parent · quiz answers in range with 4 distinct options · summary lines stand alone
- **MEET** — never guesses an owner · never infers an unspoken deadline
- **COMMANDER** — every `elementId` came from the supplied summary · ≤ 6 actions · submit
  never marked safe · risky plans require confirmation · impossible requests return no
  actions and say why
- **EXPLAIN** — respects reading level · the analogy is not a restatement of the definition

Output is a pass-rate table per mode, followed by **named failures**. Exits non-zero on any
hard schema failure so CI can gate on it.

> Put that table on a slide, *including* the failures. Volunteering your three worst cases
> signals that you actually measured, which almost nobody else will have done.

### 10.3 CI

`.github/workflows/ci.yml` runs typecheck → kernel tests → build → **greps the built
extension bundle for provider API keys** and fails if one is found, then uploads the
unpacked extension as an artifact.

---

## 11. Deployment

### SETU Edge → Vercel

Root directory `apps/web`.

```bash
pnpm dlx vercel link
pnpm dlx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
pnpm dlx vercel env add SETU_ALLOWED_EXTENSION_IDS production
pnpm dlx vercel --prod
```

Then in the extension's Settings, set the server URL and grant the deployed origin.

### SETU Lens → Chrome

**For the demo:** `corepack pnpm ext:build` → Load unpacked. **This is what you demo.**
Never depend on a store listing on demo day.

**For the story:** `corepack pnpm ext:zip` → upload `setu-lens.zip` to the Web Store
developer console. Review takes days to weeks; submitting is worth doing so you can say
"it's in review" with a screenshot. Justify every permission in the listing — vague
justifications get rejected, and writing them forces you to check you are not
over-requesting.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | for cloud modes | L2/L3 rungs |
| `GROQ_API_KEY` | no | Fallback rung |
| `SETU_MODEL_FLASH` / `_FLASH_LITE` / `_PRO` | no | Override model ids |
| `SETU_AUTH_MODE` | no | `open` (default) or `supabase` |
| `SETU_ALLOWED_EXTENSION_IDS` | **production** | CORS allowlist |
| `SETU_RATE_PER_MIN` / `_PER_DAY` | no | Defaults 30 / 300 |
| `VITE_SETU_API_BASE` | no | Extension's default server URL at build time |

⚠️ **Verify the model ids before demo day.** The defaults are `gemini-2.5-flash` /
`-flash-lite` / `-pro`. The Build Bible names `gemini-3.5-flash`, which is a placeholder
for whatever the current generation is called. A wrong model id is a 404 that looks like a
bug in your own code for twenty confusing minutes.

---

## 12. Verification log

Everything below was executed on 8 August 2026, on Windows 10, Node 24.16, pnpm 9.12.

| Check | Result |
|---|---|
| `corepack pnpm install` | 280 packages resolved, clean |
| `corepack pnpm test` | **43/43 passing** |
| `corepack pnpm typecheck` | Clean across `@setu/core`, `@setu/extension`, `@setu/web` |
| `corepack pnpm build` | Extension + edge both build clean |
| Extension bundle output | `content.js` 95 KB · `background.js` 13 KB · `sidepanel.js` 25 KB · 4 valid PNG icons |
| Extension bundle key scan | **No provider API keys found** |
| `GET /api/health` | `{"ok":true,"providers":[],"degraded":true,...}` |
| `POST /api/transform` with no key | `ok:false`, `PROVIDER_FAILED`, **plus a 4-step usable fallback artifact** |
| Consent gate | **HTTP 428**, `CONSENT_REQUIRED`, when `cloudAI:'ask'` and consent absent |
| `POST /api/commander` with no key | Refuses cleanly: *"Nothing was changed on the page."* |

Two defects were found and fixed during verification:

1. **Phone redaction missed the conventional Indian 5+5 grouping** (`+91 98765 43210`) —
   the pattern required ten consecutive digits. Now handles both groupings and was
   re-verified not to match inside Aadhaar or card numbers.
2. **`summariseDom` returned zero elements in a headless DOM**, because every
   `getBoundingClientRect()` is zero there and the visibility filter excluded everything.
   This mattered beyond tests: an empty summary looks exactly like a page with no controls,
   which is the worst possible failure mode because it is silent. Now detects whether a
   layout engine is present and only applies rect-based exclusion when it is.

---

## 13. Known limitations

Stated here because volunteering them is stronger than being caught.

- **The Cognitive Load Score is a proxy**, derived from WCAG heuristics and cognitive-load
  literature. Not a clinical instrument.
- **Bionic reading is disputed** at the population level. Ships off by default. The claim
  is user-selected fit, not a universal speed gain.
- **PII redaction is a heuristic net**, not a guarantee. It catches the shapes it knows,
  and the user sees the redacted payload before consenting.
- **The rate limiter is in-memory** — correct for a single instance. Swap the `Map` in
  `apps/web/src/server/guards.ts` for Upstash Redis before a multi-instance deploy.
- **The transform cache is in-memory** and dies with the process. Fine for a demo; it means
  cache pre-warming must happen against the instance you will actually demo on.
- **The server-side Trust Ledger is not persisted** — `/api/ledger` accepts and
  acknowledges but stores nothing until the Supabase tables land. It says so in its own
  response rather than quietly pretending. The device-side ledger is complete and
  authoritative.
- **Vault crypto is implemented and tested but nothing calls it yet.** It lands with
  Sanctuary, which owns document ingest.
- **L1 (Gemini Nano) needs ~22 GB free disk and a capable GPU.** Assume the judge's laptop
  does not qualify. It is feature-detected everywhere and no path requires it.
- **COMMANDER acts on the current page only**, with confirmation. Cross-site autonomy is
  not built and should not be claimed.
- **LEARN, MEET, PRACTICE and GUIDE have schemas, prompts, fallbacks and edge support but
  no renderers.** They will return valid artifacts today; nothing displays them yet.

### Deviations from the Build Bible

| Bible says | This build does | Why |
|---|---|---|
| `gemini-3.5-flash`, `gemini-3.1-flash-lite` | `gemini-2.5-flash`, `-flash-lite` | Those ids do not exist. All are env-overridable. |
| `Alt+Space` for voice | `Alt+Shift+V` | Windows uses `Alt+Space` for the window system menu and swallows it before Chrome sees it. |
| Static `content_scripts`, switch to dynamic on Day 12 | Dynamic from the start | The install-warning problem is real and the fix is cheap; doing it later means re-testing everything. |
| `turbo run` for root scripts | `scripts/workspace.mjs` | Turbo shells out to a `pnpm` binary on PATH. With corepack's shim there is none, and the failure looks nothing like the cause. `turbo.json` is retained behind `turbo:*` scripts. |
| Recursive `z.lazy()` mind-map schema | Flat node list + `parentId` | Explicitly warned against in Bible §20 — `$ref` paths do not survive JSON-Schema translation reliably. `buildTree()` reconstructs client-side and enforces our own depth and fan-out limits. |

---

## 14. Complete file inventory

```
setu/
├── package.json · pnpm-workspace.yaml · turbo.json · tsconfig.base.json · .env.example
├── README.md · .gitignore
├── .github/workflows/ci.yml
├── scripts/
│   ├── workspace.mjs            run a script across workspaces without pnpm on PATH
│   └── zip-extension.mjs        package for the Chrome Web Store
│
├── packages/core/                          THE COGNITIVE KERNEL
│   ├── src/
│   │   ├── index.ts types.ts errors.ts schemas.ts dna.ts ledger.ts cache.ts
│   │   ├── prompts/     index.ts (constitution + briefs)  fallbacks.ts
│   │   ├── router/      index.ts (resolveMode)            tier.ts (the ladder)
│   │   ├── extract/     index.ts readability.ts pii.ts transcript.ts
│   │   ├── metrics/     cls.ts ⭐                          readability-grade.ts
│   │   ├── transform/   bionic.ts ⭐                       sanitize.ts ⭐
│   │   ├── behaviour/   breathe.ts ⭐
│   │   ├── dom/         summarise.ts ⭐  (the agent's perception)
│   │   ├── vault/       chunk.ts recall.ts
│   │   ├── crypto/      vault.ts
│   │   └── sync/        outbox.ts
│   └── test/kernel.test.ts                 43 tests
│
├── apps/extension/                         SETU LENS
│   ├── manifest.json sidepanel.html options.html
│   ├── vite.config.ts vite.content.config.ts
│   ├── scripts/postbuild.mjs               manifest + css + generated PNG icons
│   └── src/
│       ├── background/index.ts             the one door
│       ├── content/    index.ts overlays.ts commander.ts voice.ts setu.css
│       ├── lib/        messages.ts storage.ts api.ts nano.ts jsonschema.ts fixtures.ts
│       ├── sidepanel/  App.tsx main.tsx useSetu.ts
│       │   └── panels/ Page.tsx Start.tsx Explain.tsx Write.tsx Commander.tsx Trust.tsx
│       ├── options/    App.tsx main.tsx    DNA onboarding + settings
│       └── ui/         components.tsx panel.css
│
├── apps/web/                               SETU EDGE  (agent backend only)
│   ├── next.config.ts
│   └── src/
│       ├── app/api/    transform/ commander/ ledger/ health/
│       ├── app/        layout.tsx page.tsx globals.css
│       └── server/     transform.ts commander.ts guards.ts cors.ts env.ts
│
├── evals/
│   ├── run.ts assertions.ts
│   └── golden/cases.json                   16 golden cases
│
└── docs/
    ├── IMPLEMENTATION.md                   this file
    ├── DEMO_RUNBOOK.md
    └── JUDGE_QA.md
```

⭐ marks the five modules that carry the differentiation: the Cognitive Load Score, bionic
reading, the focus-mode sanitiser, the Breathe detector, and the DOM summariser.

---

*SETU v0.9.0 · built against the Master Build Bible v1.0 · Capgemini Tech4Positive Futures 2026*
