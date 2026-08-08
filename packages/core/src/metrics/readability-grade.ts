/**
 * Flesch–Kincaid grade level, plus the syllable estimator it needs.
 * Deterministic, L0, ~0.2ms on a page of text.
 */

const VOWELS = /[aeiouy]+/g;

/** Heuristic English syllable count. Not perfect; consistent, which is what matters. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');

  const groups = trimmed.match(VOWELS);
  return Math.max(1, groups ? groups.length : 1);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+[\s\n]|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

/**
 * Flesch–Kincaid: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 * Clamped to 0..20 — negative grades and grade-40 outliers are noise, not signal.
 */
export function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  if (!sentences.length || !words.length) return 0;

  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const raw =
    0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;

  return Math.max(0, Math.min(20, Math.round(raw * 10) / 10));
}

/** Average words per sentence — used directly by the CLS textual component. */
export function avgWordsPerSentence(text: string): number {
  const sentences = splitSentences(text);
  if (!sentences.length) return 0;
  const total = sentences.reduce((a, s) => a + splitWords(s).length, 0);
  return total / sentences.length;
}

/** Rough reading time in minutes at 200wpm, floor 1. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(splitWords(text).length / 200));
}
