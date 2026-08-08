import type { Artifact, Mode } from '../types';

export * from './tier';

/**
 * THE ROUTER (§19).
 *
 * Mode selection: explicit > heuristic > classifier.
 *
 * Note there is NO LLM call in the happy path. A mode classifier that costs
 * 800ms before the real work begins is a bad trade for a user whose entire
 * problem is that waiting feels impossible.
 */

const EXPLICIT_TRIGGERS: Array<[string, Mode]> = [
  ['what does this mean', 'EXPLAIN'],
  ['how do i', 'GUIDE'],
  ['walk me through', 'GUIDE'],
  ['break this down', 'START'],
  ['simplify', 'FOCUS'],
  ['focus', 'FOCUS'],
  ['declutter', 'FOCUS'],
  ['start', 'START'],
  ['stuck', 'START'],
  ['chunk', 'START'],
  ["can't begin", 'START'],
  ['explain', 'EXPLAIN'],
  ['what is', 'EXPLAIN'],
  ['learn', 'LEARN'],
  ['mind map', 'LEARN'],
  ['summarise', 'LEARN'],
  ['summarize', 'LEARN'],
  ['meeting', 'MEET'],
  ['transcript', 'MEET'],
  ['rewrite', 'WRITE'],
  ['reword', 'WRITE'],
  ['practice', 'PRACTICE'],
  ['rehearse', 'PRACTICE'],
  ['fill', 'COMMANDER'],
  ['click', 'COMMANDER'],
  ['go to', 'COMMANDER'],
];

export interface ResolveModeInput {
  explicit?: Mode;
  utterance?: string;
  artifact: Artifact;
}

export function resolveMode(input: ResolveModeInput): Mode {
  if (input.explicit) return input.explicit;

  const u = input.utterance?.toLowerCase() ?? '';
  if (u) {
    for (const [k, m] of EXPLICIT_TRIGGERS) if (u.includes(k)) return m;
  }

  // Heuristics from artifact shape — free, instant, right ~85% of the time.
  switch (input.artifact.kind) {
    case 'transcript':
      return 'MEET';
    case 'task':
      return 'START';
    case 'image':
      return 'EXPLAIN';
    case 'document':
      return 'LEARN';
    case 'selection':
      return 'EXPLAIN';
    case 'ui':
      return 'COMMANDER';
    case 'page':
      return input.artifact.text.length > 6000 ? 'LEARN' : 'FOCUS';
  }
}

/** The text a mode actually consumes, per artifact kind. */
export function artifactToInput(artifact: Artifact): string {
  switch (artifact.kind) {
    case 'page':
      return `TITLE: ${artifact.title}\nURL: ${artifact.url}\n\n${artifact.text}`;
    case 'selection':
      return artifact.contextBefore
        ? `CONTEXT BEFORE: ${artifact.contextBefore}\n\nSELECTED: ${artifact.text}`
        : artifact.text;
    case 'document':
      return `DOCUMENT: ${artifact.name}\n\n${artifact.text}`;
    case 'transcript':
      return `TRANSCRIPT: ${artifact.title}${
        artifact.speakers?.length ? `\nSPEAKERS: ${artifact.speakers.join(', ')}` : ''
      }\n\n${artifact.text}`;
    case 'task':
      return artifact.deadline
        ? `TASK: ${artifact.text}\nDEADLINE: ${artifact.deadline}`
        : `TASK: ${artifact.text}`;
    case 'image':
      return artifact.nearbyText
        ? `IMAGE. Nearby text on the page: ${artifact.nearbyText}`
        : 'IMAGE.';
    case 'ui':
      return `PAGE: ${artifact.domSummary.title} — ${artifact.domSummary.url}`;
  }
}

/** Which surfaces can serve which modes (§8). Guards the UI before it tries. */
export const MODE_SURFACES: Record<Mode, Array<'lens' | 'sanctuary' | 'go'>> = {
  FOCUS: ['lens', 'go'],
  START: ['lens', 'sanctuary', 'go'],
  LEARN: ['sanctuary', 'go'],
  MEET: ['sanctuary'],
  EXPLAIN: ['lens', 'sanctuary', 'go'],
  WRITE: ['lens', 'sanctuary'],
  PRACTICE: ['sanctuary', 'go'],
  GUIDE: ['lens'],
  COMMANDER: ['lens'],
};

export function modeAvailableOn(mode: Mode, surface: 'lens' | 'sanctuary' | 'go'): boolean {
  return MODE_SURFACES[mode].includes(surface);
}
