/**
 * Decoupled Dynamic API Service Layer for NeuroRead Frontend
 */

function getApiBase() {
  if (typeof window !== 'undefined') {
    return process.env.REACT_APP_API_URL || localStorage.getItem('neuroread_api_url') || 'http://localhost:3000';
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:3000';
}

export async function callModeApi(endpoint, payload) {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }
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
      body: JSON.stringify({ mode, data })
    });
    const result = await res.json();
    if (result.markdown) {
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `neuroread-${mode}.md`;
      a.click();
    }
  } catch (err) {
    alert('Could not export artifact.');
  }
}

export async function callAgentNavigate(task, pageContext = {}) {
  return await callModeApi('/api/agent/navigate', { task, pageContext });
}

function getLocalL0Fallback(endpoint, payload) {
  if (endpoint.includes('/start')) {
    return {
      clarifyingQuestion: "What is the single smallest action you can do in the next 10 minutes?",
      immediateTenMinuteAction: `Open a blank document titled "${payload.task || 'My Task'}" and type 3 sub-item headings.`,
      microSteps: [
        "Step 1: Set a timer for 10 minutes.",
        "Step 2: Write 3 bullet points.",
        "Step 3: Complete 1 sentence.",
        "Step 4: Take a 2-minute break."
      ],
      supportiveMessage: "Starting takes bravery. 10 minutes is all you need right now.",
      confidenceMeter: { effortLevel: 'Low', anxietyLevel: 'Moderate', estimatedTimeMinutes: 10 }
    };
  }
  if (endpoint.includes('/agent/navigate')) {
    return {
      goal: payload.task || 'EPFO Portal Navigation',
      totalSteps: 3,
      currentStepIndex: 0,
      steps: [
        {
          stepNumber: 1,
          instruction: "Click 'Member Passbook / UAN Login' highlighted in green on the portal.",
          targetSelector: "a",
          targetText: "Member Passbook",
          actionType: "click",
          tip: "The element has a green glowing halo ring around it."
        },
        {
          stepNumber: 2,
          instruction: "Enter your 12-digit UAN number and Password into the login form.",
          targetSelector: "input[type='text']",
          targetText: "UAN Field",
          actionType: "fill",
          tip: "Double check your digits before proceeding."
        },
        {
          stepNumber: 3,
          instruction: "Click 'Submit Claim / Check Passbook' to complete your action.",
          targetSelector: "button",
          targetText: "Submit",
          actionType: "click",
          tip: "Your session stays active for 15 minutes."
        }
      ],
      supportiveMessage: "Guiding you step-by-step through your portal task."
    };
  }
  return { summary: "Processed with zero latency via local L0 engine." };
}
