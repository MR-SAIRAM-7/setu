import type { Mode } from '../types';
import { fleschKincaidGrade, readingMinutes, splitSentences } from '../metrics/readability-grade';
import type {
  TExplainResult,
  TGuideResult,
  TLearnResult,
  TMeetResult,
  TPracticeResult,
  TStartResult,
  TTransformArtifact,
  TWriteResult,
} from '../schemas';
import type { TCommanderPlan } from '../schemas';

/**
 * DETERMINISTIC FALLBACKS — mandatory, not optional (§21.1).
 *
 * "The user never sees a dead end; the worst case is a less clever result."
 *
 * Every one of these is built from string templates and the input text. They
 * call nothing, need no network, and cannot fail. They exist so that the
 * bottom rung of the degradation ladder (§17) is still an artifact.
 */

export function deterministicFallback(mode: Mode, input: string): TTransformArtifact {
  switch (mode) {
    case 'START':
      return startFallback(input);
    case 'LEARN':
      return learnFallback(input);
    case 'EXPLAIN':
      return explainFallback(input);
    case 'MEET':
      return meetFallback(input);
    case 'WRITE':
      return writeFallback(input);
    case 'PRACTICE':
      return practiceFallback(input);
    case 'GUIDE':
      return guideFallback(input);
    case 'COMMANDER':
      return commanderFallback();
    case 'FOCUS':
      return {
        mode: 'FOCUS',
        title: firstLine(input) || 'This page',
        blocks: [{ type: 'p', text: input.slice(0, 2000) }],
        removed: { ads: 0, motion: 0, scripts: 0, nodes: 0 },
        clsBefore: 0,
        clsAfter: 0,
      };
  }
}

/* ── START ────────────────────────────────────────────────────────────────── */

function startFallback(input: string): TStartResult {
  const task = cleanTask(input);
  const short = task.length > 90 ? `${task.slice(0, 87)}...` : task;

  return {
    mode: 'START',
    restated: short || 'The thing you are avoiding',
    clarifier: null,
    firstAction: {
      text: `Open one place where this lives and look at it for two minutes. Change nothing.`,
      minutes: 2,
      why: 'Looking is not doing. It costs almost nothing and it ends the not-knowing.',
    },
    steps: [
      {
        id: 's1',
        text: 'Write down what "finished" looks like, in one sentence.',
        minutes: 3,
        effort: 'tiny',
        anxiety: 'low',
        done: false,
      },
      {
        id: 's2',
        text: 'List every piece of information you already have.',
        minutes: 5,
        effort: 'small',
        anxiety: 'low',
        done: false,
      },
      {
        id: 's3',
        text: 'Name the one thing you are missing, and where you would find it.',
        minutes: 5,
        effort: 'small',
        anxiety: 'medium',
        done: false,
      },
      {
        id: 's4',
        text: 'Do the smallest visible piece and stop there.',
        minutes: 10,
        effort: 'medium',
        anxiety: 'medium',
        done: false,
      },
    ],
    encouragement: 'Starting badly still counts as starting. You can fix a draft; you cannot fix nothing.',
    escapeHatch: 'Still too big? I can break this down further.',
  };
}

/* ── LEARN ────────────────────────────────────────────────────────────────── */

function learnFallback(input: string): TLearnResult {
  // Derive an outline map from headings if we have them, sentences if we don't.
  const headings = input
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 70 && !/[.!?]$/.test(l))
    .slice(0, 6);

  const sentences = splitSentences(input);
  const labels = headings.length >= 3 ? headings : sentences.slice(0, 6).map((s) => s.slice(0, 58));

  const map = [
    { id: 'n0', parentId: null, label: (firstLine(input) || 'This document').slice(0, 58), depth: 0 },
    ...labels.map((l, i) => ({
      id: `n${i + 1}`,
      parentId: 'n0',
      label: l.slice(0, 58) || `Part ${i + 1}`,
      depth: 1,
    })),
  ];
  // schema floor is 4 nodes
  while (map.length < 4) {
    map.push({ id: `n${map.length}`, parentId: 'n0', label: `Section ${map.length}`, depth: 1 });
  }

  const summary = sentences.slice(0, 4).map((s) => s.slice(0, 158));
  while (summary.length < 3) summary.push('This is an outline built without AI, from the document structure.');

  const cards = sentences.slice(0, 4).map((s) => ({
    q: `What does this say about "${firstWords(s, 4)}"?`.slice(0, 138),
    a: s.slice(0, 218),
  }));
  while (cards.length < 4) cards.push({ q: 'What is the main point?', a: summary[0] ?? 'See the summary.' });

  return {
    mode: 'LEARN',
    summary,
    map,
    glossary: [],
    flashcards: cards,
    quiz: [
      {
        q: 'This outline was built without AI. What does that mean for it?',
        options: [
          'It follows the document structure, not its meaning',
          'It is a full analysis',
          'It is wrong',
          'It came from the cloud',
        ],
        answerIndex: 0,
        why: 'The connection was unavailable, so SETU used the headings instead of a model.',
      },
      {
        q: 'What should you do next?',
        options: ['Reconnect and re-run for a full map', 'Nothing', 'Delete it', 'Print it'],
        answerIndex: 0,
        why: 'A model-built map will be considerably richer than a structural outline.',
      },
      {
        q: 'Is this document saved?',
        options: ['Yes, locally', 'No', 'Only in the cloud', 'Unknown'],
        answerIndex: 0,
        why: 'Your work is kept on this device regardless of connection.',
      },
    ],
    readingMinutes: readingMinutes(input),
  };
}

/* ── EXPLAIN ──────────────────────────────────────────────────────────────── */

function explainFallback(input: string): TExplainResult {
  return {
    mode: 'EXPLAIN',
    plain: `We could not reach an engine to explain this. Here is the text you selected, unchanged: "${input.slice(0, 320)}"`,
    analogy: 'No analogy available offline — this needs a model.',
    whyItMatters: 'Reconnect and run this again, or turn on the on-device model in Settings.',
    steps: [],
    vernacular: null,
    imageBreakdown: [],
  };
}

/* ── MEET ─────────────────────────────────────────────────────────────────── */

function meetFallback(input: string): TMeetResult {
  const sentences = splitSentences(input);
  const actionish = sentences
    .filter((s) => /\b(will|need to|should|action|todo|follow up|by (mon|tue|wed|thu|fri|next))\b/i.test(s))
    .slice(0, 8);

  return {
    mode: 'MEET',
    tldr: sentences.slice(0, 2).join(' ').slice(0, 278) || 'No summary available offline.',
    decisions: [],
    actions: actionish.map((s) => ({
      text: s.slice(0, 158),
      owner: 'unassigned',
      due: null,
      confidence: 'uncertain' as const,
    })),
    openQuestions: sentences.filter((s) => s.includes('?')).slice(0, 5).map((s) => s.slice(0, 158)),
    jargon: [],
    youMissed: [],
  };
}

/* ── WRITE ────────────────────────────────────────────────────────────────── */

function writeFallback(input: string): TWriteResult {
  // A genuinely useful deterministic rewrite: split the long sentences.
  const rewritten = input
    .split(/\n/)
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .map((s) => (s.split(/\s+/).length > 28 ? s.replace(/,\s+(and|but|which|while)\s+/gi, '. ') : s))
        .join(' '),
    )
    .join('\n');

  return {
    mode: 'WRITE',
    rewrite: rewritten,
    gradeBefore: fleschKincaidGrade(input),
    gradeAfter: fleschKincaidGrade(rewritten),
    changes:
      rewritten === input
        ? []
        : [
            {
              kind: 'long-sentence',
              before: 'sentences over 28 words',
              after: 'split at conjunctions',
              why: 'Long sentences hold more in working memory than most readers have spare.',
            },
          ],
  };
}

/* ── PRACTICE ─────────────────────────────────────────────────────────────── */

function practiceFallback(input: string): TPracticeResult {
  return {
    mode: 'PRACTICE',
    scenario: cleanTask(input).slice(0, 198) || 'The conversation you are preparing for',
    opener: "Hello, my name is ⟦NAME⟧. I'm calling about ⟦TOPIC⟧. Is now a good time?",
    branches: [
      {
        theyMightSay: 'Can you hold for a moment?',
        youCouldSay: 'Yes, of course.',
        ifItGoesWrong: 'If the hold is long, it is fine to hang up and call back later.',
      },
      {
        theyMightSay: 'I need your reference number.',
        youCouldSay: 'Let me find that — one moment.',
        ifItGoesWrong: "If you cannot find it, say: 'I don't have it with me. Can you look me up another way?'",
      },
    ],
    exitPhrase: "Thank you. I'll call back once I have that.",
    prepNote: 'Built offline. Reconnect for a scenario tailored to your situation.',
  };
}

/* ── GUIDE ────────────────────────────────────────────────────────────────── */

function guideFallback(input: string): TGuideResult {
  return {
    mode: 'GUIDE',
    goal: cleanTask(input).slice(0, 138) || 'What you are trying to do',
    steps: [
      {
        n: 1,
        instruction: 'Look for the main heading and read only that.',
        selectorHint: null,
        confirm: 'You can say what this page is for in one sentence.',
      },
      {
        n: 2,
        instruction: 'Find the single button that moves you forward and ignore everything else.',
        selectorHint: null,
        confirm: 'You have one button in mind.',
      },
    ],
  };
}

/* ── COMMANDER ────────────────────────────────────────────────────────────── */

function commanderFallback(): TCommanderPlan {
  // A refusal is a correct answer. Never guess an action plan.
  return {
    mode: 'COMMANDER',
    understood: 'I could not reach the planner.',
    actions: [],
    needsConfirmation: false,
    cannotDo: 'I could not plan this right now. Nothing was changed on the page.',
  };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function cleanTask(s: string): string {
  return s
    .replace(/^(TASK|DOCUMENT|TRANSCRIPT|SELECTED|TITLE):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstLine(s: string): string {
  return (s.split(/\n/).find((l) => l.trim().length > 2) ?? '').trim();
}

function firstWords(s: string, n: number): string {
  return s.split(/\s+/).slice(0, n).join(' ');
}
