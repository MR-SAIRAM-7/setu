/**
 * FOCUS MODE — deterministic DOM surgery (§34.4). Tier L0.
 * Zero network, zero AI, zero marginal cost, works with the wifi off.
 */

export interface RemovedCounts {
  ads: number;
  motion: number;
  scripts: number;
  nodes: number;
}

const NOISE = [
  '[class*="ad-" i]',
  '[class*="-ad" i]',
  '[id*="google_ads"]',
  'ins.adsbygoogle',
  '[aria-label*="advertisement" i]',
  '[class*="cookie" i]',
  '[class*="consent" i]',
  '[class*="newsletter" i]',
  '[class*="popup" i]',
  '[class*="modal" i]',
  '[class*="banner" i]',
  '[class*="sticky" i]',
  '[class*="social-share" i]',
  '[class*="share-buttons" i]',
  '[class*="related" i]',
  '[class*="recommend" i]',
  '[class*="carousel" i]',
  '[class*="promo" i]',
  '[class*="subscribe" i]',
  '[role="complementary"]',
  'aside',
  'footer',
  'nav',
];

/**
 * ⚠️ THE MOST IMPORTANT 8 LINES IN THE EXTENSION.
 *
 * Without this protection pass, focus mode will eventually hide the submit
 * button on a government form — a catastrophic failure for exactly the user
 * SETU is built for. There is a test for this and it must never be deleted.
 */
const KEEP_ALWAYS =
  'form,input,select,textarea,button,label,fieldset,legend,' +
  '[role="alert"],[role="status"],[role="main"],[role="form"],' +
  'time,[class*="deadline" i],[class*="due" i],[class*="error" i],[class*="required" i],' +
  'a[href*="login"],a[href*="signin"],a[href*="submit"],[type="submit"]';

export const FOCUS_ATTR = 'data-setu-focus';
export const HIDDEN_ATTR = 'data-setu-hidden';
export const MOTION_ATTR = 'data-setu-motion';

export function focusMode(doc: Document): RemovedCounts {
  const removed: RemovedCounts = { ads: 0, motion: 0, scripts: 0, nodes: 0 };
  if (!doc?.documentElement) return removed;

  /* 1. Never remove anything the user might NEED to act on.
        Walk UP from every protected control marking all ancestors, so we can
        never hide a container that happens to wrap the submit button. */
  const protectedSet = new Set<Element>();
  doc.querySelectorAll(KEEP_ALWAYS).forEach((el) => {
    let p: Element | null = el;
    while (p) {
      protectedSet.add(p);
      p = p.parentElement;
    }
  });

  /* 2. Remove noise that is not protected. Hide, never delete — undo must work. */
  for (const sel of NOISE) {
    let matches: NodeListOf<Element>;
    try {
      matches = doc.querySelectorAll(sel);
    } catch {
      continue; // a selector the engine dislikes must not kill the whole pass
    }
    matches.forEach((el) => {
      if (protectedSet.has(el)) return;
      if (el.hasAttribute(HIDDEN_ATTR)) return;
      // Don't hide something that contains the bulk of the page's text.
      if ((el.textContent?.length ?? 0) > 4000) return;
      removed.nodes += el.querySelectorAll('*').length + 1;
      removed.ads++;
      el.setAttribute(HIDDEN_ATTR, '1');
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });
  }

  /* 3. Kill motion. */
  doc.querySelectorAll('video[autoplay],audio[autoplay]').forEach((v) => {
    try {
      (v as HTMLMediaElement).pause();
      (v as HTMLMediaElement).autoplay = false;
      removed.motion++;
    } catch {
      /* cross-origin media object — nothing to do, and not worth failing over */
    }
  });
  doc.documentElement.setAttribute(MOTION_ATTR, 'none');

  /* 4. Reading column: CSS constrains the measure to 60–75 characters. */
  doc.documentElement.setAttribute(FOCUS_ATTR, 'on');

  return removed;
}

export function undoFocus(doc: Document): void {
  if (!doc?.documentElement) return;
  doc.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => {
    (el as HTMLElement).style.removeProperty('display');
    el.removeAttribute(HIDDEN_ATTR);
  });
  doc.documentElement.removeAttribute(FOCUS_ATTR);
  doc.documentElement.removeAttribute(MOTION_ATTR);
}

export function isFocusOn(doc: Document): boolean {
  return doc?.documentElement?.getAttribute(FOCUS_ATTR) === 'on';
}

/**
 * Re-apply hiding after an SPA route change without re-running the full
 * protection walk. Cheap enough to call from a debounced MutationObserver.
 */
export function reapplyFocus(doc: Document): void {
  if (!isFocusOn(doc)) return;
  focusMode(doc);
}
