import { describeCLS, type CLSBreakdown } from '@setu/core';

/**
 * Every overlay SETU mounts on a host page.
 *
 * Two rules govern this file:
 *  1. Esc cancels everything, instantly, at every point. No exceptions.
 *  2. Nothing here ever comments on the PERSON. It comments on the PAGE.
 *     "This page looks intense" — never "we detected you're overwhelmed."
 *     That wording distinction is the entire ethics of the Breathe feature.
 */

const HOST_ID = 'setu-overlay-host';

/** One shadow root for everything, so the host page's CSS can never reach us. */
function host(): ShadowRoot {
  const existing = document.getElementById(HOST_ID);
  if (existing?.shadowRoot) return existing.shadowRoot;

  const el = existing ?? document.createElement('div');
  if (!existing) {
    el.id = HOST_ID;
    el.setAttribute('data-setu-skip', '1');
    el.style.cssText = 'all:initial;position:static';
    document.documentElement.appendChild(el);
  }

  const shadow = el.attachShadow({ mode: 'open' });
  // Injected page CSS does not cross the shadow boundary, so re-link it.
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content.css');
  shadow.appendChild(link);
  return shadow;
}

let escHandler: ((e: KeyboardEvent) => void) | null = null;

function mount(
  node: HTMLElement,
  opts: { onClose?: () => void; trapFocus?: boolean } = {},
): () => void {
  host().appendChild(node);

  const close = () => {
    node.remove();
    if (escHandler) {
      document.removeEventListener('keydown', escHandler, true);
      escHandler = null;
    }
    opts.onClose?.();
  };

  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', escHandler, true);

  if (opts.trapFocus) {
    const first = node.querySelector<HTMLElement>('button, [href], input, select, textarea');
    // Deferred so the browser has laid the node out before we move focus.
    requestAnimationFrame(() => first?.focus());
  }

  return close;
}

export function clearOverlays(): void {
  const el = document.getElementById(HOST_ID);
  el?.shadowRoot?.querySelectorAll('.setu-root').forEach((n) => n.remove());
  if (escHandler) {
    document.removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
}

/**
 * A small DOM builder. Deliberately not a framework: the content script runs
 * inside someone else's page, and every kilobyte of bundle is a kilobyte of
 * someone else's page load.
 *
 * `aria*` keys become real attributes rather than properties, because property
 * reflection for ARIA is not consistent across engines and a screen reader
 * that silently misses a label is the worst bug this file could ship.
 */
type ElProps = { class?: string; style?: string } & Record<string, unknown>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') n.className = String(v);
    else if (k === 'style') n.setAttribute('style', String(v));
    else if (k === 'role') n.setAttribute('role', String(v));
    else if (k.startsWith('aria')) n.setAttribute(`aria-${k.slice(4).toLowerCase()}`, String(v));
    else if (k.startsWith('on') && typeof v === 'function')
      n.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else (n as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) n.append(c);
  return n;
}

/* ── BREATHE ──────────────────────────────────────────────────────────────── */

export interface BreatheChoice {
  onAccept: () => void;
  onDismiss: () => void;
  onDisable: () => void;
}

export function mountBreathe(choice: BreatheChoice): () => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const word = el('div', { class: 'setu-breathe__word', role: 'status' }, reduced ? '' : 'in…');
  const circle = el('div', { class: 'setu-breathe__circle' });

  let close = () => {};

  const offer = el(
    'div',
    { class: 'setu-card setu-breathe__offer' },
    el(
      'p',
      { style: 'margin:0;font-size:1.05rem' },
      // This sentence is load-bearing. It describes the PAGE, never the person.
      'This page looks intense. Want me to simplify it and show the next step?',
    ),
    el(
      'div',
      { class: 'setu-breathe__actions' },
      el(
        'button',
        {
          class: 'setu-btn setu-btn--primary',
          onclick: () => {
            close();
            choice.onAccept();
          },
        },
        'Yes, simplify',
      ),
      el(
        'button',
        {
          class: 'setu-btn',
          onclick: () => {
            close();
            choice.onDismiss();
          },
        },
        'Just breathing, thanks',
      ),
      el(
        'button',
        {
          class: 'setu-btn setu-btn--quiet',
          onclick: () => {
            close();
            choice.onDisable();
          },
        },
        "Don't do this again",
      ),
    ),
  );

  // The offer only appears AFTER one full breath. Leading with a question is
  // what every other nudge product does, and it is the wrong order for someone
  // who is already at the edge of it.
  if (reduced) {
    offer.style.animation = 'none';
    offer.style.opacity = '1';
  }

  const wrap = el(
    'div',
    { class: 'setu-root setu-breathe', role: 'dialog', ariaLabel: 'A pause' },
    el('div', {}, circle, word, offer),
  );

  close = mount(wrap, { trapFocus: false });

  if (!reduced) {
    const beats: Array<[number, string]> = [
      [0, 'in…'],
      [4000, 'hold…'],
      [8000, 'out…'],
      [12000, ''],
    ];
    for (const [at, text] of beats) setTimeout(() => (word.textContent = text), at);
    // Focus the primary action only once it is visible: a keyboard user should
    // never be focused on something they cannot yet see.
    setTimeout(() => offer.querySelector('button')?.focus(), 12200);
  } else {
    offer.querySelector('button')?.focus();
  }

  return close;
}

/* ── PANIC (§42.12) ───────────────────────────────────────────────────────── */

export interface PanicInfo {
  where: string;
  actionLabel: string;
  onAction: () => void;
}

export function mountPanic(info: PanicInfo): () => void {
  let close = () => {};

  const card = el(
    'div',
    { class: 'setu-card setu-panic__card' },
    el('p', { class: 'setu-panic__where' }, info.where),
    el(
      'button',
      {
        class: 'setu-btn setu-btn--primary',
        style: 'width:100%',
        onclick: () => {
          close();
          info.onAction();
        },
      },
      info.actionLabel,
    ),
    el('p', { class: 'setu-meta', style: 'margin:16px 0 0' }, 'Press Esc to bring the page back.'),
  );

  const wrap = el(
    'div',
    {
      class: 'setu-root setu-panic',
      role: 'dialog',
      ariaModal: 'true',
      ariaLabel: 'Where you are',
    },
    card,
  );

  close = mount(wrap, { trapFocus: true });
  return close;
}

/* ── the quiet corner suggestion ──────────────────────────────────────────── */

export interface SuggestOptions {
  cls: CLSBreakdown;
  onAccept: () => void;
  onDismiss?: () => void;
}

export function mountSuggestion({ cls, onAccept, onDismiss }: SuggestOptions): () => void {
  let close = () => {};

  const wrap = el(
    'div',
    { class: 'setu-root setu-toast setu-card', role: 'status' },
    el('strong', { style: 'display:block;font-size:1rem' }, `Load score ${cls.score}/100`),
    el('p', { class: 'setu-meta', style: 'margin:6px 0 0' }, describeCLS(cls)),
    el(
      'div',
      { class: 'setu-toast__row' },
      el(
        'button',
        {
          class: 'setu-btn setu-btn--primary',
          onclick: () => {
            close();
            onAccept();
          },
        },
        'Simplify this page',
      ),
      el(
        'button',
        {
          class: 'setu-btn setu-btn--quiet',
          onclick: () => {
            close();
            onDismiss?.();
          },
        },
        'Not now',
      ),
    ),
  );

  close = mount(wrap);
  // Never nag. Ignored for twelve seconds means it goes away by itself.
  const timer = setTimeout(() => close(), 12_000);
  return () => {
    clearTimeout(timer);
    close();
  };
}

/* ── COMMANDER confirmation (§22.3, rails 1 and 3) ────────────────────────── */

export interface ConfirmPlanOptions {
  understood: string;
  lines: Array<{ text: string; risk: 'safe' | 'writes-data' | 'irreversible' }>;
  requiresTyped: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function mountPlanConfirm(o: ConfirmPlanOptions): () => void {
  let close = () => {};

  const list = el('ol', { style: 'margin:12px 0;padding-left:20px' });
  for (const line of o.lines) {
    const badge =
      line.risk === 'safe' ? '' : line.risk === 'writes-data' ? ' — changes data' : ' — cannot be undone';
    list.append(el('li', { style: 'margin:6px 0' }, line.text + badge));
  }

  const confirmBtn = el(
    'button',
    {
      class: 'setu-btn setu-btn--primary',
      disabled: o.requiresTyped,
      onclick: () => {
        close();
        o.onConfirm();
      },
    },
    o.requiresTyped ? 'Type OK to continue' : 'Do it',
  );

  let typed: HTMLInputElement | null = null;
  if (o.requiresTyped) {
    // Rail 3: an irreversible action needs a TYPED confirmation, not a click.
    // A click is muscle memory. Typing is a decision.
    typed = el('input', {
      class: 'setu-btn',
      placeholder: 'Type OK',
      ariaLabel: 'Type OK to allow an action that cannot be undone',
    }) as HTMLInputElement;
    typed.addEventListener('input', () => {
      const ok = typed!.value.trim().toUpperCase() === 'OK';
      confirmBtn.disabled = !ok;
      confirmBtn.textContent = ok ? 'Do it' : 'Type OK to continue';
    });
  }

  const wrap = el(
    'div',
    {
      class: 'setu-root setu-card',
      style: 'right:20px;bottom:20px;max-width:26rem',
      role: 'dialog',
      ariaModal: 'true',
      ariaLabel: 'Confirm these actions',
    },
    el('strong', { style: 'display:block' }, o.understood),
    el(
      'p',
      { class: 'setu-meta', style: 'margin:6px 0 0' },
      'SETU will do this one step at a time. You can stop at any point with Esc.',
    ),
    list,
    ...(typed ? [typed] : []),
    el(
      'div',
      { class: 'setu-toast__row' },
      confirmBtn,
      el(
        'button',
        {
          class: 'setu-btn',
          onclick: () => {
            close();
            o.onCancel();
          },
        },
        'Cancel',
      ),
    ),
  );

  close = mount(wrap, { trapFocus: true });
  return close;
}

/* ── spotlight, used by GUIDE and by COMMANDER during execution ───────────── */

let spotlightEl: HTMLElement | null = null;

export function spotlight(target: HTMLElement | null, label: string): void {
  clearSpotlight();
  if (!target) return;

  const r = target.getBoundingClientRect();
  const node = el(
    'div',
    { class: 'setu-spotlight' },
    el('span', { class: 'setu-spotlight__label' }, label),
  );
  node.style.left = `${r.left + scrollX - 4}px`;
  node.style.top = `${r.top + scrollY - 4}px`;
  node.style.width = `${r.width + 8}px`;
  node.style.height = `${r.height + 8}px`;

  // Positioned in PAGE coordinates, so it lives in the page rather than in the
  // shadow root's fixed layer.
  node.setAttribute('data-setu-skip', '1');
  document.body.appendChild(node);
  spotlightEl = node;

  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function clearSpotlight(): void {
  spotlightEl?.remove();
  spotlightEl = null;
}

/* ── line guide ───────────────────────────────────────────────────────────── */

let guideEl: HTMLElement | null = null;
let guideMove: ((e: MouseEvent) => void) | null = null;

export function enableLineGuide(): void {
  if (guideEl) return;
  guideEl = el('div', { class: 'setu-line-guide' });
  guideEl.setAttribute('data-setu-skip', '1');
  document.body.appendChild(guideEl);

  guideMove = (e: MouseEvent) => {
    if (guideEl) guideEl.style.top = `${e.clientY - 18}px`;
  };
  document.addEventListener('mousemove', guideMove, { passive: true });
}

export function disableLineGuide(): void {
  guideEl?.remove();
  guideEl = null;
  if (guideMove) document.removeEventListener('mousemove', guideMove);
  guideMove = null;
}
