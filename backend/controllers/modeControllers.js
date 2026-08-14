/**
 * Cognitive Mode Controllers
 * --------------------------
 * The seven modes share one shape: pull a field off the body, ask the AI for a
 * schema-shaped answer, and degrade to the deterministic L0 engine if that
 * fails. They are declared as data below and executed by a single runner, so a
 * fix to error handling or fallback reporting lands in all seven at once.
 */

const { requestStructuredAI } = require('../services/aiService');
const fallbacks = require('../services/fallbackEngine');
const config = require('../config');
const schemas = require('./modeSchemas');

/**
 * @typedef {object} ModeDefinition
 * @property {string} name        Schema name sent to the provider.
 * @property {object} schema      JSON schema the response must satisfy.
 * @property {string} instructions System prompt.
 * @property {(body: object) => string} input  Builds the user turn.
 * @property {(body: object) => object} fallback Deterministic L0 result.
 */

/** @type {Record<string, ModeDefinition>} */
const MODES = {
  start: {
    name: 'setu_start',
    schema: schemas.startSchema,
    instructions: `You are SETU's task-initiation copilot for people facing executive dysfunction —
the "Wall of Awful". Return one clarifying question, one action small enough to
finish in ten minutes, 3-5 micro-steps, a warm supportive message, and an honest
effort/anxiety/time estimate.

The ten-minute action must be genuinely tiny and physically concrete — "open the
document and write one heading", not "start the report". Never imply the whole
task must be finished today.`,
    input: (b) => `TASK: "${b.task}"\nUSER REPORTS BEING STUCK: ${Boolean(b.isStuck)}`,
    fallback: (b) => fallbacks.generateLocalStartMode(b.task, Boolean(b.isStuck))
  },

  simplify: {
    name: 'setu_simplify',
    schema: schemas.simplifySchema,
    instructions: `Rewrite dense or bureaucratic text into plain language at roughly a Grade 6
reading level. Keep every fact, obligation, deadline, and number exactly intact —
simplifying must never change what the text actually says. Then extract 2-5 key
takeaways and give practical sensory-comfort tips for reading it.`,
    input: (b) => `TEXT:\n${b.text}`,
    fallback: (b) => fallbacks.generateLocalSimplifyMode(b.text)
  },

  learn: {
    name: 'setu_learn',
    schema: schemas.learnSchema,
    instructions: `Turn dense study material into a summary, a hierarchical mind map, and a short
self-quiz. Branch labels stay under six words. Quiz questions must be answerable
from the material alone, with plausible distractors — never a giveaway.`,
    input: (b) => `MATERIAL:\n${b.text}`,
    fallback: (b) => fallbacks.generateLocalLearnMode(b.text)
  },

  meet: {
    name: 'setu_meet',
    schema: schemas.meetSchema,
    instructions: `Rescue a meeting transcript. Extract the summary, decisions actually made,
and action items with their real owner and deadline. Only list an action item if
someone genuinely committed to it — do not invent owners or dates. Decode any
corporate jargon into plain words.`,
    input: (b) => `TRANSCRIPT:\n${b.transcript}`,
    fallback: (b) => fallbacks.generateLocalMeetMode(b.transcript)
  },

  practice: {
    name: 'setu_practice',
    schema: schemas.practiceSchema,
    instructions: `Act as a supportive rehearsal partner for a difficult conversation. Give the
scenario context, the other person's realistic opening line, 2-4 response scripts
in distinct tones the user can actually say out loud, and one coaching tip.
Scripts should sound like natural speech, not written prose.`,
    input: (b) => `TOPIC: "${b.topic}"\nUSER'S LAST LINE: "${b.userUtterance || ''}"`,
    fallback: (b) => fallbacks.generateLocalPracticeMode(b.topic, b.userUtterance)
  },

  write: {
    name: 'setu_write',
    schema: schemas.writeSchema,
    instructions: `Review a draft for accessibility. Report its reading grade, rewrite it more
clearly while preserving the author's voice and meaning, list genuine passive-voice
instances, and give specific line edits with reasons. Never flag something as
passive voice when it is not.`,
    input: (b) => `DRAFT:\n${b.text}`,
    fallback: (b) => fallbacks.generateLocalWriteMode(b.text)
  },

  guide: {
    name: 'setu_guide',
    schema: schemas.guideSchema,
    instructions: `Break a workflow into clear numbered steps. Each step is one action with a
concrete success signal, so the user always knows it worked before moving on.`,
    input: (b) => `GOAL: "${b.goal}"`,
    fallback: (b) => fallbacks.generateLocalGuideMode(b.goal)
  }
};

/**
 * Build an Express handler for one mode.
 * Always answers 200 with usable content; `fallback` tells the client whether
 * it is looking at AI output or the deterministic local engine, and
 * `fallbackReason` says why — no silent substitution.
 */
function runMode(modeKey) {
  const mode = MODES[modeKey];

  return async function handler(req, res, next) {
    try {
      if (!config.aiEnabled) {
        return res.json({
          ...mode.fallback(req.body),
          fallback: true,
          fallbackReason: 'No AI provider is configured on the server.'
        });
      }

      try {
        const result = await requestStructuredAI({
          name: mode.name,
          schema: mode.schema,
          instructions: mode.instructions,
          input: mode.input(req.body)
        });
        res.json({ ...result, fallback: false });
      } catch (error) {
        console.warn(`[SETU ${modeKey}] AI failed, engaging L0 engine:`, error.message);
        res.json({
          ...mode.fallback(req.body),
          fallback: true,
          fallbackReason: error.message
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

/** POST /api/summarize — key points from arbitrary page text. */
async function handleSummarize(req, res, next) {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Text is required.' });

    if (!config.aiEnabled) {
      return res.json({ points: fallbacks.generateLocalSummary(text, 5), fallback: true });
    }

    try {
      const result = await requestStructuredAI({
        name: 'setu_summary',
        schema: schemas.summarySchema,
        instructions: `Summarise the page for a reader with limited working memory. Give a one-line
gist, then 3-5 key points, each a single self-contained sentence that makes sense
without the others. Then estimate the reading time in minutes.`,
        input: text
      });
      res.json({ ...result, points: result.points || [], fallback: false });
    } catch (error) {
      res.json({
        points: fallbacks.generateLocalSummary(text, 5),
        fallback: true,
        fallbackReason: error.message
      });
    }
  } catch (error) {
    next(error);
  }
}

/** POST /api/export — render any artifact as portable markdown. */
function handleExport(req, res, next) {
  try {
    const { mode, data } = req.body;
    if (!mode || !data) {
      return res.status(400).json({ error: 'Both "mode" and "data" are required.' });
    }
    res.json({
      markdown: fallbacks.formatArtifactMarkdown(mode, data),
      filename: `setu-${mode}-${Date.now()}.md`
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleStartMode: runMode('start'),
  handleSimplifyMode: runMode('simplify'),
  handleLearnMode: runMode('learn'),
  handleMeetMode: runMode('meet'),
  handlePracticeMode: runMode('practice'),
  handleWriteMode: runMode('write'),
  handleGuideMode: runMode('guide'),
  handleSummarize,
  handleExport
};
