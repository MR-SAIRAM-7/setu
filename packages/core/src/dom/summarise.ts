import type { DomEl, DomSummary } from '../types';

/**
 * THE AGENT'S PERCEPTION (§22.1)
 *
 * You cannot send raw HTML to a model — it is enormous and full of noise. You
 * send a summary: a numbered list of only the interactive and landmark elements.
 *
 * Why `id` handles ('e12') and not CSS selectors: the model CANNOT invent `e57`
 * if `e57` was never in the summary, and if it tries, lookup fails safely and we
 * refuse the plan. A model that hallucinates `button.submit-btn` produces a
 * plausible-looking action that silently clicks the wrong thing.
 *
 *   Constrain the action space by construction, not by hope.
 *
 * That is the core safety idea in the entire agent.
 */

/** Handles live only in this page's memory. Never serialised, never sent. */
const REGISTRY = new Map<string, WeakRef<HTMLElement>>();

const SELECTOR =
  'a[href],button,input,select,textarea,' +
  '[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="tab"],' +
  '[contenteditable="true"],h1,h2,h3,[role="main"],form';

/** Hard cap on tokens. 120 elements is roughly 2.5k tokens of summary. */
const MAX_ELEMENTS = 120;

/**
 * ⚠️ SAFETY RAIL #4 (§22.3): password, OTP and payment fields are stripped
 * BEFORE the model ever sees the page. The agent cannot fill what it cannot see.
 * This is enforced here, at perception time, not at execution time — because a
 * check at execution time is a check that can be forgotten.
 */
const FORBIDDEN_TYPES = new Set(['password', 'hidden']);
const FORBIDDEN_NAME = /pass|pwd|otp|cvv|cvc|card.?number|ccnum|securitycode|pin\b|aadhaar|ssn/i;
const FORBIDDEN_AUTOCOMPLETE = /cc-|current-password|new-password|one-time-code/i;

export function isSensitiveField(el: Element): boolean {
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? '';
  if (FORBIDDEN_TYPES.has(type)) return true;

  const probe = [
    (el as HTMLInputElement).name,
    el.id,
    el.getAttribute('aria-label'),
    el.getAttribute('placeholder'),
    (el as HTMLInputElement).autocomplete,
  ]
    .filter(Boolean)
    .join(' ');

  if (FORBIDDEN_NAME.test(probe)) return true;
  if (FORBIDDEN_AUTOCOMPLETE.test((el as HTMLInputElement).autocomplete ?? '')) return true;
  return false;
}

export function summariseDom(doc: Document): DomSummary {
  REGISTRY.clear();
  const els: DomEl[] = [];
  let withheld = 0;
  let i = 0;

  // Whether this document has a real layout engine behind it. In a headless
  // DOM (tests, a detached document, some PDF viewers) every rect is zero, and
  // treating that as "everything is invisible" would hand the agent an empty
  // page — which looks exactly like a page with no controls, and is the worst
  // possible failure mode because it is silent.
  const layoutAvailable = (doc.documentElement?.getBoundingClientRect?.()?.height ?? 0) > 0;

  for (const node of Array.from(doc.querySelectorAll<HTMLElement>(SELECTOR))) {
    if (els.length >= MAX_ELEMENTS) break;

    if (isSensitiveField(node)) {
      withheld++;
      continue;
    }

    const r = node.getBoundingClientRect?.();
    const cs = doc.defaultView?.getComputedStyle(node);
    const styledHidden = cs?.visibility === 'hidden' || cs?.display === 'none' || node.hidden;
    const hasBox = !layoutAvailable || (!!r && r.width > 0 && r.height > 0);
    const visible = !styledHidden && hasBox;

    // Invisible non-inputs are noise. Invisible inputs may still matter (tabs, steps).
    if (!visible && !(node instanceof HTMLInputElement)) continue;

    const id = `e${i++}`;
    REGISTRY.set(id, new WeakRef(node));

    const el: DomEl = {
      id,
      role: inferRole(node),
      name: accessibleName(node).slice(0, 80),
      visible,
    };
    const value = (node as HTMLInputElement).value;
    if (value) el.value = String(value).slice(0, 40);
    const type = (node as HTMLInputElement).type;
    if (type) el.type = type;
    if ((node as HTMLInputElement).required) el.required = true;
    const section = nearestLandmark(node);
    if (section) el.section = section;

    els.push(el);
  }

  return {
    url: doc.location?.href ?? '',
    title: doc.title ?? '',
    elements: els,
    withheld,
  };
}

/** Resolve a model-supplied handle back to a real node. Returns null on any miss. */
export function resolveElement(id: string): HTMLElement | null {
  const ref = REGISTRY.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) return null;
  return el;
}

export function knownElementIds(): Set<string> {
  return new Set(REGISTRY.keys());
}

export function clearRegistry(): void {
  REGISTRY.clear();
}

/** Serialise the summary into the exact lines the model sees. */
export function renderDomSummary(dom: DomSummary): string {
  return dom.elements
    .map(
      (e) =>
        `${e.id} [${e.role}] "${e.name}"` +
        (e.required ? ' *required' : '') +
        (e.type && e.type !== 'text' ? ` type=${e.type}` : '') +
        (e.value ? ` value="${e.value}"` : '') +
        (e.section ? ` in ${e.section}` : '') +
        (e.visible ? '' : ' (offscreen)'),
    )
    .join('\n');
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

export function inferRole(el: HTMLElement): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;

  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'a':
      return 'link';
    case 'button':
      return 'button';
    case 'select':
      return 'select';
    case 'textarea':
      return 'textbox';
    case 'form':
      return 'form';
    case 'h1':
    case 'h2':
    case 'h3':
      return 'heading';
    case 'input': {
      const t = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button') return 'button';
      if (t === 'file') return 'file';
      return 'textbox';
    }
    default:
      return el.isContentEditable ? 'textbox' : 'region';
  }
}

export function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument?.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }

  if (el.id) {
    const lbl = el.ownerDocument?.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }

  const wrapping = el.closest('label');
  if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();

  const placeholder = el.getAttribute('placeholder');
  if (placeholder?.trim()) return placeholder.trim();

  const title = el.getAttribute('title');
  if (title?.trim()) return title.trim();

  const alt = el.querySelector('img[alt]')?.getAttribute('alt');
  if (alt?.trim()) return alt.trim();

  const text = el.textContent?.replace(/\s+/g, ' ').trim();
  if (text) return text;

  const name = (el as HTMLInputElement).name;
  return name ? `field: ${name}` : '(unlabelled)';
}

export function nearestLandmark(el: HTMLElement): string | undefined {
  let p: HTMLElement | null = el.parentElement;
  let hops = 0;
  while (p && hops++ < 12) {
    const role = p.getAttribute('role');
    const tag = p.tagName.toLowerCase();
    if (role === 'main' || tag === 'main') return 'main content';
    if (role === 'navigation' || tag === 'nav') return 'navigation';
    if (tag === 'form') {
      const legend = p.querySelector('legend,h1,h2,h3')?.textContent?.trim();
      return legend ? `form: ${legend.slice(0, 40)}` : 'a form';
    }
    if (tag === 'section' || tag === 'article') {
      const h = p.querySelector('h1,h2,h3')?.textContent?.trim();
      if (h) return h.slice(0, 40);
    }
    p = p.parentElement;
  }
  return undefined;
}
