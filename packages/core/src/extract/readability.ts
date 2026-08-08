import type { Block, FormField } from '../types';

/**
 * Main-content extraction (§12.2).
 *
 * A dependency-free scorer in the spirit of Readability. We do not pull in
 * @mozilla/readability here because the kernel must stay importable from a
 * content script, a service worker, a Next.js route AND React Native — and a
 * jsdom-shaped dependency breaks two of those. The server can layer the real
 * Readability on top when it has a full DOM.
 *
 * "A good extraction with a mediocre model beats a great model on raw HTML
 * soup, every time." — §12.2, and it is the thing teams most under-build.
 */

const BLOCK_NOISE =
  /\b(nav|menu|sidebar|footer|header|comment|share|social|promo|advert|ad-|banner|cookie|consent|related|recommend|subscribe|newsletter|breadcrumb|pagination|widget)\b/i;

const POSITIVE = /\b(article|content|main|body|post|entry|text|story|page-content)\b/i;

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'CANVAS',
  'IFRAME',
  'NAV',
  'FOOTER',
  'ASIDE',
  'TEMPLATE',
]);

export interface ExtractedContent {
  title: string;
  text: string;
  blocks: Block[];
  lang: string;
  root: HTMLElement | null;
}

/** Score candidate containers and pick the densest block of real prose. */
export function findMainContent(doc: Document): HTMLElement | null {
  const explicit =
    doc.querySelector<HTMLElement>('main, [role="main"], article, [itemprop="articleBody"]');
  if (explicit && textLength(explicit) > 250) return explicit;

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('div,section,article,td'));
  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const el of candidates.slice(0, 3000)) {
    const idClass = `${el.id} ${el.className}`;
    if (typeof el.className !== 'string') continue;
    if (BLOCK_NOISE.test(idClass)) continue;

    const paragraphs = el.querySelectorAll('p');
    if (paragraphs.length < 2) continue;

    const len = textLength(el);
    if (len < 250) continue;

    const links = el.querySelectorAll('a').length;
    const linkText = Array.from(el.querySelectorAll('a')).reduce(
      (a, x) => a + (x.textContent?.length ?? 0),
      0,
    );
    const linkDensity = len ? linkText / len : 1;
    if (linkDensity > 0.5) continue; // a list of links is not an article

    let score = len / 100 + paragraphs.length * 3 - links * 0.5;
    if (POSITIVE.test(idClass)) score *= 1.5;

    // Prefer shallower containers when scores are close — deeper means fragment.
    score -= depth(el, doc) * 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best ?? doc.body ?? null;
}

export function extractContent(doc: Document): ExtractedContent {
  const root = findMainContent(doc);
  const title = pickTitle(doc);
  const lang = doc.documentElement?.getAttribute('lang') || 'en';
  const blocks = root ? toBlocks(root) : [];
  const text = blocks
    .map((b) => (b.items?.length ? b.items.join('\n') : b.text))
    .filter(Boolean)
    .join('\n\n');

  return { title, text, blocks, lang, root };
}

export function pickTitle(doc: Document): string {
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (og?.trim()) return og.trim();
  const h1 = doc.querySelector('h1')?.textContent?.trim();
  if (h1) return h1;
  return (doc.title || 'Untitled').trim();
}

/** DOM → semantic blocks. Order-preserving, decoration-free. */
export function toBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = [];
  const seen = new Set<Element>();

  const walk = (el: Element): void => {
    if (SKIP_TAGS.has(el.tagName)) return;
    if (seen.has(el)) return;

    const tag = el.tagName.toLowerCase();
    const text = clean(el.textContent ?? '');

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
        if (text) {
          blocks.push({ type: tag as 'h1' | 'h2' | 'h3', text });
          seen.add(el);
        }
        return;
      case 'h4':
      case 'h5':
      case 'h6':
        if (text) {
          blocks.push({ type: 'h3', text });
          seen.add(el);
        }
        return;
      case 'p': {
        if (text.length > 1) {
          blocks.push({ type: 'p', text });
          seen.add(el);
        }
        return;
      }
      case 'ul':
      case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map((li) => clean(li.textContent ?? ''))
          .filter(Boolean);
        if (items.length) {
          blocks.push({ type: tag === 'ul' ? 'ul' : 'ol', text: items.join(' • '), items });
          seen.add(el);
          el.querySelectorAll('*').forEach((c) => seen.add(c));
        }
        return;
      }
      case 'blockquote':
        if (text) {
          blocks.push({ type: 'quote', text });
          seen.add(el);
        }
        return;
      case 'pre':
        if (text) {
          blocks.push({ type: 'code', text });
          seen.add(el);
          el.querySelectorAll('*').forEach((c) => seen.add(c));
        }
        return;
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'))
          .slice(0, 30)
          .map((tr) =>
            Array.from(tr.querySelectorAll('th,td'))
              .map((c) => clean(c.textContent ?? ''))
              .join(' | '),
          )
          .filter(Boolean);
        if (rows.length) {
          blocks.push({ type: 'table', text: rows.join('\n'), items: rows });
          seen.add(el);
          el.querySelectorAll('*').forEach((c) => seen.add(c));
        }
        return;
      }
      case 'figure': {
        const cap = clean(el.querySelector('figcaption')?.textContent ?? '');
        const alt = el.querySelector('img')?.getAttribute('alt') ?? '';
        const t = cap || alt;
        if (t) {
          blocks.push({ type: 'figure', text: t });
          seen.add(el);
          el.querySelectorAll('*').forEach((c) => seen.add(c));
        }
        return;
      }
      default:
        break;
    }

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);

  // Fallback: a page with no semantic structure still needs to produce something.
  if (!blocks.length) {
    const raw = clean(root.textContent ?? '');
    if (raw) blocks.push({ type: 'p', text: raw });
  }

  return blocks;
}

/** Interactive inventory — feeds START chunking, GUIDE and COMMANDER. */
export function extractFormFields(doc: Document): FormField[] {
  const out: FormField[] = [];
  doc.querySelectorAll<HTMLElement>('input,select,textarea').forEach((el) => {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    if (type === 'hidden') return;
    const name = (el as HTMLInputElement).name || el.id || '';
    const label =
      el.getAttribute('aria-label') ??
      el.closest('label')?.textContent?.trim() ??
      (el.id ? doc.querySelector(`label[for="${cssEscape(el.id)}"]`)?.textContent?.trim() : '') ??
      el.getAttribute('placeholder') ??
      name;
    out.push({
      name,
      type,
      required: !!(el as HTMLInputElement).required,
      label: clean(label ?? '').slice(0, 80),
    });
  });
  return out.slice(0, 60);
}

export function hasMotion(doc: Document): boolean {
  if (doc.querySelector('video[autoplay],audio[autoplay],marquee')) return true;
  const view = doc.defaultView;
  if (!view?.getComputedStyle) return false;
  const sample = Array.from(doc.querySelectorAll('*')).slice(0, 200);
  return sample.some((el) => {
    try {
      return view.getComputedStyle(el).animationName !== 'none';
    } catch {
      return false;
    }
  });
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function textLength(el: Element): number {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().length;
}

function depth(el: Element, doc: Document): number {
  let d = 0;
  let p: Element | null = el;
  while (p && p !== doc.body) {
    d++;
    p = p.parentElement;
  }
  return d;
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}
