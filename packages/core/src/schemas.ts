import { z } from 'zod';

/**
 * THE CONTRACT LAYER (§20).
 *
 * This is the API between the model and the UI. Nothing renders unless it
 * passed through here first (Rule 1, the Contract Rule).
 *
 * §20.1 — every `.describe()` below is converted into JSON Schema and sent to
 * the model attached to the exact field it governs. Field descriptions are the
 * primary prompt-engineering surface in SETU; they beat system-prompt prose
 * because the constraint sits next to the slot being filled.
 */

/* ── shared atoms ─────────────────────────────────────────────────────────── */

export const Effort = z.enum(['tiny', 'small', 'medium']);
export const Anxiety = z.enum(['low', 'medium', 'high']);

export const MicroStep = z.object({
  id: z.string(),
  text: z.string().max(140).describe('One concrete physical action. Starts with a verb.'),
  minutes: z.number().int().min(1).max(30),
  effort: Effort,
  anxiety: Anxiety,
  done: z.boolean().default(false),
});
export type TMicroStep = z.infer<typeof MicroStep>;

/* ── START ────────────────────────────────────────────────────────────────── */

export const StartResult = z.object({
  mode: z.literal('START'),
  restated: z.string().max(120).describe("The task in the user's own words, calmly."),
  clarifier: z
    .string()
    .max(140)
    .nullable()
    .describe('At most ONE question. null if the task is already clear.'),
  firstAction: z.object({
    text: z.string().max(120).describe('Doable in 10 minutes. Physical and specific.'),
    minutes: z.number().int().min(2).max(15),
    why: z.string().max(140).describe('Why this is the right first move. Warm, never patronising.'),
  }),
  steps: z.array(MicroStep).min(3).max(7),
  encouragement: z
    .string()
    .max(160)
    .describe('No shame, no "just", no "simply", no exclamation marks.'),
  escapeHatch: z.string().max(120).default('Still too big? I can break this down further.'),
});

/* ── FOCUS (produced at L0; schema exists for parity + caching) ───────────── */

export const FocusResult = z.object({
  mode: z.literal('FOCUS'),
  title: z.string(),
  blocks: z.array(
    z.object({
      type: z.enum(['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'quote', 'code', 'table', 'figure']),
      text: z.string(),
      items: z.array(z.string()).optional(),
    }),
  ),
  removed: z.object({
    ads: z.number(),
    motion: z.number(),
    scripts: z.number(),
    nodes: z.number(),
  }),
  clsBefore: z.number().int().min(0).max(100),
  clsAfter: z.number().int().min(0).max(100),
});

/* ── LEARN ────────────────────────────────────────────────────────────────── */
/* ⚠️ DO NOT convert this to a recursive z.lazy() schema.
 * Gemini's responseSchema supports recursion via `$ref: "#"`, but Zod's
 * z.lazy() emits `$ref: "#/definitions/..."` paths that do not reliably
 * survive JSON-Schema translation, and deeply nested schemas get rejected.
 * A FLAT node list with parentId is bulletproof, costs one 10-line
 * tree-builder on the client, and lets us enforce depth ourselves. */

export const MindNodeFlat = z.object({
  id: z.string().describe('Short stable id, e.g. "n3".'),
  parentId: z.string().nullable().describe('null for the single root node.'),
  label: z.string().max(60),
  detail: z.string().max(220).optional(),
  depth: z.number().int().min(0).max(2).describe('0 = root. Never exceed 2.'),
});
export type TMindNodeFlat = z.infer<typeof MindNodeFlat>;

export const LearnResult = z.object({
  mode: z.literal('LEARN'),
  summary: z
    .array(z.string().max(160))
    .min(3)
    .max(6)
    .describe('Each line stands alone. No line depends on the previous one.'),
  map: z
    .array(MindNodeFlat)
    .min(4)
    .max(31)
    .describe('Exactly one node with parentId null. Max depth 2. Max 6 children per parent.'),
  glossary: z.array(z.object({ term: z.string(), plain: z.string().max(180) })).max(12),
  flashcards: z
    .array(z.object({ q: z.string().max(140), a: z.string().max(220) }))
    .min(4)
    .max(12),
  quiz: z
    .array(
      z.object({
        q: z.string().max(160),
        options: z.array(z.string().max(90)).length(4),
        answerIndex: z.number().int().min(0).max(3),
        why: z.string().max(180),
      }),
    )
    .min(3)
    .max(6),
  readingMinutes: z.number().int(),
});

/* ── MEET ─────────────────────────────────────────────────────────────────── */

export const MeetResult = z.object({
  mode: z.literal('MEET'),
  tldr: z.string().max(280),
  decisions: z
    .array(z.object({ text: z.string().max(200), madeBy: z.string().optional() }))
    .max(10),
  actions: z
    .array(
      z.object({
        text: z.string().max(160),
        owner: z.string().default('unassigned'),
        due: z.string().nullable().describe('ISO date or null. Never guess a date.'),
        confidence: z.enum(['stated', 'implied', 'uncertain']),
      }),
    )
    .max(20),
  openQuestions: z.array(z.string().max(160)).max(8),
  jargon: z.array(z.object({ term: z.string(), plain: z.string().max(160) })).max(10),
  youMissed: z
    .array(z.string().max(180))
    .max(5)
    .describe('Points a distracted listener most likely lost.'),
});

/* ── EXPLAIN ──────────────────────────────────────────────────────────────── */

export const ExplainResult = z.object({
  mode: z.literal('EXPLAIN'),
  plain: z.string().max(400).describe('At the requested reading level. Short sentences.'),
  analogy: z
    .string()
    .max(240)
    .describe('A concrete everyday comparison. Culturally local if possible.'),
  whyItMatters: z.string().max(200),
  steps: z
    .array(z.string().max(140))
    .max(6)
    .default([])
    .describe('Only if the thing explained is a procedure.'),
  vernacular: z.object({ lang: z.string(), text: z.string().max(500) }).nullable(),
  imageBreakdown: z
    .array(z.object({ region: z.string().max(60), meaning: z.string().max(200) }))
    .max(10)
    .default([]),
});

/* ── WRITE ────────────────────────────────────────────────────────────────── */

export const WriteResult = z.object({
  mode: z.literal('WRITE'),
  rewrite: z.string(),
  gradeBefore: z.number(),
  gradeAfter: z.number(),
  changes: z
    .array(
      z.object({
        kind: z.enum(['passive', 'long-sentence', 'jargon', 'ambiguous', 'tone']),
        before: z.string().max(200),
        after: z.string().max(200),
        why: z.string().max(140),
      }),
    )
    .max(20),
});

/* ── PRACTICE ─────────────────────────────────────────────────────────────── */

export const PracticeResult = z.object({
  mode: z.literal('PRACTICE'),
  scenario: z.string().max(200),
  opener: z.string().max(220),
  branches: z
    .array(
      z.object({
        theyMightSay: z.string().max(180),
        youCouldSay: z.string().max(220),
        ifItGoesWrong: z.string().max(180),
      }),
    )
    .min(2)
    .max(4),
  exitPhrase: z.string().max(140),
  prepNote: z.string().max(200),
});

/* ── GUIDE ────────────────────────────────────────────────────────────────── */

export const GuideResult = z.object({
  mode: z.literal('GUIDE'),
  goal: z.string().max(140),
  steps: z
    .array(
      z.object({
        n: z.number().int(),
        instruction: z.string().max(160),
        selectorHint: z
          .string()
          .max(120)
          .nullable()
          .describe('Text or aria-label of the element, NEVER an invented CSS selector.'),
        confirm: z.string().max(120).describe('How the user knows the step worked.'),
      }),
    )
    .min(2)
    .max(10),
});

/* ── COMMANDER ────────────────────────────────────────────────────────────── */

export const CommanderOp = z.enum([
  'click',
  'fill',
  'select',
  'scrollTo',
  'focus',
  'submit',
  'navigate',
]);

export const CommanderRisk = z.enum(['safe', 'writes-data', 'irreversible']);

export const CommanderAction = z.object({
  op: CommanderOp,
  targetHint: z.string().max(140).describe('Human description of the element.'),
  elementId: z.string().describe('MUST be an id from the provided DOM summary.'),
  value: z.string().max(400).optional(),
  risk: CommanderRisk,
  why: z.string().max(140),
});
export type TCommanderAction = z.infer<typeof CommanderAction>;

export const CommanderPlan = z.object({
  mode: z.literal('COMMANDER'),
  understood: z.string().max(160).describe('Restate the user request in one line.'),
  actions: z.array(CommanderAction).max(12),
  needsConfirmation: z.boolean(),
  cannotDo: z
    .string()
    .max(200)
    .nullable()
    .describe('If the request is impossible on this page, say so here and return actions: [].'),
});
export type TCommanderPlan = z.infer<typeof CommanderPlan>;

/* ── The union ────────────────────────────────────────────────────────────── */

export const TransformArtifact = z.discriminatedUnion('mode', [
  StartResult,
  FocusResult,
  LearnResult,
  MeetResult,
  ExplainResult,
  WriteResult,
  PracticeResult,
  GuideResult,
  CommanderPlan,
]);
export type TTransformArtifact = z.infer<typeof TransformArtifact>;

export const SCHEMA_BY_MODE = {
  START: StartResult,
  FOCUS: FocusResult,
  LEARN: LearnResult,
  MEET: MeetResult,
  EXPLAIN: ExplainResult,
  WRITE: WriteResult,
  PRACTICE: PracticeResult,
  GUIDE: GuideResult,
  COMMANDER: CommanderPlan,
} as const;

export type SchemaByMode = typeof SCHEMA_BY_MODE;

export type TStartResult = z.infer<typeof StartResult>;
export type TFocusResult = z.infer<typeof FocusResult>;
export type TLearnResult = z.infer<typeof LearnResult>;
export type TMeetResult = z.infer<typeof MeetResult>;
export type TExplainResult = z.infer<typeof ExplainResult>;
export type TWriteResult = z.infer<typeof WriteResult>;
export type TPracticeResult = z.infer<typeof PracticeResult>;
export type TGuideResult = z.infer<typeof GuideResult>;

/**
 * Build the mind-map tree client-side (§36.3).
 * Note the last line: even a completely malformed node list produces a
 * renderable map. The renderer can never receive nothing.
 */
export interface MindNode extends TMindNodeFlat {
  children: MindNode[];
}

export function buildTree(flat: TMindNodeFlat[]): MindNode {
  const byId = new Map<string, MindNode>(flat.map((n) => [n.id, { ...n, children: [] }]));
  let root: MindNode | null = null;

  for (const n of byId.values()) {
    if (n.parentId === null) {
      root ??= n; // first null wins
      continue;
    }
    const p = byId.get(n.parentId);
    if (!p) {
      // orphan → attach to root, or become the root if there isn't one yet
      if (root) root.children.push(n);
      else root = n;
      continue;
    }
    // enforce OUR limits, regardless of what the model claimed
    if (p.children.length < 6 && n.depth <= 2) p.children.push(n);
  }

  return (
    root ?? {
      id: 'r',
      parentId: null,
      label: 'Overview',
      depth: 0,
      children: [...byId.values()],
    }
  );
}
