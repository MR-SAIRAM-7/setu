import type { PIIKind, PIISpan } from '../types';

/**
 * PII SCRUB (§12.2). Runs CLIENT-SIDE, before Stage 4, always.
 *
 * Detected spans are replaced with typed placeholders (⟦EMAIL_1⟧) and
 * rehydrated after the model returns. This costs ~3 hours to build and buys
 * the entire privacy conversation with a judge.
 *
 * It is a heuristic net, not a guarantee. Say that plainly: "we redact the
 * shapes we can recognise — email, phone, Aadhaar-shaped, PAN-shaped, cards
 * with a valid Luhn checksum — and the user sees the redacted payload before
 * they consent to send it."
 */

const OPEN = '⟦'; // ⟦
const CLOSE = '⟧'; // ⟧

export interface RedactResult {
  text: string;
  spans: PIISpan[];
}

interface Rule {
  kind: PIIKind;
  re: RegExp;
  validate?: (m: string) => boolean;
}

const RULES: Rule[] = [
  {
    kind: 'EMAIL',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    // Indian mobile, with or without +91 and with or without the conventional
    // 5+5 grouping ("+91 98765 43210"), plus general international.
    kind: 'PHONE',
    re: /\+?\d{0,3}[\s-]?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{6,12}\b/g,
  },
  {
    // Aadhaar shape: 4-4-4. Reject obviously-fake runs of a single digit.
    kind: 'AADHAAR',
    re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    validate: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length === 12 && !/^(\d)\1{11}$/.test(d);
    },
  },
  {
    kind: 'PAN',
    re: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  },
  {
    kind: 'CARD',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (m) => luhn(m.replace(/\D/g, '')),
  },
  {
    kind: 'IBAN',
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  },
  {
    kind: 'DOB',
    re: /\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:19|20)\d{2}\b/g,
  },
  {
    // Bearer tokens / API keys that wandered into a page or a paste
    kind: 'URL_TOKEN',
    re: /\b(?:sk|pk|ghp|gho|AIza)[A-Za-z0-9_-]{16,}\b/g,
  },
];

export function luhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Replace every detected span with a stable placeholder. Identical values get
 * the SAME placeholder, so the model can still reason about "the same person"
 * appearing twice without ever seeing who they are.
 */
export function redactPII(text: string): RedactResult {
  if (!text) return { text: '', spans: [] };

  const found: Array<{ start: number; end: number; kind: PIIKind; original: string }> = [];

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text)) !== null) {
      const value = m[0];
      if (rule.validate && !rule.validate(value)) continue;
      found.push({ start: m.index, end: m.index + value.length, kind: rule.kind, original: value });
      if (rule.re.lastIndex === m.index) rule.re.lastIndex++; // zero-width guard
    }
  }

  // Longest match wins where rules overlap (a card beats a phone).
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: typeof found = [];
  let cursor = -1;
  for (const f of found) {
    if (f.start < cursor) continue;
    kept.push(f);
    cursor = f.end;
  }

  const counters: Partial<Record<PIIKind, number>> = {};
  const byOriginal = new Map<string, string>();
  const spans: PIISpan[] = [];

  let out = '';
  let last = 0;
  for (const f of kept) {
    let placeholder = byOriginal.get(f.original);
    if (!placeholder) {
      const n = (counters[f.kind] ?? 0) + 1;
      counters[f.kind] = n;
      placeholder = `${OPEN}${f.kind}_${n}${CLOSE}`;
      byOriginal.set(f.original, placeholder);
    }
    out += text.slice(last, f.start) + placeholder;
    spans.push({ start: f.start, end: f.end, kind: f.kind, placeholder, original: f.original });
    last = f.end;
  }
  out += text.slice(last);

  return { text: out, spans };
}

/**
 * Put the real values back. Walks any JSON structure, because placeholders can
 * legitimately appear inside any string field of any TransformArtifact.
 */
export function rehydrate<T>(value: T, spans: PIISpan[]): T {
  if (!spans.length) return value;

  const map = new Map<string, string>();
  for (const s of spans) map.set(s.placeholder, s.original);

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let out = v;
      for (const [ph, original] of map) {
        if (out.includes(ph)) out = out.split(ph).join(original);
      }
      return out;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = walk(val);
      return o;
    }
    return v;
  };

  return walk(value) as T;
}

/** For the consent dialog: "12 things will be hidden before this is sent." */
export function summariseRedactions(spans: PIISpan[]): string {
  if (!spans.length) return 'Nothing that looks personal was found in this text.';
  const counts = new Map<PIIKind, number>();
  for (const s of spans) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const parts = [...counts.entries()].map(([k, n]) => `${n} ${LABEL[k]}${n > 1 ? 's' : ''}`);
  return `${spans.length} item${spans.length > 1 ? 's' : ''} will be hidden before sending: ${parts.join(', ')}.`;
}

const LABEL: Record<PIIKind, string> = {
  EMAIL: 'email address',
  PHONE: 'phone number',
  AADHAAR: 'Aadhaar-shaped number',
  PAN: 'PAN-shaped code',
  CARD: 'card number',
  IBAN: 'bank account code',
  DOB: 'date of birth',
  PIN: 'PIN code',
  URL_TOKEN: 'access token',
};
