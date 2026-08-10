/**
 * NeuroBridge One Backend Orchestration Service
 * Powered by SETU Kernel
 *
 * Implements the 7 Cognitive Accessibility Modes:
 * 1. Start Mode: Task initiation, micro-steps, 10-minute immediate action, confidence meter, autopilot.
 * 2. Simplify Mode: Plain-language transformation, clutter reduction, sensory-friendly reading heuristics.
 * 3. Learn Mode: Mind map visual tree structure, concise summary, quick comprehension quiz.
 * 4. Meet Mode: Transcript to action items with owners & deadlines, key decisions, jargon rescue.
 * 5. Practice Mode: Social scripting dialogue rehearsal with adaptive role-play feedback.
 * 6. Write Mode: Accessible authoring, passive voice reduction, grade level readability scoring.
 * 7. Guide Mode: Step-by-step software workflow instructions.
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { randomUUID } = require('crypto');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TEXT_LENGTH = 16000;

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    product: 'NeuroBridge One',
    engine: 'SETU Kernel',
    version: '2.5.0',
    aiEnabled: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
    modes: ['start', 'simplify', 'learn', 'meet', 'practice', 'write', 'guide'],
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// 1. START MODE (Hero Flow: Wall of Awful & Task Initiation)
// ---------------------------------------------------------------------------
const startSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clarifyingQuestion: { type: 'string' },
    immediateTenMinuteAction: { type: 'string' },
    microSteps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    supportiveMessage: { type: 'string' },
    confidenceMeter: {
      type: 'object',
      additionalProperties: false,
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

app.post('/api/start', async (req, res, next) => {
  try {
    const task = requiredText(req.body.task, 1000);
    const isStuck = Boolean(req.body.isStuck);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_start',
          schema: startSchema,
          instructions: 'You are NeuroBridge One, a cognitive co-pilot for task initiation (overcoming the Wall of Awful). Given a daunting task, ask 1 concise clarifying question, give 1 immediate 10-minute action, 3-5 tiny micro-steps, a supportive plain-language message, and a confidence assessment. Avoid pressuring language.',
          input: `TASK AVOIDANCE PROMPT: "${task}"\nUSER IS STUCK: ${isStuck}`
        });
      } catch (err) {
        console.warn('AI Start mode failed, falling back to L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalStartMode(task, isStuck);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 2. SIMPLIFY MODE (Cognitive & Sensory Overload Reduction)
// ---------------------------------------------------------------------------
const simplifySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plainLanguageRewrite: { type: 'string' },
    keyTakeaways: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    sensoryTips: { type: 'array', items: { type: 'string' } },
    readabilityGrade: { type: 'string' }
  },
  required: ['plainLanguageRewrite', 'keyTakeaways', 'sensoryTips', 'readabilityGrade']
};

app.post('/api/simplify', async (req, res, next) => {
  try {
    const text = requiredText(req.body.text);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_simplify',
          schema: simplifySchema,
          instructions: 'Rewrite complex text into calm, plain language (6th-grade reading level), remove visual jargon/clutter, extract 2-5 key takeaways, and provide sensory reading tips.',
          input: `SOURCE TEXT:\n${text}`
        });
      } catch (err) {
        console.warn('AI Simplify mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalSimplifyMode(text);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 3. LEARN MODE (Mind Map + Summary + Quiz)
// ---------------------------------------------------------------------------
const learnSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    mindMap: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rootNode: { type: 'string' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              topic: { type: 'string' },
              details: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic', 'details']
          }
        }
      },
      required: ['rootNode', 'branches']
    },
    quiz: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerIndex: { type: 'number' },
          explanation: { type: 'string' }
        },
        required: ['question', 'options', 'answerIndex', 'explanation']
      },
      minItems: 2,
      maxItems: 4
    }
  },
  required: ['summary', 'mindMap', 'quiz']
};

app.post('/api/learn', async (req, res, next) => {
  try {
    const text = requiredText(req.body.text);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_learn',
          schema: learnSchema,
          instructions: 'Analyze dense educational material and produce a concise summary, a hierarchical Mind Map (root topic + sub-branches with bullet details), and a 3-question self-quiz.',
          input: `MATERIAL TO LEARN:\n${text}`
        });
      } catch (err) {
        console.warn('AI Learn mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalLearnMode(text);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 4. MEET MODE (Meeting Transcript to Action Items, Owners, Deadlines)
// ---------------------------------------------------------------------------
const meetSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    keyDecisions: { type: 'array', items: { type: 'string' } },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          task: { type: 'string' },
          owner: { type: 'string' },
          deadline: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] }
        },
        required: ['task', 'owner', 'deadline', 'priority']
      }
    },
    jargonDecoded: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          term: { type: 'string' },
          plainMeaning: { type: 'string' }
        },
        required: ['term', 'plainMeaning']
      }
    }
  },
  required: ['summary', 'keyDecisions', 'actionItems', 'jargonDecoded']
};

app.post('/api/meet', async (req, res, next) => {
  try {
    const transcript = requiredText(req.body.transcript);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_meet',
          schema: meetSchema,
          instructions: 'Extract structured meeting outcomes: high-level summary, key decisions, clear action items with assigned owners and deadlines, and decode corporate/technical jargon into plain terms.',
          input: `MEETING TRANSCRIPT:\n${transcript}`
        });
      } catch (err) {
        console.warn('AI Meet mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalMeetMode(transcript);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 5. PRACTICE MODE (Social Scripting & Role-Play Rehearsal)
// ---------------------------------------------------------------------------
const practiceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scenarioContext: { type: 'string' },
    openingLine: { type: 'string' },
    suggestedResponses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          text: { type: 'string' },
          tone: { type: 'string', enum: ['Direct', 'Polite & Assertive', 'Collaborative', 'Cautious'] }
        },
        required: ['label', 'text', 'tone']
      },
      minItems: 2,
      maxItems: 4
    },
    coachingTip: { type: 'string' }
  },
  required: ['scenarioContext', 'openingLine', 'suggestedResponses', 'coachingTip']
};

app.post('/api/practice', async (req, res, next) => {
  try {
    const topic = requiredText(req.body.topic, 1000);
    const userUtterance = typeof req.body.userUtterance === 'string' ? req.body.userUtterance.slice(0, 500) : '';
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_practice',
          schema: practiceSchema,
          instructions: 'Act as a supportive dialogue rehearsal partner for social scripting (phone calls, job interviews, asking for deadline extension). Provide realistic partner prompt, 3 distinct option scripts for the user, and a non-judgmental coaching tip.',
          input: `SCENARIO TOPIC: "${topic}"\nLAST USER UTTERANCE: "${userUtterance}"`
        });
      } catch (err) {
        console.warn('AI Practice mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalPracticeMode(topic, userUtterance);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 6. WRITE MODE (Accessible Authoring & Readability Analysis)
// ---------------------------------------------------------------------------
const writeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    originalGradeLevel: { type: 'string' },
    improvedText: { type: 'string' },
    passiveVoiceInstances: { type: 'array', items: { type: 'string' } },
    clarityFixes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          originalSnippet: { type: 'string' },
          suggestedSnippet: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['originalSnippet', 'suggestedSnippet', 'reason']
      }
    }
  },
  required: ['originalGradeLevel', 'improvedText', 'passiveVoiceInstances', 'clarityFixes']
};

app.post('/api/write', async (req, res, next) => {
  try {
    const text = requiredText(req.body.text);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_write',
          schema: writeSchema,
          instructions: 'Analyze draft text for cognitive accessibility. Identify passive voice, complex sentence structures, calculate reading grade, and return a simplified, clear rewrite with specific line edits.',
          input: `DRAFT TEXT:\n${text}`
        });
      } catch (err) {
        console.warn('AI Write mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalWriteMode(text);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// 7. GUIDE MODE (Step-by-step software literacy guide)
// ---------------------------------------------------------------------------
const guideSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workflowName: { type: 'string' },
    totalSteps: { type: 'number' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stepNumber: { type: 'number' },
          title: { type: 'string' },
          actionRequired: { type: 'string' },
          tip: { type: 'string' }
        },
        required: ['stepNumber', 'title', 'actionRequired', 'tip']
      }
    }
  },
  required: ['workflowName', 'totalSteps', 'steps']
};

app.post('/api/guide', async (req, res, next) => {
  try {
    const goal = requiredText(req.body.goal, 1000);
    let result;
    let fallback = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        result = await requestStructuredAI({
          name: 'neurobridge_guide',
          schema: guideSchema,
          instructions: 'Break down a software task or website workflow into clear, step-by-step instructions. Keep language ultra-direct and sensory-friendly.',
          input: `USER GOAL: "${goal}"`
        });
      } catch (err) {
        console.warn('AI Guide mode failed, using L0:', err.message);
        fallback = true;
      }
    } else {
      fallback = true;
    }

    if (!result) {
      result = generateLocalGuideMode(goal);
    }

    res.json({ ...result, fallback });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// EXPORT ENDPOINT (One-click Export as Markdown / Formatted Text)
// ---------------------------------------------------------------------------
app.post('/api/export', (req, res, next) => {
  try {
    const { mode, data } = req.body;
    if (!mode || !data) {
      return res.status(400).json({ error: 'Mode and data are required.' });
    }
    const markdown = formatArtifactMarkdown(mode, data);
    res.json({ markdown, filename: `neurobridge-${mode}-${Date.now()}.md` });
  } catch (error) { next(error); }
});

// Helper route for basic summaries
app.post('/api/summarize', async (req, res, next) => {
  try {
    const text = requiredText(req.body.text);
    const maxPoints = clampInteger(req.body.maxPoints, 1, 8, 5);
    const summaryData = generateLocalSummary(text, maxPoints);
    res.json({ points: summaryData, summary: summaryData, fallback: true });
  } catch (error) { next(error); }
});

app.post('/api/analyze', (req, res, next) => {
  try { res.json(analyzeReadingDifficulty(requiredText(req.body.text))); } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// L0 DETERMINISTIC FALLBACK GENERATORS (100% Offline / Zero-Latency)
// ---------------------------------------------------------------------------
function generateLocalStartMode(task, isStuck) {
  const cleanTask = task.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleanTask.split(/\s+/).slice(0, 5).join(' ');
  
  return {
    clarifyingQuestion: isStuck
      ? `What is the single smallest thing stopping you right now from working on "${words}"?`
      : `Would you prefer to spend 10 minutes drafting an outline or gathering your initial materials for "${words}"?`,
    immediateTenMinuteAction: `Open a blank document, title it "${words || 'My Task'}", and write down 3 quick bullet points.`,
    microSteps: [
      `Step 1: Set a timer for 10 minutes (no pressure to finish).`,
      `Step 2: Write down the first 3 sub-items for ${words || 'this task'}.`,
      `Step 3: Pick one sub-item and complete just 1 sentence or line.`,
      `Step 4: Take a 2-minute break and celebrate starting.`
    ],
    supportiveMessage: `Starting is the hardest part. You don't have to finish today — just give yourself 10 quiet minutes.`,
    confidenceMeter: {
      effortLevel: isStuck ? 'Low' : 'Medium',
      anxietyLevel: isStuck ? 'High' : 'Moderate',
      estimatedTimeMinutes: 10
    }
  };
}

function generateLocalSimplifyMode(text) {
  const sentences = splitSentences(text);
  const plainText = sentences.slice(0, 4).join(' ');
  return {
    plainLanguageRewrite: plainText
      ? `In clear terms: ${plainText}`
      : 'The page content has been formatted into short, direct sentences.',
    keyTakeaways: sentences.slice(0, 3).map(s => s.trim()),
    sensoryTips: [
      'Enable High Contrast mode if bright backgrounds strain your eyes.',
      'Use Bionic Reading anchors to guide visual tracking.'
    ],
    readabilityGrade: 'Grade 6.5 (Plain Language)'
  };
}

function generateLocalLearnMode(text) {
  const sentences = splitSentences(text);
  const title = sentences[0] ? sentences[0].slice(0, 40) : 'Core Concept';
  return {
    summary: sentences.slice(0, 3).join(' ') || 'Key learning points extracted from source material.',
    mindMap: {
      rootNode: title,
      branches: [
        {
          topic: 'Overview',
          details: [sentences[0] || 'Primary context', sentences[1] || 'Key background']
        },
        {
          topic: 'Key Insights',
          details: [sentences[2] || 'Core finding', sentences[3] || 'Important implication']
        }
      ]
    },
    quiz: [
      {
        question: `What is the main topic discussed in this material?`,
        options: [title, 'Unrelated topic A', 'Unrelated topic B'],
        answerIndex: 0,
        explanation: `The material primarily focuses on ${title}.`
      },
      {
        question: `How should you approach reading this text?`,
        options: ['Break it into small chunks', 'Read it all in one sitting without breaks', 'Ignore key terms'],
        answerIndex: 0,
        explanation: 'Chunking dense text reduces cognitive load.'
      }
    ]
  };
}

function generateLocalMeetMode(transcript) {
  const sentences = splitSentences(transcript);
  return {
    summary: sentences.slice(0, 2).join(' ') || 'Meeting transcript processed.',
    keyDecisions: [
      sentences[0] || 'Decided to move forward with project plan.',
      'Agreed on timeline for initial draft review.'
    ],
    actionItems: [
      { task: sentences[1] || 'Review initial draft details', owner: 'Team Lead', deadline: 'End of week', priority: 'High' },
      { task: 'Prepare next milestone overview', owner: 'Assignee', deadline: 'Next Monday', priority: 'Medium' }
    ],
    jargonDecoded: [
      { term: 'Bandwidth', plainMeaning: 'Available time and energy' },
      { term: 'Actionable', plainMeaning: 'Can be done right away' }
    ]
  };
}

function generateLocalPracticeMode(topic, userUtterance) {
  return {
    scenarioContext: `Rehearsing for: ${topic}`,
    openingLine: `Roleplay Partner: "Hello! Thanks for reaching out regarding ${topic}. How can I assist you today?"`,
    suggestedResponses: [
      {
        label: 'Direct & Clear',
        text: `Hi, I wanted to discuss ${topic} and align on the next immediate steps.`,
        tone: 'Direct'
      },
      {
        label: 'Polite & Collaborative',
        text: `Thanks for making time. I'd love to share my thoughts on ${topic} when you have a moment.`,
        tone: 'Collaborative'
      },
      {
        label: 'Asking for Time',
        text: `I am currently reviewing details for ${topic}. Can we check in tomorrow morning?`,
        tone: 'Cautious'
      }
    ],
    coachingTip: 'Take a slow breath before responding. Pause whenever you need to collect your thoughts.'
  };
}

function generateLocalWriteMode(text) {
  const sentences = splitSentences(text);
  const passiveRegex = /\b(am|is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b/gi;
  const passiveMatches = text.match(passiveRegex) || [];

  return {
    originalGradeLevel: 'Grade 10.2',
    improvedText: sentences.map(s => s.replace(passiveRegex, 'is active')).join(' '),
    passiveVoiceInstances: Array.from(new Set(passiveMatches)).slice(0, 4),
    clarityFixes: [
      {
        originalSnippet: sentences[0] || 'Complex phrasing used here.',
        suggestedSnippet: sentences[0] ? sentences[0].slice(0, 60) + '.' : 'Use shorter sentences.',
        reason: 'Shortening sentences improves working-memory retention.'
      }
    ]
  };
}

function generateLocalGuideMode(goal) {
  return {
    workflowName: goal,
    totalSteps: 3,
    steps: [
      { stepNumber: 1, title: 'Locate the Start Button', actionRequired: 'Click the primary action button at the top of the interface.', tip: 'It is highlighted with a high-contrast accent.' },
      { stepNumber: 2, title: 'Fill Essential Fields', actionRequired: 'Enter your name and details into the short form.', tip: 'Optional fields can be skipped to save cognitive effort.' },
      { stepNumber: 3, title: 'Confirm & Save', actionRequired: 'Click Save to lock in your changes.', tip: 'A green check icon will confirm success.' }
    ]
  };
}

function generateLocalSummary(text, maxPoints) {
  const sentences = splitSentences(text);
  return sentences.slice(0, maxPoints);
}

function formatArtifactMarkdown(mode, data) {
  let md = `# NeuroBridge One Artifact: ${mode.toUpperCase()}\n\n`;
  if (mode === 'start') {
    md += `## Clarifying Question\n${data.clarifyingQuestion}\n\n`;
    md += `## Immediate 10-Minute Action\n> ${data.immediateTenMinuteAction}\n\n`;
    md += `## Micro-steps\n`;
    (data.microSteps || []).forEach(s => md += `- ${s}\n`);
  } else if (mode === 'learn') {
    md += `## Summary\n${data.summary}\n\n## Mind Map Branches\n`;
    (data.mindMap?.branches || []).forEach(b => {
      md += `### ${b.topic}\n`;
      b.details.forEach(d => md += `- ${d}\n`);
    });
  } else if (mode === 'meet') {
    md += `## Summary\n${data.summary}\n\n## Action Items\n`;
    (data.actionItems || []).forEach(a => md += `- [ ] **${a.task}** (Owner: ${a.owner}, Deadline: ${a.deadline})\n`);
  } else {
    md += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
  }
  return md;
}

// Helpers & Utilities
function requiredText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('Text input is required.'); error.status = 400; throw error;
  }
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

async function requestStructuredAI({ name, schema, instructions, input }) {
  const response = await axios.post('https://api.openai.com/v1/responses', {
    model: AI_MODEL,
    instructions,
    input,
    store: false,
    text: { format: { type: 'json_schema', name, strict: true, schema } }
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 20000
  });
  
  const outputText = response.data.output_text || response.data.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('');

  if (!outputText) throw new Error('The model returned no text output.');
  return JSON.parse(outputText);
}

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 10);
}

function analyzeReadingDifficulty(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = splitSentences(text);
  const syllables = words.reduce((total, word) => total + (word.length > 3 ? 2 : 1), 0);
  const averageSentenceLength = words.length / Math.max(sentences.length, 1);
  const fleschScore = Math.max(0, 206.835 - 1.015 * averageSentenceLength - 84.6 * (syllables / Math.max(words.length, 1)));
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    fleschScore: fleschScore.toFixed(1),
    gradeLevel: fleschScore > 70 ? '6th Grade (Very Accessible)' : fleschScore > 50 ? '8th-9th Grade (Standard)' : 'College Level (Dense)'
  };
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  console.error('NeuroBridge API error:', error.message);
  res.status(status).json({ error: status < 500 ? error.message : 'NeuroBridge engine could not complete request.' });
});

app.listen(PORT, () => console.log(`NeuroBridge One engine listening on http://localhost:${PORT}`));
module.exports = app;
