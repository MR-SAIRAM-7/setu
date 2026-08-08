import { DEFAULT_DNA, type DNAProfile } from './types';

/**
 * THE ACCESSIBILITY DNA PROFILE (§9).
 *
 * The thing that makes SETU a cognitive OS rather than a bag of tools: one
 * profile, read and written by all three surfaces, parameterising all nine modes.
 *
 * Do NOT ask "do you have ADHD?" Ask about EXPERIENCE. This file is Axiom 4 in
 * code — the system never holds an opinion about a condition, only a record of
 * what the user said works for them.
 */

export type OnboardingCard = 'lose-place' | 'cant-start' | 'busy-pages' | 'forget-doing';

export const ONBOARDING_CARDS: Array<{ id: OnboardingCard; label: string; hint: string }> = [
  {
    id: 'lose-place',
    label: 'I lose my place when reading',
    hint: 'Lines run together, or you re-read the same sentence.',
  },
  {
    id: 'cant-start',
    label: "I can't get started",
    hint: 'You know what to do. Beginning is the part that does not happen.',
  },
  {
    id: 'busy-pages',
    label: 'Busy pages overwhelm me',
    hint: 'Too much moving, too many choices, nowhere to rest.',
  },
  {
    id: 'forget-doing',
    label: 'I forget what I was doing',
    hint: 'You come back to a tab and the thread is gone.',
  },
];

/** §9.2 — selections map to settings. Nothing here records a condition. */
export function dnaFromCards(cards: OnboardingCard[], base: DNAProfile = DEFAULT_DNA): DNAProfile {
  const dna: DNAProfile = structuredCloneish(base);

  if (cards.includes('lose-place')) {
    dna.bionic = { enabled: true, intensity: 2 };
    dna.lineGuide = true;
    dna.fontStack = 'atkinson';
  }
  if (cards.includes('cant-start')) {
    dna.chunkSize = 3;
    dna.breathe = { enabled: true, sensitivity: 2 };
  }
  if (cards.includes('busy-pages')) {
    dna.density = 'minimal';
    dna.motion = 'none';
  }
  if (cards.includes('forget-doing')) {
    dna.privacy = { ...dna.privacy, vaultSync: true };
  }

  return dna;
}

/** Which surface affordances to pin, given the same selections. */
export function pinsFromCards(cards: OnboardingCard[]): string[] {
  const pins: string[] = [];
  if (cards.includes('cant-start')) pins.push('START');
  if (cards.includes('busy-pages')) pins.push('FOCUS');
  if (cards.includes('forget-doing')) pins.push('REWIND');
  if (cards.includes('lose-place')) pins.push('BIONIC');
  return pins;
}

/**
 * Merge a stored profile over the defaults so a profile written by an older
 * version never produces `undefined` in a renderer. Cheap forward-compatibility.
 */
export function normaliseDNA(input: unknown): DNAProfile {
  const p = (input ?? {}) as Partial<DNAProfile>;
  return {
    ...DEFAULT_DNA,
    ...p,
    bionic: { ...DEFAULT_DNA.bionic, ...(p.bionic ?? {}) },
    breathe: { ...DEFAULT_DNA.breathe, ...(p.breathe ?? {}) },
    privacy: { ...DEFAULT_DNA.privacy, ...(p.privacy ?? {}) },
  };
}

/** §15 rule 1: last-write-wins on the whole object, guarded by updated_at. */
export function mergeDNA(
  local: { dna: DNAProfile; updatedAt: number },
  remote: { dna: DNAProfile; updatedAt: number },
): { dna: DNAProfile; updatedAt: number } {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/** CSS custom properties the DNA implies. Applied to <html> on every surface. */
export function dnaToAttributes(dna: DNAProfile): Record<string, string> {
  return {
    'data-setu-font': dna.fontStack,
    'data-setu-density': dna.density,
    'data-setu-motion': dna.motion === 'full' ? 'full' : dna.motion,
    'data-setu-reading': dna.readingLevel,
  };
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
