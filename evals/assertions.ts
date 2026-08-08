import {
  SCHEMA_BY_MODE,
  fleschKincaidGrade,
  type Mode,
  type TTransformArtifact,
} from '../packages/core/src/index';

/**
 * THE EVALUATION HARNESS (§24).
 *
 * Almost no hackathon team does this. It takes six hours and it changes how
 * judges see you:
 *
 *   "We run N assertions across M golden cases every time we change a prompt.
 *    Current pass rate: X%. Here are the three we still fail, and why."
 *
 * Volunteering your failures is a power move. It signals you actually measured,
 * which almost nobody else will have done.
 *
 * ASSERT PROPERTIES, NOT EXACT STRINGS. LLM outputs are not string-stable, and
 * an eval suite that breaks on a synonym is an eval suite you will delete on
 * day nine.
 */

export interface Assertion {
  name: string;
  fn: (output: TTransformArtifact, input: string) => boolean;
}

const SHAMING = /\b(just|simply|easy|easily|obviously|merely|all you need to do|don'?t worry)\b/i;
const CLINICAL = /\b(disorder|symptom|patient|suffers?|diagnos\w*|condition)\b/i;
const VERB_START = /^[A-Z]?[a-z]*(?:e|k|d|t|n|y|w|p|l|g|r|m|h|s|c|b|f|v|z)\b/;

/** Shared across every mode — these are the constitution, in test form. */
export const universalAssertions: Assertion[] = [
  {
    name: 'schema valid',
    fn: (o) => SCHEMA_BY_MODE[o.mode as Mode].safeParse(o).success,
  },
  {
    name: 'no shaming or minimising language',
    fn: (o) => !SHAMING.test(JSON.stringify(o)),
  },
  {
    name: 'never diagnoses or labels',
    fn: (o) => !CLINICAL.test(JSON.stringify(o)),
  },
  {
    name: 'no markdown fences leaked into fields',
    fn: (o) => !/```/.test(JSON.stringify(o)),
  },
  {
    name: 'PII placeholders preserved, never invented values',
    fn: (o, input) => {
      const inPlaceholders = new Set(input.match(/⟦[A-Z_]+_\d+⟧/g) ?? []);
      const outPlaceholders = o ? (JSON.stringify(o).match(/⟦[A-Z_]+_\d+⟧/g) ?? []) : [];
      return outPlaceholders.every((p) => inPlaceholders.has(p));
    },
  },
];

export const startAssertions: Assertion[] = [
  {
    name: 'first action is 10 minutes or under',
    fn: (o) => o.mode === 'START' && o.firstAction.minutes <= 10,
  },
  {
    name: 'between 3 and 7 steps',
    fn: (o) => o.mode === 'START' && o.steps.length >= 3 && o.steps.length <= 7,
  },
  {
    name: 'the first two steps are the lowest-anxiety ones',
    fn: (o) => {
      if (o.mode !== 'START') return false;
      const rank = { low: 0, medium: 1, high: 2 };
      const head = o.steps.slice(0, 2).map((s) => rank[s.anxiety]);
      const tail = o.steps.slice(2).map((s) => rank[s.anxiety]);
      if (!tail.length) return true;
      return Math.max(...head) <= Math.max(...tail);
    },
  },
  {
    name: 'steps begin with an action, not a noun',
    fn: (o) => o.mode === 'START' && o.steps.every((s) => VERB_START.test(s.text.trim())),
  },
  {
    name: 'first action reads at grade 8 or below',
    fn: (o) => o.mode === 'START' && fleschKincaidGrade(o.firstAction.text) <= 8,
  },
  {
    name: 'no exclamation marks in the encouragement',
    fn: (o) => o.mode === 'START' && !o.encouragement.includes('!'),
  },
  {
    name: 'no invented dates',
    fn: (o, input) => {
      const dates = JSON.stringify(o).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
      return dates.every((d) => input.includes(d));
    },
  },
];

export const learnAssertions: Assertion[] = [
  {
    name: 'exactly one root node',
    fn: (o) => o.mode === 'LEARN' && o.map.filter((n) => n.parentId === null).length === 1,
  },
  {
    name: 'no node exceeds depth 2',
    fn: (o) => o.mode === 'LEARN' && o.map.every((n) => n.depth <= 2),
  },
  {
    name: 'every non-root parent exists',
    fn: (o) => {
      if (o.mode !== 'LEARN') return false;
      const ids = new Set(o.map.map((n) => n.id));
      return o.map.every((n) => n.parentId === null || ids.has(n.parentId));
    },
  },
  {
    name: 'no node restates its parent',
    fn: (o) => {
      if (o.mode !== 'LEARN') return false;
      const byId = new Map(o.map.map((n) => [n.id, n]));
      return o.map.every((n) => {
        if (!n.parentId) return true;
        const p = byId.get(n.parentId);
        return !p || p.label.toLowerCase().trim() !== n.label.toLowerCase().trim();
      });
    },
  },
  {
    name: 'quiz answers are in range and distractors are distinct',
    fn: (o) =>
      o.mode === 'LEARN' &&
      o.quiz.every((q) => q.answerIndex >= 0 && q.answerIndex < 4 && new Set(q.options).size === 4),
  },
  {
    name: 'summary lines stand alone (no "this", "it", "that" openers)',
    fn: (o) => o.mode === 'LEARN' && !o.summary.some((s) => /^(this|it|that|they|these)\b/i.test(s.trim())),
  },
];

export const meetAssertions: Assertion[] = [
  {
    name: 'never guesses an owner',
    fn: (o, input) =>
      o.mode === 'MEET' &&
      o.actions.every((a) => a.owner === 'unassigned' || input.toLowerCase().includes(a.owner.toLowerCase())),
  },
  {
    name: 'never infers an unspoken deadline',
    fn: (o, input) =>
      o.mode === 'MEET' && o.actions.every((a) => a.due === null || input.includes(a.due)),
  },
  {
    name: 'uncertain items are marked uncertain',
    fn: (o) => o.mode === 'MEET' && o.actions.every((a) => ['stated', 'implied', 'uncertain'].includes(a.confidence)),
  },
];

export const explainAssertions: Assertion[] = [
  {
    name: 'plain text respects the reading level',
    fn: (o) => o.mode === 'EXPLAIN' && fleschKincaidGrade(o.plain) <= 12,
  },
  {
    name: 'the analogy is not a restatement of the definition',
    fn: (o) => {
      if (o.mode !== 'EXPLAIN') return false;
      const a = new Set(o.analogy.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      const p = new Set(o.plain.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      if (!a.size) return false;
      const overlap = [...a].filter((w) => p.has(w)).length / a.size;
      return overlap < 0.7;
    },
  },
  {
    name: 'vernacular is populated when a non-English language was requested',
    fn: (o) => o.mode === 'EXPLAIN' && (o.vernacular === null || o.vernacular.text.length > 0),
  },
];

export const commanderAssertions: Assertion[] = [
  {
    name: 'every elementId came from the supplied summary',
    fn: (o, input) => {
      if (o.mode !== 'COMMANDER') return false;
      const known = new Set(input.match(/\be\d+\b/g) ?? []);
      return o.actions.every((a) => known.has(a.elementId));
    },
  },
  {
    name: 'at most 6 actions',
    fn: (o) => o.mode === 'COMMANDER' && o.actions.length <= 6,
  },
  {
    name: 'submit actions are never marked safe',
    fn: (o) => o.mode === 'COMMANDER' && o.actions.every((a) => a.op !== 'submit' || a.risk !== 'safe'),
  },
  {
    name: 'a risky plan requires confirmation',
    fn: (o) =>
      o.mode === 'COMMANDER' &&
      (!o.actions.some((a) => a.risk !== 'safe') || o.needsConfirmation === true),
  },
  {
    name: 'an impossible request returns no actions and says why',
    fn: (o) => o.mode === 'COMMANDER' && (o.cannotDo === null || o.actions.length === 0),
  },
];

export const ASSERTIONS_BY_MODE: Partial<Record<Mode, Assertion[]>> = {
  START: startAssertions,
  LEARN: learnAssertions,
  MEET: meetAssertions,
  EXPLAIN: explainAssertions,
  COMMANDER: commanderAssertions,
};

export function assertionsFor(mode: Mode): Assertion[] {
  return [...universalAssertions, ...(ASSERTIONS_BY_MODE[mode] ?? [])];
}
