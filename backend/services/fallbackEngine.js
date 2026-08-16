/**
 * Deterministic L0 Offline Rule Engine
 * 100% offline, zero-latency local fallback algorithms.
 */

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 10);
}

function generateLocalStartMode(task, isStuck) {
  const cleanTask = task.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleanTask.split(/\s+/).slice(0, 5).join(' ');

  return {
    clarifyingQuestion: isStuck
      ? `What is the single smallest obstacle stopping you right now from working on "${words}"?`
      : `Would you prefer to spend 10 minutes drafting an outline or gathering materials for "${words}"?`,
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
    keyTakeaways: sentences.slice(0, 3).map((s) => s.trim()),
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
      { label: 'Direct & Clear', text: `Hi, I wanted to discuss ${topic} and align on the next immediate steps.`, tone: 'Direct' },
      { label: 'Polite & Collaborative', text: `Thanks for making time. I'd love to share my thoughts on ${topic} when you have a moment.`, tone: 'Collaborative' },
      { label: 'Asking for Time', text: `I am currently reviewing details for ${topic}. Can we check in tomorrow morning?`, tone: 'Cautious' }
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
    improvedText: sentences.map((s) => s.replace(passiveRegex, 'is active')).join(' '),
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

/**
 * Each `tip` is written as a clause completing "You will know it worked when …",
 * matching both the AI contract and how the web app labels it.
 */
function generateLocalGuideMode(goal) {
  const cleanGoal = String(goal || 'this task').trim();
  return {
    workflowName: cleanGoal,
    totalSteps: 4,
    steps: [
      {
        stepNumber: 1,
        title: 'Write down the finish line',
        actionRequired: `In one sentence, write what "${cleanGoal}" looks like when it is done.`,
        tip: 'you can read the sentence back and it names something you could point at.'
      },
      {
        stepNumber: 2,
        title: 'Gather what you need first',
        actionRequired: 'List every document, number, or login this will ask you for, and find them before starting.',
        tip: 'nothing on the list is still marked "need to find".'
      },
      {
        stepNumber: 3,
        title: 'Do the first concrete action',
        actionRequired: 'Open the form, page, or file and complete only the parts you can answer without looking anything up.',
        tip: 'the easy fields are filled and only the ones needing research are blank.'
      },
      {
        stepNumber: 4,
        title: 'Close the gaps, then submit',
        actionRequired: 'Go back to the blanks one at a time, then review once and submit.',
        tip: 'you see a confirmation message or reference number.'
      }
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
    (data.microSteps || []).forEach((s) => (md += `- ${s}\n`));
  } else if (mode === 'learn') {
    md += `## Summary\n${data.summary}\n\n## Mind Map Branches\n`;
    (data.mindMap?.branches || []).forEach((b) => {
      md += `### ${b.topic}\n`;
      b.details.forEach((d) => (md += `- ${d}\n`));
    });
  } else if (mode === 'meet') {
    md += `## Summary\n${data.summary}\n\n## Action Items\n`;
    (data.actionItems || []).forEach((a) => (md += `- [ ] **${a.task}** (Owner: ${a.owner}, Deadline: ${a.deadline})\n`));
  } else {
    md += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
  }
  return md;
}

function generateLocalNavigationPlan(task, pageContext = {}) {
  const cleanTask = String(task || 'Navigate page').trim();
  const controls = pageContext.controls || [];
  const title = pageContext.title || 'Target Portal';

  // Extract login or primary action controls from page context
  const loginControl = controls.find(c => /login|sign in|member|passbook|portal|log in/i.test(c.label || c.text || ''));
  const submitControl = controls.find(c => /submit|apply|proceed|next|register|search/i.test(c.label || c.text || ''));
  const inputControl = controls.find(c => /input|text|search|uan|aadhaar|pan|email|user/i.test(c.type || c.label || ''));

  const steps = [];

  if (loginControl) {
    steps.push({
      stepNumber: 1,
      instruction: `Click the "${loginControl.label || 'Login'}" link highlighted on the page to open the member access portal.`,
      targetSelector: loginControl.selector || 'a, button',
      targetText: loginControl.label || 'Login',
      actionType: 'click',
      tip: 'The target element is highlighted with a green glowing halo ring on your screen.'
    });
  } else {
    steps.push({
      stepNumber: 1,
      instruction: `Locate the main access section on ${title}.`,
      targetSelector: 'body',
      targetText: title,
      actionType: 'view',
      tip: 'Look for the primary navigation header or main button.'
    });
  }

  if (inputControl) {
    steps.push({
      stepNumber: steps.length + 1,
      instruction: `Enter your details into the "${inputControl.label || 'Input'}" field.`,
      targetSelector: inputControl.selector || 'input[type="text"]',
      targetText: inputControl.label || '',
      actionType: 'fill',
      tip: 'Optional fields can be skipped to save working memory.'
    });
  }

  steps.push({
    stepNumber: steps.length + 1,
    instruction: submitControl 
      ? `Click "${submitControl.label || 'Submit'}" to complete your request for "${cleanTask}".`
      : `Press the primary action button to complete "${cleanTask}".`,
    targetSelector: submitControl?.selector || 'button[type="submit"], input[type="submit"]',
    targetText: submitControl?.label || 'Submit',
    actionType: 'click',
    tip: 'Your progress is automatically saved.'
  });

  return {
    goal: cleanTask,
    totalSteps: steps.length,
    currentStepIndex: 0,
    steps,
    supportiveMessage: `I am guiding you step-by-step through ${cleanTask}. Focus on one highlighted action at a time.`
  };
}

module.exports = {
  splitSentences,
  generateLocalStartMode,
  generateLocalSimplifyMode,
  generateLocalLearnMode,
  generateLocalMeetMode,
  generateLocalPracticeMode,
  generateLocalWriteMode,
  generateLocalGuideMode,
  generateLocalSummary,
  generateLocalNavigationPlan,
  formatArtifactMarkdown
};
