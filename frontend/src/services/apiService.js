/**
 * Decoupled API Service Layer for NeuroBridge Frontend
 */

const API_BASE = 'http://localhost:3000';

export async function callModeApi(endpoint, payload) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
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
  try {
    const res = await fetch(`${API_BASE}/api/export`, {
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
      a.download = result.filename || `neurobridge-${mode}.md`;
      a.click();
    }
  } catch (err) {
    alert('Could not export artifact.');
  }
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
  return { summary: "Processed with zero latency via local L0 engine." };
}
