import type { Mode, TTransformArtifact } from '@setu/core';

/**
 * DEMO MODE FIXTURES (§45).
 *
 * "Every live step has a pre-recorded twin, one keypress away."
 *
 * Alt+Shift+D flips `setu.demoMode`. Every panel then renders from these
 * objects and the network is bypassed entirely. Build this on Day 13, not on
 * the morning of the pitch.
 *
 * All fixtures are schema-valid by construction — the kernel test suite parses
 * each of them through SCHEMA_BY_MODE, so a fixture can never be the thing
 * that breaks the demo.
 */

export const FIXTURES: Partial<Record<Mode, TTransformArtifact>> = {
  START: {
    mode: 'START',
    restated: 'Apply for your exam re-evaluation',
    clarifier: null,
    firstAction: {
      text: 'Open the exam portal and find your last semester result page.',
      minutes: 5,
      why: 'You need the subject code from that page before anything else can happen.',
    },
    steps: [
      {
        id: 's1',
        text: 'Write down the subject code and your roll number on paper.',
        minutes: 3,
        effort: 'tiny',
        anxiety: 'low',
        done: false,
      },
      {
        id: 's2',
        text: 'Find the re-evaluation form under Examination → Services.',
        minutes: 5,
        effort: 'small',
        anxiety: 'low',
        done: false,
      },
      {
        id: 's3',
        text: 'Fill only the first section and save the draft.',
        minutes: 10,
        effort: 'small',
        anxiety: 'medium',
        done: false,
      },
      {
        id: 's4',
        text: 'Pay the fee and screenshot the receipt.',
        minutes: 10,
        effort: 'medium',
        anxiety: 'medium',
        done: false,
      },
      {
        id: 's5',
        text: 'Submit and save the acknowledgement number.',
        minutes: 5,
        effort: 'small',
        anxiety: 'high',
        done: false,
      },
    ],
    encouragement:
      'You have done harder paperwork than this. The first step takes five minutes and changes nothing you cannot undo.',
    escapeHatch: 'Still too big? I can break this down further.',
  },

  EXPLAIN: {
    mode: 'EXPLAIN',
    plain:
      'A moratorium period is a break at the start of a loan when you do not have to make repayments. Interest usually still builds up during that break.',
    analogy:
      'It is like a shopkeeper letting you take the goods now and start paying next month — the price still grows while you wait.',
    whyItMatters:
      'If you take the break, your total repayment goes up. Ask for the exact figure before you agree.',
    steps: [],
    vernacular: {
      lang: 'hi-IN',
      text: 'मोरेटोरियम का मतलब है कर्ज़ चुकाने की शुरुआत में मिली छूट। इस दौरान किस्त नहीं देनी पड़ती, लेकिन ब्याज़ जुड़ता रहता है। इसलिए बाद में कुल रकम बढ़ जाती है।',
    },
    imageBreakdown: [],
  },

  WRITE: {
    mode: 'WRITE',
    rewrite:
      'I am writing to request an extension for my assignment. I was unwell last week and could not finish it. Could I submit it by Friday?',
    gradeBefore: 14.2,
    gradeAfter: 6.1,
    changes: [
      {
        kind: 'long-sentence',
        before: 'I am writing to you today in order to respectfully request that...',
        after: 'I am writing to request an extension for my assignment.',
        why: 'The original held four ideas before reaching the point.',
      },
      {
        kind: 'passive',
        before: 'the assignment was not able to be completed by me',
        after: 'I could not finish it',
        why: 'Active voice names who did what, so the reader holds less at once.',
      },
    ],
  },

  COMMANDER: {
    mode: 'COMMANDER',
    understood: 'Fill the registration form with your saved profile details.',
    actions: [
      {
        op: 'fill',
        targetHint: 'Full name field',
        elementId: 'e4',
        value: 'A. Student',
        risk: 'safe',
        why: 'This field is empty and your profile has a name.',
      },
      {
        op: 'fill',
        targetHint: 'Roll number field',
        elementId: 'e5',
        value: '21BCE1234',
        risk: 'safe',
        why: 'Required field, and your profile has this value.',
      },
      {
        op: 'scrollTo',
        targetHint: 'Submit application button',
        elementId: 'e9',
        risk: 'safe',
        why: 'Bringing the last step into view so you can check before submitting.',
      },
    ],
    needsConfirmation: true,
    cannotDo: null,
  },

  GUIDE: {
    mode: 'GUIDE',
    goal: 'Download your semester marksheet',
    steps: [
      {
        n: 1,
        instruction: 'Open the Examination menu at the top of the page.',
        selectorHint: 'Examination',
        confirm: 'A dropdown appears with several options.',
      },
      {
        n: 2,
        instruction: 'Choose "Results" from that dropdown.',
        selectorHint: 'Results',
        confirm: 'A table of semesters loads.',
      },
      {
        n: 3,
        instruction: 'Select the most recent semester, then press Download.',
        selectorHint: 'Download',
        confirm: 'A PDF opens or saves to your downloads folder.',
      },
    ],
  },
};

export function fixtureFor(mode: Mode): TTransformArtifact | undefined {
  return FIXTURES[mode];
}

/** A believable latency, so demo mode does not look suspiciously instant. */
export const DEMO_LATENCY_MS = 220;
