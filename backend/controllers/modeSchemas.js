/**
 * JSON schemas for the seven cognitive modes.
 * Kept separate from the controllers so the response contract is readable on
 * its own and shared with any client that wants to validate against it.
 */

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
  required: [
    'clarifyingQuestion',
    'immediateTenMinuteAction',
    'microSteps',
    'supportiveMessage',
    'confidenceMeter'
  ]
};

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
        properties: { term: { type: 'string' }, plainMeaning: { type: 'string' } },
        required: ['term', 'plainMeaning']
      }
    }
  },
  required: ['summary', 'keyDecisions', 'actionItems', 'jargonDecoded']
};

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
          tone: {
            type: 'string',
            enum: ['Direct', 'Polite & Assertive', 'Collaborative', 'Cautious']
          }
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

const summarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    gist: { type: 'string' },
    points: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    readingTimeMinutes: { type: 'number' }
  },
  required: ['gist', 'points', 'readingTimeMinutes']
};

module.exports = {
  startSchema,
  simplifySchema,
  learnSchema,
  meetSchema,
  practiceSchema,
  writeSchema,
  guideSchema,
  summarySchema
};
