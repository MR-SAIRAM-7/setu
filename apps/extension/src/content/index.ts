import {
  BreatheDetector,
  DEFAULT_DNA,
  SignalCollector,
  applyBionic,
  computeCLS,
  dnaToAttributes,
  extractFromDocument,
  focusMode,
  isFocusOn,
  summariseDom,
  undoBionic,
  undoFocus,
  type CLSBreakdown,
  type DNAProfile,
  type Result,
  type TCommanderPlan,
} from '@setu/core';
import { executePlan, perceive } from './commander';
import {
  clearOverlays,
  clearSpotlight,
  disableLineGuide,
  enableLineGuide,
  mountBreathe,
  mountPanic,
  mountPlanConfirm,
  mountSuggestion,
  spotlight,
} from './overlays';
import { listenOnce } from './voice';
import type { ToContent } from '../lib/messages';

/**
 * SETU LENS — content script.
 *
 * Everything in this file runs at L0: deterministic, local, no network, works
 * with the wifi off. That is not a limitation to apologise for — it is the
 * whole scalability and privacy argument, made literal.
 */

declare global {
  interface Window {
    __setuLensLoaded?: boolean;
  }
}

// Injection is on-demand (activeTab) AND registered for granted origins, so
// double-injection is a real possibility. Guard rather than double-apply.
if (window.__setuLensLoaded) {
  // already running
} else {
  window.__setuLensLoaded = true;
  void init();
}

let dna: DNAProfile = DEFAULT_DNA;
let detector: BreatheDetector | null = null;
let collector: SignalCollector | null = null;
let lastCLS: CLSBreakdown | null = null;
const pageStart = Date.now();

async function init(): Promise<void> {
  dna = await getDNA();
  applyDNAAttributes(dna);

  // Wait for the page to settle before measuring — a CLS computed against a
  // half-rendered DOM is a number that means nothing.
  await idle();

  lastCLS = computeCLS(document, document.body?.innerText ?? '');
  void send({ type: 'CLS_REPORT', cls: lastCLS, url: location.href });

  if (dna.bionic.enabled) applyBionic(document.body, dna.bionic.intensity);
  if (dna.lineGuide) enableLineGuide();

  // A high-load page gets ONE quiet offer in the corner, and only if the user
  // opted into proactive help. It disappears by itself after 12 seconds.
  if (lastCLS.score >= 70 && dna.breathe.enabled && !isFocusOn(document)) {
    mountSuggestion({ cls: lastCLS, onAccept: toggleFocus });
  }

  if (dna.breathe.enabled && dna.breathe.sensitivity > 0) startBreathe();

  watchForSpaChanges();
}

/* ── messages ─────────────────────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg: ToContent, _sender, respond) => {
  switch (msg.type) {
    case 'PING':
      respond({ ok: true });
      return false;

    case 'TOGGLE_FOCUS':
      toggleFocus();
      respond({ ok: true });
      return false;

    case 'PANIC':
      showPanic();
      respond({ ok: true });
      return false;

    case 'FORCE_BREATHE':
      // Risk #3 mitigation: a manual trigger, so the pitch never depends on
      // rage-clicking convincingly enough on stage.
      detector?.forceFire();
      respond({ ok: true });
      return false;

    case 'VOICE_START':
      void startVoice();
      respond({ ok: true });
      return false;

    case 'APPLY_DNA':
      applyDNA(msg.dna);
      respond({ ok: true });
      return false;

    case 'GET_PAGE': {
      const ex = extractFromDocument(document);
      respond({
        url: location.href,
        title: ex.title,
        text: ex.text,
        wordCount: ex.wordCount,
        readingGrade: ex.readingGrade,
        cls: ex.cls,
      });
      return false;
    }

    case 'GET_SELECTION': {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      respond({ text, url: location.href, contextBefore: contextAround(sel) });
      return false;
    }

    case 'GET_DOM_SUMMARY':
      respond(summariseDom(document));
      return false;

    case 'APPLY_PLAN':
      void confirmAndRun(msg.plan);
      respond({ ok: true });
      return false;

    case 'HIGHLIGHT': {
      const el = document.querySelector<HTMLElement>(`[data-setu-el="${msg.elementId}"]`);
      spotlight(el, 'here');
      respond({ ok: true });
      return false;
    }

    case 'SPOTLIGHT': {
      const el = msg.hint ? findByText(msg.hint) : null;
      spotlight(el, msg.label);
      respond({ ok: !!el });
      return false;
    }

    case 'CLEAR_OVERLAYS':
      clearOverlays();
      clearSpotlight();
      respond({ ok: true });
      return false;
  }
  return false;
});

/* ── FOCUS ────────────────────────────────────────────────────────────────── */

function toggleFocus(): void {
  const before = lastCLS?.score ?? computeCLS(document, document.body?.innerText ?? '').score;

  if (isFocusOn(document)) {
    undoFocus(document);
    if (dna.bionic.enabled) undoBionic(document.body);
    const after = computeCLS(document, document.body?.innerText ?? '').score;
    lastCLS = { ...(lastCLS ?? emptyCLS()), score: after };
    void send({ type: 'CLS_REPORT', cls: lastCLS, url: location.href });
    return;
  }

  const removed = focusMode(document);
  if (dna.bionic.enabled) applyBionic(document.body, dna.bionic.intensity);

  // Recompute AFTER the transformation. This is the 84 → 19 moment, and it is
  // a real measurement of the real DOM, not a stored constant.
  const cls = computeCLS(document, document.body?.innerText ?? '');
  lastCLS = cls;
  void send({ type: 'CLS_DELTA', before, after: cls.score, url: location.href, removed });
}

/* ── PANIC (§42.12) ───────────────────────────────────────────────────────── */

function showPanic(): void {
  const where = describeWhereYouAre();
  const next = mostLikelyNextAction();

  mountPanic({
    where,
    actionLabel: next?.label ?? 'Bring the page back',
    onAction: () => {
      if (next?.el) {
        next.el.scrollIntoView({ block: 'center' });
        next.el.focus();
        spotlight(next.el, 'this one');
        setTimeout(clearSpotlight, 3000);
      }
    },
  });
}

function describeWhereYouAre(): string {
  const h1 = document.querySelector('h1')?.textContent?.trim();
  const title = (h1 || document.title || location.hostname).replace(/\s+/g, ' ').slice(0, 120);
  return `You are on ${location.hostname}, at "${title}".`;
}

/** The single control most likely to move the user forward. Heuristic, on purpose. */
function mostLikelyNextAction(): { el: HTMLElement; label: string } | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button[type="submit"],input[type="submit"],form button,a.btn,button,[role="button"]',
    ),
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  const score = (el: HTMLElement): number => {
    const text = (el.textContent ?? (el as HTMLInputElement).value ?? '').toLowerCase();
    let s = 0;
    if (/submit|continue|next|apply|register|pay|save|send/.test(text)) s += 10;
    if (el.matches('[type="submit"]')) s += 6;
    if (el.closest('form')) s += 3;
    if (/cancel|close|back|reject|logout/.test(text)) s -= 12;
    return s;
  };

  const best = candidates.map((el) => ({ el, s: score(el) })).sort((a, b) => b.s - a.s)[0];
  if (!best || best.s <= 0) return null;

  const label = (best.el.textContent ?? 'Continue').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { el: best.el, label: label || 'Continue' };
}

/* ── BREATHE ──────────────────────────────────────────────────────────────── */

function startBreathe(): void {
  collector = new SignalCollector();
  detector = new BreatheDetector(
    {
      sensitivity: dna.breathe.sensitivity,
      cooldownMs: 5 * 60_000,
      minSessionMs: 20_000,
      maxPerHour: 3,
    },
    onBreatheFire,
  );

  document.addEventListener(
    'pointermove',
    (e) => collector?.onPointer(e.clientX, e.clientY, Date.now()),
    { passive: true },
  );
  document.addEventListener('scroll', () => collector?.onScroll(scrollY, Date.now()), {
    passive: true,
    capture: true,
  });
  document.addEventListener('click', (e) => collector?.onClick(e.target, Date.now()), {
    passive: true,
    capture: true,
  });

  // Hard ethics rules: never during password entry, never during video playback.
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement && /password|tel|number/.test(t.type)) detector?.suspend();
    },
    true,
  );
  document.addEventListener(
    'focusout',
    () => {
      if (!anyVideoPlaying()) detector?.resume();
    },
    true,
  );
  document.addEventListener('play', () => detector?.suspend(), true);
  document.addEventListener('pause', () => detector?.resume(), true);

  // ~4 samples/second, rAF-throttled so we never fight the page for frames.
  let last = 0;
  const loop = () => {
    const now = Date.now();
    if (now - last > 250) {
      last = now;
      if (collector && detector && document.visibilityState === 'visible') {
        detector.tick(collector.sample(now), now - pageStart);
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function onBreatheFire(): void {
  void send({ type: 'BREATHE_FIRED', url: location.href });

  mountBreathe({
    onAccept: () => {
      detector?.accepted();
      void send({ type: 'BREATHE_OUTCOME', outcome: 'accepted' });
      if (!isFocusOn(document)) toggleFocus();
    },
    onDismiss: () => {
      const next = detector?.dismissed();
      void send({ type: 'BREATHE_OUTCOME', outcome: 'dismissed' });
      if (next !== undefined) dna = { ...dna, breathe: { ...dna.breathe, sensitivity: next } };
    },
    onDisable: () => {
      detector?.disable();
      void send({ type: 'BREATHE_OUTCOME', outcome: 'disabled' });
    },
  });
}

function anyVideoPlaying(): boolean {
  return Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);
}

/* ── COMMANDER ────────────────────────────────────────────────────────────── */

async function startVoice(): Promise<void> {
  const heard = await listenOnce(dna.language);
  if (!heard.ok || !heard.transcript) {
    mountSuggestion({
      cls: lastCLS ?? emptyCLS(),
      onAccept: () => void startVoice(),
    });
    return;
  }

  const dom = perceive();
  const res = await send<Result<TCommanderPlan>>({
    type: 'COMMAND',
    utterance: heard.transcript,
    dom,
  });

  if (!res?.ok) {
    mountPanic({
      where: res?.error?.message ?? 'That did not work.',
      actionLabel: 'Close',
      onAction: () => {},
    });
    return;
  }

  await confirmAndRun(res.data);
}

async function confirmAndRun(plan: TCommanderPlan): Promise<void> {
  if (plan.cannotDo || !plan.actions.length) {
    mountPanic({
      where: plan.cannotDo ?? 'There is nothing SETU can do on this page for that.',
      actionLabel: 'Close',
      onAction: () => {},
    });
    return;
  }

  const requiresTyped = plan.actions.some((a) => a.risk === 'irreversible');

  mountPlanConfirm({
    understood: plan.understood,
    lines: plan.actions.map((a) => ({ text: `${verb(a.op)} ${a.targetHint}`, risk: a.risk })),
    requiresTyped,
    onCancel: () => {},
    onConfirm: async () => {
      const report = await executePlan(plan);
      if (report.stoppedBecause !== 'done') {
        mountPanic({
          where:
            report.detail ??
            `SETU stopped after ${report.completed} of ${report.total} steps. Nothing further was changed.`,
          actionLabel: 'Close',
          onAction: () => {},
        });
      }
    },
  });
}

function verb(op: string): string {
  return (
    {
      click: 'Click',
      fill: 'Type into',
      select: 'Choose in',
      scrollTo: 'Scroll to',
      focus: 'Move to',
      submit: 'Submit',
      navigate: 'Open',
    }[op] ?? op
  );
}

/* ── DNA ──────────────────────────────────────────────────────────────────── */

function applyDNA(next: DNAProfile): void {
  const prev = dna;
  dna = next;
  applyDNAAttributes(next);

  if (prev.bionic.enabled && !next.bionic.enabled) undoBionic(document.body);
  else if (next.bionic.enabled && next.bionic.intensity !== prev.bionic.intensity) {
    undoBionic(document.body);
    applyBionic(document.body, next.bionic.intensity);
  } else if (next.bionic.enabled && !prev.bionic.enabled) {
    applyBionic(document.body, next.bionic.intensity);
  }

  if (next.lineGuide) enableLineGuide();
  else disableLineGuide();

  detector?.setSensitivity(next.breathe.enabled ? next.breathe.sensitivity : 0);
}

function applyDNAAttributes(profile: DNAProfile): void {
  for (const [k, v] of Object.entries(dnaToAttributes(profile))) {
    document.documentElement.setAttribute(k, v);
  }
}

/* ── SPA survival ─────────────────────────────────────────────────────────────
   Without this, SETU silently stops working on React sites — and half the web
   is a React site. Debounced, and guarded by data-setu-* attributes so we can
   never double-apply.
   ─────────────────────────────────────────────────────────────────────────── */

function watchForSpaChanges(): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastPath = location.pathname;

  const observer = new MutationObserver((records) => {
    // Ignore our own mutations, or we will observe ourselves forever.
    const ours = records.every((r) => {
      const t = r.target as HTMLElement;
      return t?.closest?.('[data-setu-skip]') !== null;
    });
    if (ours) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (isFocusOn(document)) focusMode(document);
      if (dna.bionic.enabled) applyBionic(document.body, dna.bionic.intensity);

      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        lastCLS = computeCLS(document, document.body?.innerText ?? '');
        void send({ type: 'CLS_REPORT', cls: lastCLS, url: location.href });
      }
    }, 400);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function getDNA(): Promise<DNAProfile> {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_DNA' });
    return (res as DNAProfile) ?? DEFAULT_DNA;
  } catch {
    // The service worker may be asleep or the extension reloading. Defaults
    // keep Focus Mode working, which is the hard requirement.
    return DEFAULT_DNA;
  }
}

function send<T = unknown>(msg: unknown): Promise<T | null> {
  return chrome.runtime.sendMessage(msg).catch(() => null) as Promise<T | null>;
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => resolve());
      return;
    }
    window.addEventListener('load', () => requestAnimationFrame(() => resolve()), { once: true });
    setTimeout(resolve, 2500); // never block forever on a page that never finishes
  });
}

function contextAround(sel: Selection | null): string {
  const node = sel?.anchorNode?.parentElement;
  const text = node?.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function findByText(hint: string): HTMLElement | null {
  const needle = hint.toLowerCase().trim();
  const candidates = document.querySelectorAll<HTMLElement>(
    'a,button,input,select,textarea,[role="button"],[role="link"],label,h1,h2,h3',
  );
  for (const el of candidates) {
    const name = (
      el.getAttribute('aria-label') ??
      el.textContent ??
      (el as HTMLInputElement).value ??
      ''
    )
      .toLowerCase()
      .trim();
    if (name && (name === needle || name.includes(needle))) return el;
  }
  return null;
}

function emptyCLS(): CLSBreakdown {
  return {
    score: 0,
    components: {
      structural: 0,
      textual: 0,
      visual: 0,
      motion: 0,
      decision: 0,
      interruption: 0,
    },
    topContributors: [],
    computedInMs: 0,
  };
}
