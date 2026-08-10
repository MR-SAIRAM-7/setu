<div align="center">

# SETU — the cognitive bridge

**From overwhelm to action.**

One kernel, three surfaces. Built for Capgemini Tech4Positive Futures 2026 · Disability Inclusion &amp; Accessibility.

</div>

---

## The sentence

> Dense digital interfaces impose a load that exceeds the working-memory and executive-initiation
> capacity of 15–20% of users. Existing tools **translate** the interface — read it aloud, enlarge
> it, recolour it — but do not **reduce its structural demand** or **produce the next action**.
> Translation is not reduction. The gap is not perception. The gap is load and initiation.

Everything in this repository follows from that paragraph.

---

## What is actually built

| | Status | Where |
|---|---|---|
| **@setu/core** — the cognitive kernel | ✅ 46 unit tests green | `packages/core` |
| **@setu/ui** — the design system | ✅ 124 contrast checks green | `packages/ui` |
| **SETU Sanctuary** — the web surface | ✅ 22 routes, 38 axe audits green | `apps/web` |
| **SETU Edge** — the one door | ✅ 8 route handlers | `apps/web/src/app/api` |
| **SETU Lens** — the Chrome extension | ✅ 14 content-script checks green | `apps/extension` |
| **Supabase schema** | ✅ migration + RLS + pgvector | `supabase/migrations` |
| **Accounts / sign-in** | ⬜ schema ready, no UI | — |
| **SETU Go** — Android | ⬜ roadmap | — |

### The three things nobody else has

1. **The Cognitive Load Score.** A 0–100 measure of how much something demands, computed locally in
   about 40 ms from six weighted components. It turns "we make pages easier" into a number that
   moves — the university notice on the landing page measures **45 → 3** (reading grade 20 → 3.1),
   computed in the visitor's own browser with no network call. Every number the product prints is
   one it actually measured, and `/evidence` names the metric's limits before anyone asks.
2. **The Trust Ledger.** Every AI call, listed: when, which mode, which rung of the compute ladder,
   which provider, how many bytes left the device, how many personal details were redacted first.
   L0 and L1 runs are logged too, which is what makes it a proof rather than a list of accusations.
3. **The Open Barrier Ledger.** Opt-in, anonymous by construction — the table has no `user_id`
   column at all — building a live map of which pages on the internet are cognitively hostile.

---

## Run it

```bash
pnpm install
cp .env.example .env.local     # every variable in it is optional
pnpm dev                       # Sanctuary on :3000, Lens rebuilding on save
```

Then load the extension: `chrome://extensions` → Developer mode → **Load unpacked** →
`apps/extension/dist`. Then **click the SETU icon on a real page** — there is no static
`content_scripts` block, so nothing is injected until you ask. Ten-minute walkthrough:
[`docs/TESTING_THE_EXTENSION.md`](docs/TESTING_THE_EXTENSION.md).

**It works with an empty `.env.local`.** Focus mode, bionic reading, the line guide, the load
score, the pause offer, the Vault, Rewind, the Trust Ledger and a real deterministic result for
every one of the nine modes all run with no keys, no database and no network. Adding
`GOOGLE_GENERATIVE_AI_API_KEY` upgrades the cloud rungs; adding Supabase adds caregiver share
links and the anonymous barrier ledger. Nothing throws because a key is missing, and the UI says
which version you are getting *before* you press the button.

⚠️ **There is no sign-in yet.** SETU is local-first: your profile, Vault and ledger live in the
browser, which is why being signed out never breaks anything. The schema, RLS policies and the
`/api/ledger` and `/api/profile`-shaped endpoints are built for an account, but the auth UI is
not, so cross-device sync is *not* reachable today. Share links work without one.

`GET /api/health` reports exactly what a running deployment can do.

---

## The compute ladder

Every capability degrades downward. Nothing in SETU has exactly one way of working.

```
L0  DETERMINISTIC     0 ms network · ₹0 · offline · private by construction
    readability · focus mode · bionic anchors · load score · overwhelm
    detection · PII detection · reading grade · chunking

L1  ON-DEVICE MODEL   ~300–900 ms · ₹0 · offline after download · private
    Chrome's Prompt API. Feature-detected, never depended on.

L2  CLOUD FLASH       ~1–3 s · needs explicit consent
    Gemini Flash with a strict response schema.

L3  CLOUD PRO         ~4–12 s · used sparingly · needs explicit consent
    Long-document synthesis only.
```

The honest version of the "zero compute" claim: **it is true for L0 and false above it**, so the
product says so precisely — in the UI, on the landing page, and on `/privacy`.

---

## Layout

```
setu/
├── packages/
│   ├── core/          the kernel: types, zod schemas, CLS, readability, bionic,
│   │                  PII, tier router, prompts, deterministic fallbacks,
│   │                  crypto vault, outbox. Zero DOM at import, zero React,
│   │                  zero network, zero secrets.
│   └── ui/            the design system: tokens, primitives, load meter,
│                      tier badge, reader. Shared by BOTH surfaces.
├── apps/
│   ├── web/           Sanctuary (the product) + Edge (the one door)
│   └── extension/     Lens — MV3, side panel, content script, service worker
├── supabase/migrations/
├── evals/             golden set + typed assertions
└── docs/
```

### The kernel

The entire product is one function:

```ts
transform(artifact: Artifact, mode: Mode, dna: DNAProfile, ctx: Context)
  → Promise<Result<TransformArtifact>>
```

Three surfaces × nine modes is 27 implementations if you build it naively. With a kernel it is 9 +
3 thin renderers — which is why the *same* `bionicTokens` function runs in the Next.js app, in the
extension's content script against a live DOM, and (on the roadmap) in a React Native `<Text>`.

---

## Verify

```bash
pnpm verify                          # typecheck + tests + build, all workspaces
pnpm --filter @setu/core test        # 46 kernel tests
pnpm --filter @setu/extension test   # 14 content-script checks in real Chromium
pnpm --filter @setu/ui contrast      # 124 contrast assertions across 4 themes
pnpm --filter @setu/web a11y         # axe-core over 19 routes × light and dark
pnpm --filter @setu/web calibrate    # re-measure the load-score calibration table
pnpm eval                            # the golden set (needs a provider key)
```

CI runs all of these, plus two assertions that matter more than they look:

- **no provider key in any client bundle** — the extension talks to *our* API, never to a model
  provider, so there is no key in its bundle to extract
- **no wildcard CORS origin** — `*` would make the API usable by any page on the internet

---

## Deploy

**Sanctuary → Vercel.** Root directory `apps/web`; `vercel.json` carries the build command,
function durations and security headers.

```bash
pnpm dlx vercel link
pnpm dlx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
pnpm dlx vercel --prod
```

**Database → Supabase** (optional).

```bash
supabase db push
supabase db lint     # run it; it will find something
```

**Lens → Chrome.** `pnpm ext:build` then load `apps/extension/dist` unpacked — that is what you
demo. `pnpm ext:zip` produces the store submission. Never depend on a store listing on demo day.

Full walkthrough with every variable: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Accessibility, as engineering

This is an accessibility product, so its own accessibility is a build gate, not a review item.

- **Contrast is asserted, not eyeballed.** `packages/ui/scripts/check-contrast.mjs` parses the real
  token values out of `theme.css` and asserts 31 pairs across light, dark and both high-contrast
  themes. Body text clears **WCAG AAA (7:1)**; control borders clear **1.4.11 (3:1)**.
- **axe-core runs over every route in both colour schemes**, and fails the build on anything at or
  above "moderate".
- **Four themes**, not two: light, dark, and a real high-contrast mode on each — a separate axis,
  because someone who needs maximum separation still has a preference about brightness.
- **Reduced motion is the default posture.** Two independent switches turn animation off: the OS
  preference and the user's own profile. Either one wins.
- **44×44 minimum touch targets, no exceptions.** Focus rings are 3px and never removed.
- **Nothing is conveyed by colour alone.** Every status tone ships with an icon and a text label;
  the load score always shows its band name in words.
- **The mind map has a visible "List view" button**, not an `sr-only` fallback. An inaccessible
  accessibility tool is the one thing a disability-inclusion judge will not forgive.

Typefaces are self-hosted: Atkinson Hyperlegible (designed by the Braille Institute for low vision)
and Lexend. Not from a CDN — a font request to a third party on every page load is a privacy leak
in a product whose pitch is that you can read everything that left your device, and MV3 would block
it in the extension anyway.

---

## What we will not claim

Volunteered here, on `/privacy`, and on `/evidence` — before anybody asks.

- **The load score is a proxy.** It measures the artifact, never the person, and has not been
  validated against NASA-TLX or task-completion data. Validating it is the first thing a pilot
  should do.
- **Sealed and open are different things.** A document encrypted client-side cannot also be
  summarised by a cloud model. So promotion is per-operation, with the exact redacted payload
  shown, and it is recorded in the ledger.
- **Embeddings are not encryption.** Inversion attacks can recover meaningful text from vectors.
  Mitigation today is scope; distance-preserving perturbation is roadmap, not build.
- **On-device AI is not guaranteed.** Chrome's built-in model needs roughly 16 GB RAM and 22 GB
  free disk. Nothing you rely on is built on that rung.
- **COMMANDER acts on one page**, shows you the plan, and waits for confirmation. It does not
  browse the web on your behalf and it will not book you a flight.
- **SETU never diagnoses.** It holds a profile of what you told it works. There is no column in the
  schema in which an inferred condition could be stored.

---

## Non-goals

1. **Not a screen reader.** It composes with NVDA, JAWS, VoiceOver and TalkBack; it never
   duplicates them.
2. **Not a diagnostic tool.** It never infers, stores or displays a condition.
3. **Not a chatbot.** Every interaction is a mode with a typed input and a typed, validated
   artifact out.
4. **Not general web automation.** COMMANDER is current-page, user-initiated, confirmation-gated.
5. **v1 is Chromium desktop + the web.** Scope discipline reads as maturity, not weakness.

---

<div align="center">

*setu* — Sanskrit for **bridge**.

</div>
