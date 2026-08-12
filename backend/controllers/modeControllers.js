/**
 * Mode Controllers Module
 * Encapsulates mode execution, AI invocation, and fallback routing.
 */
const { requestStructuredAI } = require('../services/aiService');
const fallbacks = require('../services/fallbackEngine');
const config = require('../config');

// 1. START CONTROLLER
async function handleStartMode(req, res, next) {
  try {
    const task = req.body.task;
    const isStuck = Boolean(req.body.isStuck);
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_start',
          schema: startSchema,
          instructions: 'You are NeuroBridge One, a cognitive co-pilot for task initiation. Return 1 clarifying question, 1 immediate 10-minute action, 3-5 micro-steps, supportive message, and confidence meter scores.',
          input: `TASK: "${task}"\nIS STUCK: ${isStuck}`
        });
      } catch (err) {
        console.warn('AI Start failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalStartMode(task, isStuck);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 2. SIMPLIFY CONTROLLER
async function handleSimplifyMode(req, res, next) {
  try {
    const text = req.body.text;
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_simplify',
          schema: simplifySchema,
          instructions: 'Rewrite complex text into Grade 6.0 plain language, extract 2-5 key takeaways, and provide sensory tips.',
          input: `TEXT:\n${text}`
        });
      } catch (err) {
        console.warn('AI Simplify failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalSimplifyMode(text);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 3. LEARN CONTROLLER
async function handleLearnMode(req, res, next) {
  try {
    const text = req.body.text;
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_learn',
          schema: learnSchema,
          instructions: 'Analyze dense educational material and produce a concise summary, a hierarchical Mind Map (root topic + branches with details), and a 3-question self-quiz.',
          input: `MATERIAL:\n${text}`
        });
      } catch (err) {
        console.warn('AI Learn failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalLearnMode(text);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 4. MEET CONTROLLER
async function handleMeetMode(req, res, next) {
  try {
    const transcript = req.body.transcript;
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_meet',
          schema: meetSchema,
          instructions: 'Extract meeting summary, key decisions, action items with assigned owners and deadlines, and decode corporate jargon.',
          input: `TRANSCRIPT:\n${transcript}`
        });
      } catch (err) {
        console.warn('AI Meet failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalMeetMode(transcript);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 5. PRACTICE CONTROLLER
async function handlePracticeMode(req, res, next) {
  try {
    const topic = req.body.topic;
    const userUtterance = typeof req.body.userUtterance === 'string' ? req.body.userUtterance.slice(0, 500) : '';
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_practice',
          schema: practiceSchema,
          instructions: 'Act as a supportive dialogue rehearsal partner. Provide partner prompt, 3 distinct response scripts, and a coaching tip.',
          input: `TOPIC: "${topic}"\nUSER: "${userUtterance}"`
        });
      } catch (err) {
        console.warn('AI Practice failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalPracticeMode(topic, userUtterance);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 6. WRITE CONTROLLER
async function handleWriteMode(req, res, next) {
  try {
    const text = req.body.text;
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_write',
          schema: writeSchema,
          instructions: 'Analyze draft text for readability grade, passive voice, and provide plain-language line edits.',
          input: `DRAFT:\n${text}`
        });
      } catch (err) {
        console.warn('AI Write failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalWriteMode(text);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// 7. GUIDE CONTROLLER
async function handleGuideMode(req, res, next) {
  try {
    const goal = req.body.goal;
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_guide',
          schema: guideSchema,
          instructions: 'Break down a software task or workflow into step-by-step instructions.',
          input: `GOAL: "${goal}"`
        });
      } catch (err) {
        console.warn('AI Guide failed, engaging L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalGuideMode(goal);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

// EXPORT CONTROLLER
function handleExport(req, res, next) {
  try {
    const { mode, data } = req.body;
    if (!mode || !data) {
      return res.status(400).json({ error: 'Mode and data are required.' });
    }
    const markdown = fallbacks.formatArtifactMarkdown(mode, data);
    res.json({ markdown, filename: `neurobridge-${mode}-${Date.now()}.md` });
  } catch (error) { next(error); }
}

// Schemas
const startSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    clarifyingQuestion: { type: 'string' },
    immediateTenMinuteAction: { type: 'string' },
    microSteps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    supportiveMessage: { type: 'string' },
    confidenceMeter: {
      type: 'object', additionalProperties: false,
      properties: {
        effortLevel: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        anxietyLevel: { type: 'string', enum: ['Low', 'Moderate', 'High'] },
        estimatedTimeMinutes: { type: 'number' }
      },
      required: ['effortLevel', 'anxietyLevel', 'estimatedTimeMinutes']
    }
  },
  required: ['clarifyingQuestion', 'immediateTenMinuteAction', 'microSteps', 'supportiveMessage', 'confidenceMeter']
};

const simplifySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    plainLanguageRewrite: { type: 'string' },
    keyTakeaways: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    sensoryTips: { type: 'array', items: { type: 'string' } },
    readabilityGrade: { type: 'string' }
  },
  required: ['plainLanguageRewrite', 'keyTakeaways', 'sensoryTips', 'readabilityGrade']
};

const learnSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    mindMap: {
      type: 'object', additionalProperties: false,
      properties: {
        rootNode: { type: 'string' },
        branches: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: { topic: { type: 'string' }, details: { type: 'array', items: { type: 'string' } } },
            required: ['topic', 'details']
          }
        }
      },
      required: ['rootNode', 'branches']
    },
    quiz: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answerIndex: { type: 'number' }, explanation: { type: 'string' } },
        required: ['question', 'options', 'answerIndex', 'explanation']
      },
      minItems: 2, maxItems: 4
    }
  },
  required: ['summary', 'mindMap', 'quiz']
};

const meetSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    keyDecisions: { type: 'array', items: { type: 'string' } },
    actionItems: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { task: { type: 'string' }, owner: { type: 'string' }, deadline: { type: 'string' }, priority: { type: 'string', enum: ['High', 'Medium', 'Low'] } },
        required: ['task', 'owner', 'deadline', 'priority']
      }
    },
    jargonDecoded: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { term: { type: 'string' }, plainMeaning: { type: 'string' } },
        required: ['term', 'plainMeaning']
      }
    }
  },
  required: ['summary', 'keyDecisions', 'actionItems', 'jargonDecoded']
};

const practiceSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    scenarioContext: { type: 'string' },
    openingLine: { type: 'string' },
    suggestedResponses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { label: { type: 'string' }, text: { type: 'string' }, tone: { type: 'string', enum: ['Direct', 'Polite & Assertive', 'Collaborative', 'Cautious'] } },
        required: ['label', 'text', 'tone']
      },
      minItems: 2, maxItems: 4
    },
    coachingTip: { type: 'string' }
  },
  required: ['scenarioContext', 'openingLine', 'suggestedResponses', 'coachingTip']
};

const writeSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    originalGradeLevel: { type: 'string' },
    improvedText: { type: 'string' },
    passiveVoiceInstances: { type: 'array', items: { type: 'string' } },
    clarityFixes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { originalSnippet: { type: 'string' }, suggestedSnippet: { type: 'string' }, reason: { type: 'string' } },
        required: ['originalSnippet', 'suggestedSnippet', 'reason']
      }
    }
  },
  required: ['originalGradeLevel', 'improvedText', 'passiveVoiceInstances', 'clarityFixes']
};

const guideSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    workflowName: { type: 'string' },
    totalSteps: { type: 'number' },
    steps: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { stepNumber: { type: 'number' }, title: { type: 'string' }, actionRequired: { type: 'string' }, tip: { type: 'string' } },
        required: ['stepNumber', 'title', 'actionRequired', 'tip']
      }
    }
  },
  required: ['workflowName', 'totalSteps', 'steps']
};

// 8. AUTONOMOUS AGENT NAVIGATE CONTROLLER
async function handleAgentNavigate(req, res, next) {
  try {
    const task = req.body.task;
    const pageContext = req.body.pageContext || {};
    let result;
    let fallback = false;

    if (config.openAiApiKey || config.geminiApiKey) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_agent_navigate',
          schema: agentNavigateSchema,
          instructions: 'You are NeuroBridge Autonomous Navigation Agent. Given a user task (e.g. Apply for EPFO, login to portal) and safe DOM controls extracted from the live page, return a clear, step-by-step navigation plan. For each step provide an ultra-clear instruction, targetSelector or text, actionType (click, fill, view), and a calm tip.',
          input: `USER TASK: "${task}"\nLIVE PAGE DOM CONTEXT:\n${JSON.stringify(pageContext)}`
        });
      } catch (err) {
        console.warn('AI Navigation Agent failed, engaging L0 fallback:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    result = result || fallbacks.generateLocalNavigationPlan(task, pageContext);
    res.json({ ...result, fallback });
  } catch (error) { next(error); }
}

const agentNavigateSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    goal: { type: 'string' },
    totalSteps: { type: 'number' },
    currentStepIndex: { type: 'number' },
    supportiveMessage: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          stepNumber: { type: 'number' },
          instruction: { type: 'string' },
          targetSelector: { type: 'string' },
          targetText: { type: 'string' },
          actionType: { type: 'string', enum: ['click', 'fill', 'view', 'navigate', 'scroll', 'select', 'summarize', 'extract', 'wait'] },
          valueToFill: { type: 'string' },
          tip: { type: 'string' }
        },
        required: ['stepNumber', 'instruction', 'targetSelector', 'targetText', 'actionType', 'tip']
      }
    }
  },
  required: ['goal', 'totalSteps', 'currentStepIndex', 'supportiveMessage', 'steps']
};

async function handleAgentPlan(req, res, next) {
  try {
    const command = req.body.command || '';
    const context = req.body.context || {};
    const navPlan = fallbacks.generateLocalNavigationPlan(command, context);
    res.json({
      plan: {
        intent: 'task_path',
        message: `I created a task path for "${command}".`,
        steps: navPlan.steps
      }
    });
  } catch (error) { next(error); }
}

async function handleExplain(req, res, next) {
  try {
    const text = req.body.text || '';
    const explanation = fallbacks.generateLocalSimplifyMode(text).plainLanguageRewrite || text;
    res.json({ explanation });
  } catch (error) { next(error); }
}

module.exports = {
  handleStartMode,
  handleSimplifyMode,
  handleLearnMode,
  handleMeetMode,
  handlePracticeMode,
  handleWriteMode,
  handleGuideMode,
  handleAgentNavigate,
  handleAgentPlan,
  handleExplain,
  handleExport
};
