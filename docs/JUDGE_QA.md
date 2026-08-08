# Judge Q&A — answers grounded in code that exists

Every answer below points at a file you can open. An answer you cannot show is an answer
you should not give.

---

**Q. Isn't this just ChatGPT with a nice UI?**

No. Seven of our nine modes are single-shot transformers constrained by strict JSON
schemas — they cannot produce free-form text, by construction
(`packages/core/src/schemas.ts`). Our most-used feature, Focus Mode, contains no AI at
all: it is deterministic DOM surgery running locally
(`packages/core/src/transform/sanitize.ts`). We use models where reasoning is needed and
code everywhere else.

**Q. What happens when the model returns garbage?**

It never reaches the screen. Every output is Zod-validated on the server, and validated
*again* on the client before it renders — because a compromised or stale edge is not a
reason to put unvalidated data in front of someone who is already overwhelmed. On failure:
one repair prompt at the same model, then a cheaper model, then the on-device model, then
a deterministic fallback built from string templates that cannot fail
(`packages/core/src/prompts/fallbacks.ts`). The user never gets a dead end.

**Q. Your "zero-compute" claim — surely the AI costs money?**

Correct, and we are precise about it. Zero compute applies to the L0 tier — Focus Mode,
bionic reading, the load score, overwhelm detection — which is what a user touches every
second of every session. That is genuinely ₹0 marginal cost and runs offline; turn the wifi
off and watch. Intelligence costs money; we defer it, cache it, and try the on-device model
first. Our cost scales with intelligence used, not users served.

**Q. How do you know you're actually reducing cognitive load?**

We compute a Cognitive Load Score from measurable page properties — structural complexity,
text density, reading grade, motion, decisions above the fold, interruptions — normalised
and weighted (`packages/core/src/metrics/cls.ts`). The weights sum to exactly 1.000, so the
score is bounded 0–100 by construction, and there is a test asserting it.

**It is a proxy, not a clinical instrument, and I'll say that before you ask.** Validating
it against real task-completion outcomes is exactly what an NGO pilot is designed to do.

**Q. Isn't behavioural monitoring creepy?**

It would be if it left the device. It never does. The signals are pointer and scroll
dynamics in a 30-second ring buffer, z-scored against *that user's own* rolling baseline —
not a population norm (`packages/core/src/behaviour/breathe.ts`). Nothing is stored,
nothing is transmitted, and no inference about the person is ever recorded.

It never fires in the first 20 seconds on a page, never more than once per five minutes,
never more than three times an hour, never during password entry, and never during video
playback. Two dismissals in a row drop the sensitivity automatically.

And the UI never says "detected". It says *"this page looks intense"* — an observation
about the page, never about the person. That wording distinction is the whole ethics of the
feature.

**Q. You claim zero-knowledge encryption but also cloud AI. Which is it?**

Both, with an explicit boundary — and that is the right question to ask.

Sealed items are AES-GCM encrypted client-side; the server holds ciphertext and
client-computed vectors, so it can run similarity search without ever decrypting. For cloud
AI the user explicitly unseals **one item for one operation**, sees the PII-redacted payload
first, and that consent is recorded. Silent unsealing is impossible by construction
(`packages/core/src/crypto/vault.ts`).

Honest scope note: the crypto is implemented and tested but nothing calls it yet — it lands
with Sanctuary, which is what owns document ingest.

**Q. Can't embeddings leak the original text?**

Yes. Embedding inversion is a real line of research and I won't claim otherwise. Today we
would store vectors for sealed items only when the user enables cloud search. For v2 we're
evaluating distance-preserving perturbation and on-device embedding.

**Q. Is this really agentic?**

Precisely one component is. Seven modes are deterministic transformers with schema
contracts — deliberately *not* agents, because non-determinism is a liability when your user
is already overwhelmed. One subsystem is retrieval. Exactly one component, SETU Commander,
is a true agent: a bounded tool set of seven operations, a perceive-act-observe loop, a step
budget of six, and a human confirmation gate before any state-changing action.

**Q. How is COMMANDER not dangerous?**

Three separations: the model **plans**, the human **confirms**, the browser **executes** —
three different files. The model can only reference element ids from a summary we generated;
it cannot invent a target, and a single invented id invalidates the *entire* plan rather
than just that action. Password, OTP and payment fields are stripped before the model sees
the page, then re-checked before every fill. Irreversible actions require a typed
confirmation, not a click. Step budget of six. Any structural change to the page mid-run
stops execution and forces a re-plan. Esc aborts instantly. Every action is logged.

`packages/core/src/dom/summarise.ts`, `apps/web/src/server/commander.ts`,
`apps/extension/src/content/commander.ts`.

**Q. Why determinism? Wouldn't a smarter, more varied model be better?**

For a neurotypical user an inconsistent AI is annoying. For a user with ADHD or autism,
**unpredictability is itself a cognitive load** — an interface that behaves differently each
time forces re-learning on every use, which is precisely the cost we exist to remove. So:
temperature 0.2 for structural modes, hard schemas, and content-hash caching so the same
input gives the same output. Determinism is a feature of the accessibility product, not a
technical convenience.

**Q. Show me the hardest engineering problem you solved.**

The protection pass in the focus-mode sanitiser. Naive decluttering hides the submit button
on a government form — catastrophic for exactly our user. We walk *up* from every form
control, deadline and alert marking ancestors as protected before any removal runs. Simple
in hindsight, and the difference between a tool that helps and one that harms. There is a
test named after it and it is the one test in this repo I would refuse to delete.

**Q. Does this work on single-page apps?**

Yes. A debounced MutationObserver re-applies transformations on route changes, guarded by
`data-setu-*` attributes so we never double-apply, and it ignores our own mutations so it
cannot observe itself into a loop.

**Q. What's your latency?**

Focus Mode under 150ms. The load score computes in about 40ms and reports its own timing —
you can read it in the panel. Cloud modes 2–3s, and **we never show a spinner** — we show a
skeleton in the shape of the answer immediately, because for our users a blank wait *is* the
problem we are solving.

**Q. Why did you build the extension before the web app?**

Because the extension is where the mismatch actually happens. Someone stuck on a
registration portal needs the portal to change, not a separate place to upload it to. The
web app is the memory and the deeper document work; it earns its place second.

**Q. What did you cut, and why?**

Sanctuary's UI, the mobile app, cross-site autonomy, and Android's AccessibilityService.
Each was a multi-day risk that would have degraded the things that actually work. The
kernel was written so none of them require rewriting anything — `fixationLength` in
`packages/core` runs unchanged in a browser extension and in React Native. Cutting well is a
skill we would rather demonstrate than hide.

**Q. Have you talked to actual disabled users?**

*[Answer honestly with what you have actually done. If little: "We've done N informal
sessions, and our first priority after this is structured co-design with a dyslexia and ADHD
cohort. We won't claim validation we don't have."]*

**Judges respect this answer far more than an invented number.** If you have done fewer than
three conversations before demo day, do three. It takes four hours and it changes this answer
completely.

**Q. Can I try it right now?**

Yes. `chrome://extensions`, Developer mode, Load unpacked, `apps/extension/dist`. Focus Mode
works immediately with no account, no key, and no network.
