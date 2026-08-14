/**
 * In-Page Agent Controller
 * Plans and explains actions for the browser extension running on any website.
 */

const agent = require('../services/agentService');
const fallbacks = require('../services/fallbackEngine');
const config = require('../config');

/**
 * Build the deterministic L0 plan used when the AI engine is unavailable.
 *
 * Critically, this runs through the same `markConfirmations` pass as an AI
 * plan. Without it, an offline fallback would hand the extension a "click
 * Submit" step carrying no safety flag, and Auto-Run would fire it unattended.
 */
function localPlan(task, pageContext = {}, reason) {
  const plan = fallbacks.generateLocalNavigationPlan(task, pageContext);
  return {
    ...plan,
    feasible: true,
    understanding: `Working from a basic page scan for "${task}".`,
    blockedReason: '',
    steps: agent.markConfirmations(plan.steps || [], pageContext.controls || []),
    fallback: true,
    fallbackReason: reason
  };
}

/** POST /api/agent/plan — natural-language goal + page snapshot -> action plan. */
async function handleAgentPlan(req, res, next) {
  try {
    const task = String(req.body.task || req.body.command || '').trim();
    if (!task) return res.status(400).json({ error: 'A task is required.' });

    const pageContext = req.body.pageContext || {};

    if (!config.aiEnabled) {
      return res.json(localPlan(task, pageContext, 'No AI provider is configured on the server.'));
    }

    try {
      const plan = await agent.planPageTask({ task, pageContext });
      res.json({ ...plan, fallback: false });
    } catch (error) {
      console.warn('[SETU Agent] Planning failed, using local heuristics:', error.message);
      res.json(localPlan(task, pageContext, error.message));
    }
  } catch (error) {
    next(error);
  }
}

/** POST /api/agent/explain — plain-language explanation, optionally translated. */
async function handleExplain(req, res, next) {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Text to explain is required.' });

    if (!config.aiEnabled) {
      return res.json({
        explanation: fallbacks.generateLocalSimplifyMode(text).plainLanguageRewrite,
        fallback: true
      });
    }

    try {
      const explanation = await agent.explainContent({
        text,
        language: req.body.language || 'English',
        style: req.body.style || 'plain'
      });
      res.json({ explanation, fallback: false });
    } catch (error) {
      res.json({
        explanation: fallbacks.generateLocalSimplifyMode(text).plainLanguageRewrite,
        fallback: true,
        fallbackReason: error.message
      });
    }
  } catch (error) {
    next(error);
  }
}

/** POST /api/agent/chunk — collapse a dense page into 3 calm steps. */
async function handleChunkPage(req, res, next) {
  try {
    const pageContext = req.body.pageContext || {};

    if (!config.aiEnabled) {
      return res.json({ ...localChunks(pageContext), fallback: true });
    }

    try {
      const chunks = await agent.chunkPageIntoTasks({ pageContext });
      res.json({ ...chunks, fallback: false });
    } catch (error) {
      console.warn('[SETU Agent] Chunking failed, using local heuristics:', error.message);
      res.json({ ...localChunks(pageContext), fallback: true, fallbackReason: error.message });
    }
  } catch (error) {
    next(error);
  }
}

/** Deterministic 3-step chunking used when no AI is reachable. */
function localChunks(pageContext) {
  const fields = (pageContext.controls || []).filter((c) =>
    ['input', 'select', 'textarea'].includes(c.tag)
  );

  return {
    pageName: pageContext.title || 'This page',
    whatThisPageIsFor: 'This page asks you for some information and then submits it.',
    estimatedMinutes: Math.max(3, Math.min(15, Math.ceil(fields.length * 0.75) || 5)),
    thingsToHaveReady: fields.length ? ['Any ID numbers or documents this form asks for'] : [],
    steps: [
      {
        title: 'Read the top section',
        what: 'Read only the first section of the page. Ignore everything below it for now.',
        why: 'Seeing one section at a time keeps the page from feeling overwhelming.'
      },
      {
        title: 'Fill what you know',
        what: `Fill in the fields you can answer straight away${fields.length ? ` (${fields.length} found)` : ''}. Skip anything you need to look up.`,
        why: 'Momentum from easy fields makes the harder ones feel smaller.'
      },
      {
        title: 'Check, then submit',
        what: 'Go back over the skipped fields, then submit when you are ready.',
        why: 'One deliberate pass at the end catches mistakes without slowing you down.'
      }
    ],
    encouragement: 'You do not have to finish this in one sitting. One step is real progress.'
  };
}

/** POST /api/agent/describe-image — plain-language description of a visual. */
async function handleDescribeImage(req, res, next) {
  try {
    const image = String(req.body.image || '');
    if (!image) return res.status(400).json({ error: 'An image is required.' });
    if (!config.aiEnabled) {
      return res.status(503).json({ error: 'Image description needs an AI provider configured.' });
    }

    // Accept either a bare base64 payload or a full data: URL.
    const match = image.match(/^data:([^;]+);base64,(.*)$/);

    const description = await agent.describeVisual({
      imageBase64: match ? match[2] : image,
      mimeType: match ? match[1] : req.body.mimeType || 'image/jpeg',
      context: req.body.context || '',
      language: req.body.language || 'English'
    });

    res.json({ description });
  } catch (error) {
    next(error);
  }
}

module.exports = { handleAgentPlan, handleExplain, handleChunkPage, handleDescribeImage };
