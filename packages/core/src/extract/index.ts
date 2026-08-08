import type { Extracted } from '../types';
import { computeCLS, computeTextCLS } from '../metrics/cls';
import { fleschKincaidGrade, splitWords } from '../metrics/readability-grade';
import { extractContent, extractFormFields, hasMotion } from './readability';
import { redactPII } from './pii';

export * from './readability';
export * from './pii';
export * from './transcript';

/**
 * Stage 2 — EXTRACT, assembled (§12.2).
 *
 * One call takes a live Document to a fully-characterised `Extracted`:
 * clean text, semantic blocks, reading grade, Cognitive Load Score, interactive
 * inventory, and the PII spans that must never leave the device unredacted.
 */
export function extractFromDocument(doc: Document): Extracted {
  const { title, text, blocks, lang } = extractContent(doc);
  const cls = computeCLS(doc, text);
  const { spans } = redactPII(text);

  return {
    title,
    text,
    blocks,
    lang,
    wordCount: splitWords(text).length,
    readingGrade: fleschKincaidGrade(text),
    cls,
    interactive: extractFormFields(doc),
    hasMotion: hasMotion(doc),
    piiSpans: spans,
  };
}

/** Same shape from a text-only artifact: a PDF page range, a paste, a transcript. */
export function extractFromText(text: string, title = 'Text'): Extracted {
  const { spans } = redactPII(text);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    title,
    text,
    blocks: paragraphs.map((p) => ({ type: 'p' as const, text: p })),
    lang: 'en',
    wordCount: splitWords(text).length,
    readingGrade: fleschKincaidGrade(text),
    cls: computeTextCLS(text),
    interactive: [],
    hasMotion: false,
    piiSpans: spans,
  };
}

/**
 * Truncate to a token-ish budget without cutting mid-sentence.
 * Used before every cloud call — §25.2 lists input truncation as the single
 * biggest cost lever on LEARN.
 */
export function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  const cut = words.slice(0, maxWords).join(' ');
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return lastStop > cut.length * 0.6 ? cut.slice(0, lastStop + 1) : cut;
}
