/**
 * SETU In-Page Agent Service
 * --------------------------
 * Plans multi-step browser actions from a natural-language goal plus a snapshot
 * of the live page. The extension executes the plan; this module decides what
 * should happen and — critically — what must be confirmed by a human first.
 *
 * Safety model: the agent runs on arbitrary websites, including banking and
 * government portals. Any step that sends data, spends money, or cannot be
 * undone is marked `requiresConfirmation` and the extension will not fire it
 * without an explicit click from the user.
 */

const { requestStructuredAI, requestText, describeImage } = require('./aiService');

/** Action verbs that can have real-world consequences on a live page. */
const IRREVERSIBLE_ACTIONS = new Set(['submit', 'purchase', 'delete', 'send']);

/** Label patterns that mean "this button does something you can't take back". */
const IRREVERSIBLE_LABEL = /\b(submit|pay|purchase|buy|checkout|order|confirm|delete|remove|send|transfer|withdraw|deposit|apply now|sign up|register|book now|place order|unsubscribe|deactivate|close account)\b/i;

const planSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    goal: { type: 'string' },
    understanding: {
      type: 'string',
      description: 'One sentence restating what the user wants, in their own terms.'
    },
    feasible: {
      type: 'boolean',
      description: 'False when the page simply does not contain what the goal needs.'
    },
    blockedReason: {
      type: 'string',
      description: 'When not feasible, a plain-language explanation. Empty otherwise.'
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stepNumber: { type: 'number' },
          instruction: { type: 'string', description: 'What happens, in plain language, one short sentence.' },
          actionType: {
            type: 'string',
            enum: ['click', 'fill', 'select', 'scroll', 'read', 'wait', 'navigate', 'submit']
          },
          targetRef: {
            type: 'string',
            description: 'The exact "ref" value of the target control from the page snapshot. Empty for scroll/read/wait.'
          },
          targetText: { type: 'string', description: 'Visible label of the target, for fuzzy re-matching.' },
          valueToFill: { type: 'string', description: 'Value for fill/select actions. Empty otherwise.' },
          tip: { type: 'string', description: 'A calm, reassuring note for the user.' }
        },
        required: ['stepNumber', 'instruction', 'actionType', 'targetRef', 'targetText', 'valueToFill', 'tip']
      }
    },
    supportiveMessage: { type: 'string', description: 'A warm closing note to reduce task anxiety.' }
  },
  required: ['goal', 'understanding', 'feasible', 'blockedReason', 'steps', 'supportiveMessage']
};

const AGENT_SYSTEM = `You are SETU Commander, an autonomous web navigation agent for users with
ADHD, dyslexia, autism, or memory difficulties. You are given a user's goal and a
snapshot of the interactive controls currently on their screen.

Produce the shortest plan that actually achieves the goal.

Hard rules:
- Only ever target controls that appear in the snapshot. Use their exact "ref" value
  as targetRef. Never invent a ref, a CSS selector, or a control that is not listed.
- If the page genuinely cannot serve the goal, set feasible=false and explain why in
  plain language. A short honest answer beats a plausible fake plan.
- Use actionType "submit" for anything that sends data, buys, deletes, or posts.
  Do not disguise those as ordinary clicks.
- Never fill real personal data you were not given. Leave valueToFill empty and let
  the user type, unless they supplied the value themselves.
- Instructions address the user directly, calmly, one action at a time.

Keep plans to 6 steps or fewer. Fewer, clearer steps beat exhaustive ones.`;

/**
 * Flag steps the extension must not auto-execute.
 * Belt and braces: we trust the model's actionType but also scan the label,
 * because a "Place order" button is dangerous however it was classified.
 */
function markConfirmations(steps, controls) {
  const byRef = new Map(controls.map((c) => [c.ref, c]));

  /**
   * Find the control a step targets.
   *
   * AI plans address controls by `ref`, but the L0 fallback planner emits
   * `targetText`/`targetSelector` instead. Matching on ref alone meant the
   * `type === 'submit'` check could never fire on a fallback plan, leaving an
   * offline plan protected only by the label regex — so a submit button with
   * an innocuous label ("Go", "Continue") would not be gated.
   */
  const resolve = (step) => {
    if (step.targetRef && byRef.has(step.targetRef)) return byRef.get(step.targetRef);

    const needle = String(step.targetText || '').trim().toLowerCase();
    if (!needle) return null;

    return (
      controls.find((c) => (c.label || '').trim().toLowerCase() === needle) ||
      controls.find((c) => (c.label || '').toLowerCase().includes(needle)) ||
      null
    );
  };

  return steps.map((step) => {
    const control = resolve(step);
    const label = `${step.targetText || ''} ${control?.label || ''}`;

    // A submit-typed control is treated as irreversible regardless of how the
    // step was classified or what the button happens to be called.
    const isSubmitControl =
      control?.type === 'submit' ||
      (control?.tag === 'button' && !control?.type && /submit/i.test(step.actionType));

    const requiresConfirmation =
      IRREVERSIBLE_ACTIONS.has(step.actionType) ||
      IRREVERSIBLE_LABEL.test(label) ||
      isSubmitControl;

    return { ...step, requiresConfirmation };
  });
}

/** Drop steps that point at controls the page never reported. */
function pruneUnresolvableSteps(steps, controls) {
  const refs = new Set(controls.map((c) => c.ref));
  const selfContained = new Set(['scroll', 'read', 'wait', 'navigate']);

  return steps
    .filter((step) => selfContained.has(step.actionType) || !step.targetRef || refs.has(step.targetRef))
    .map((step, index) => ({ ...step, stepNumber: index + 1 }));
}

/**
 * Build an action plan for `task` against the supplied page snapshot.
 */
async function planPageTask({ task, pageContext = {} }) {
  const controls = Array.isArray(pageContext.controls) ? pageContext.controls : [];

  const snapshot = `PAGE TITLE: ${pageContext.title || 'Untitled'}
PAGE URL: ${pageContext.url || 'unknown'}
HEADINGS: ${(pageContext.headings || []).slice(0, 12).join(' | ') || 'none'}

INTERACTIVE CONTROLS ON SCREEN:
${
  controls.length
    ? controls
        .map((c) => `[${c.ref}] <${c.tag}${c.type ? ` type=${c.type}` : ''}> "${c.label}"${c.value ? ` (current value: "${c.value}")` : ''}`)
        .join('\n')
    : '(none detected)'
}

VISIBLE TEXT EXCERPT:
${(pageContext.text || '').slice(0, 2500) || '(no text captured)'}`;

  const plan = await requestStructuredAI({
    name: 'setu_page_plan',
    schema: planSchema,
    instructions: AGENT_SYSTEM,
    input: `USER GOAL: "${task}"\n\n${snapshot}`,
    temperature: 0.3
  });

  const steps = markConfirmations(pruneUnresolvableSteps(plan.steps || [], controls), controls);

  return {
    ...plan,
    steps,
    totalSteps: steps.length,
    currentStepIndex: 0
  };
}

/**
 * Explain any page element, selection, or jargon in plain language —
 * optionally in the user's own language, per the Multilingual Vernacular
 * Explainer in the product spec.
 */
async function explainContent({ text, language = 'English', style = 'plain' }) {
  const styleGuide = {
    plain: 'Explain in plain Grade 6 language using a short everyday analogy.',
    simple: 'Explain as if to a bright 10-year-old. Two sentences maximum.',
    detailed: 'Explain thoroughly but in short sentences, with one worked example.'
  }[style] || 'Explain in plain Grade 6 language.';

  return requestText({
    instructions: `You are SETU's vernacular explainer for neurodivergent users.
${styleGuide}
Respond entirely in ${language}.
Never use jargon without immediately defining it. Keep sentences under 20 words.`,
    input: text,
    temperature: 0.5
  });
}

/**
 * Preemptive Cognitive Task Chunking: turn a dense, high-anxiety page into a
 * short linear checklist so the user is never facing the whole thing at once.
 */
const chunkSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pageName: { type: 'string' },
    whatThisPageIsFor: { type: 'string', description: 'One plain sentence.' },
    estimatedMinutes: { type: 'number' },
    thingsToHaveReady: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      description: 'Exactly 3 steps. Never more — the point is to shrink the wall.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '3-6 words.' },
          what: { type: 'string', description: 'One sentence on what to do.' },
          why: { type: 'string', description: 'One short sentence on why it matters.' }
        },
        required: ['title', 'what', 'why']
      }
    },
    encouragement: { type: 'string' }
  },
  required: ['pageName', 'whatThisPageIsFor', 'estimatedMinutes', 'thingsToHaveReady', 'steps', 'encouragement']
};

async function chunkPageIntoTasks({ pageContext = {} }) {
  return requestStructuredAI({
    name: 'setu_task_chunks',
    schema: chunkSchema,
    instructions: `You reduce overwhelming web pages into exactly 3 calm, linear steps for users
facing task-initiation paralysis.

Rules:
- Exactly 3 steps. If the page needs more, group them — never exceed 3.
- Each step is something the user can finish in a few minutes.
- "thingsToHaveReady" lists documents or details to gather first, so they are not
  ambushed halfway through. Empty array if nothing is needed.
- Encouragement is warm and specific, never generic cheerleading.`,
    input: `PAGE TITLE: ${pageContext.title || ''}
URL: ${pageContext.url || ''}
HEADINGS: ${(pageContext.headings || []).join(' | ')}
FORM FIELDS: ${(pageContext.controls || []).filter((c) => ['input', 'select', 'textarea'].includes(c.tag)).map((c) => c.label).join(', ') || 'none'}
TEXT:
${(pageContext.text || '').slice(0, 4000)}`,
    temperature: 0.4
  });
}

/**
 * Describe a chart, diagram, or dense interface region for someone who cannot
 * easily parse it visually.
 */
async function describeVisual({ imageBase64, mimeType, context = '', language = 'English' }) {
  return describeImage({
    imageBase64,
    mimeType,
    instructions: `You describe visuals for users with dyslexia, ADHD, or low vision.

Structure every answer as:
1. One sentence on what this is.
2. The main thing it shows — the actual takeaway, not a restatement of the axes.
3. The specific numbers, labels, or steps it contains, as a short list.

Use short sentences. Read values off the image rather than guessing. If part of
it is genuinely illegible, say which part instead of inventing it.
Respond entirely in ${language}.`,
    prompt: context
      ? `Describe this image. Surrounding page context: ${context}`
      : 'Describe this image.'
  });
}

module.exports = {
  planPageTask,
  explainContent,
  chunkPageIntoTasks,
  describeVisual,
  markConfirmations
};
