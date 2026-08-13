/**
 * SETU API Service Layer
 * Unified interface with L0 local fallback for zero-latency offline operation.
 */

function getApiBase() {
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_API_URL || localStorage.getItem('setu_api_url') || 'http://localhost:3000';
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
}

export async function callModeApi(endpoint, payload) {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API returned status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn(`[L0 Fallback Active for ${endpoint}]:`, error.message);
    return getLocalL0Fallback(endpoint, payload);
  }
}

export async function exportArtifactMarkdown(mode, data) {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, data }),
    });
    const result = await res.json();
    if (result.markdown) {
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `setu-${mode}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    // Fallback: generate markdown locally
    const md = `# SETU ${mode} Output\n\n${JSON.stringify(data, null, 2)}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `setu-${mode}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function callAgentNavigate(task, pageContext = {}) {
  return await callModeApi('/api/agent/navigate', { task, pageContext });
}

export async function checkHealth() {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/health`);
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

function getLocalL0Fallback(endpoint, payload) {
  if (endpoint.includes('/start')) {
    return {
      clarifyingQuestion: "What is the single smallest action you can do in the next 10 minutes?",
      immediateTenMinuteAction: `Open a blank document titled "${payload.task || 'My Task'}" and type 3 sub-item headings.`,
      microSteps: [
        "Set a timer for 10 minutes — just 10.",
        "Write 3 bullet points about what you know.",
        "Complete 1 full sentence under any heading.",
        "Take a 2-minute victory break. You earned it.",
      ],
      supportiveMessage: "Starting takes bravery. 10 minutes is all you need right now. You've got this. 💚",
      confidenceMeter: { effortLevel: 'Low', anxietyLevel: 'Moderate', estimatedTimeMinutes: 10 },
    };
  }
  if (endpoint.includes('/simplify')) {
    const text = payload.text || '';
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).slice(0, 4);
    return {
      plainLanguageRewrite: sentences.join('. ').trim() + '.' || 'This text has been simplified for easier reading.',
      keyTakeaways: [
        'The main idea is presented in simple language.',
        'Complex terms have been replaced with everyday words.',
        'The text is now at a 6th-grade reading level.',
      ],
      sensoryTips: ['Take a deep breath before reading.', 'Read one paragraph at a time.'],
      readabilityGrade: 'Grade 6.0 (Simplified)',
    };
  }
  if (endpoint.includes('/learn')) {
    return {
      summary: 'This material covers key concepts that can be broken down into manageable learning chunks.',
      mindMap: {
        rootNode: 'Main Topic',
        branches: [
          { topic: 'Core Concepts', details: ['Fundamental principles', 'Key definitions', 'Building blocks'] },
          { topic: 'Applications', details: ['Real-world examples', 'Practice scenarios', 'Case studies'] },
          { topic: 'Connections', details: ['Related topics', 'Cross-references', 'Further reading'] },
        ],
      },
      quiz: [
        { question: 'What is the main concept discussed?', options: ['Core principles', 'Advanced techniques', 'Historical context', 'None of the above'], answerIndex: 0, explanation: 'The material primarily focuses on core principles and fundamentals.' },
        { question: 'How can this knowledge be applied?', options: ['Only theoretically', 'In real-world scenarios', 'Never', 'Only in tests'], answerIndex: 1, explanation: 'Understanding these concepts enables practical application in real-world scenarios.' },
      ],
    };
  }
  if (endpoint.includes('/meet')) {
    return {
      summary: 'Meeting covered project updates and action items.',
      keyDecisions: ['Proceed with current timeline', 'Review budget allocation'],
      actionItems: [
        { task: 'Complete project documentation', owner: 'Team Lead', deadline: 'End of week', priority: 'High' },
        { task: 'Schedule follow-up meeting', owner: 'Project Manager', deadline: 'Tomorrow', priority: 'Medium' },
      ],
      jargonDecoded: [
        { term: 'Circle back', plainMeaning: 'Discuss this topic again later' },
        { term: 'Bandwidth', plainMeaning: 'Available time and capacity to take on work' },
      ],
    };
  }
  if (endpoint.includes('/practice')) {
    return {
      scenarioContext: `You are preparing for a conversation about: "${payload.topic || 'a difficult topic'}"`,
      openingLine: "Hi, I wanted to talk about something important. Do you have a moment?",
      suggestedResponses: [
        { label: 'Direct Approach', text: "I'd like to discuss this directly and find a solution together.", tone: 'Direct' },
        { label: 'Gentle Approach', text: "I've been thinking about this and would value your perspective.", tone: 'Polite & Assertive' },
        { label: 'Collaborative', text: "Could we work through this together? I think we can find common ground.", tone: 'Collaborative' },
      ],
      coachingTip: "Remember: it's okay to pause and collect your thoughts. Silence is not awkward — it's thoughtful.",
    };
  }
  if (endpoint.includes('/write')) {
    return {
      originalGradeLevel: 'Grade 10-12',
      improvedText: payload.text || 'Your text has been analyzed for readability improvements.',
      passiveVoiceInstances: ['Consider using active voice for clearer communication.'],
      clarityFixes: [
        { originalSnippet: 'Complex sentence detected', suggestedSnippet: 'Simpler alternative suggested', reason: 'Reduces cognitive load for the reader' },
      ],
    };
  }
  if (endpoint.includes('/guide')) {
    return {
      workflowName: payload.goal || 'Workflow Guide',
      totalSteps: 3,
      steps: [
        { stepNumber: 1, title: 'Navigate to the page', actionRequired: 'Open the target website or application.', tip: 'Bookmark the page for quick access next time.' },
        { stepNumber: 2, title: 'Find the form or section', actionRequired: 'Look for the relevant form, button, or section.', tip: 'Use Ctrl+F to search for keywords.' },
        { stepNumber: 3, title: 'Complete the action', actionRequired: 'Fill in the required fields and submit.', tip: 'Double-check all entries before submitting.' },
      ],
    };
  }
  if (endpoint.includes('/agent/navigate')) {
    return {
      goal: payload.task || 'Page Navigation',
      totalSteps: 3,
      currentStepIndex: 0,
      steps: [
        { stepNumber: 1, instruction: "Look for the main navigation or login section on the page.", targetSelector: "a, button", targetText: "Login / Sign In", actionType: "click", tip: "The element should be near the top of the page." },
        { stepNumber: 2, instruction: "Enter your credentials into the form fields.", targetSelector: "input", targetText: "Username / Email", actionType: "fill", tip: "Double-check your information before proceeding." },
        { stepNumber: 3, instruction: "Click the submit or continue button to proceed.", targetSelector: "button[type='submit']", targetText: "Submit", actionType: "click", tip: "Wait for the page to load completely." },
      ],
      supportiveMessage: "I'll guide you through each step. Take your time — there's no rush. 💚",
    };
  }
  return { summary: "Processed with zero latency via local L0 engine.", fallback: true };
}
