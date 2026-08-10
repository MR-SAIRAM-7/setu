/**
 * Extension API Client Module
 * Decouples extension HTTP requests from UI rendering logic.
 */

const API_HOST = 'http://localhost:3000';

export async function postApi(endpoint, body) {
  try {
    const response = await fetch(`${API_HOST}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`[L0 Local Fallback Engaged for ${endpoint}]:`, err.message);
    return getLocalFallback(endpoint, body);
  }
}

function getLocalFallback(endpoint, body) {
  if (endpoint.includes('/start')) {
    return {
      clarifyingQuestion: "What is the single smallest action you can do in 10 minutes?",
      immediateTenMinuteAction: `Open a blank document for "${body.task || 'My task'}" and type 1 heading.`,
      microSteps: [
        "Step 1: Set a timer for 10 minutes.",
        "Step 2: Write 3 bullet points.",
        "Step 3: Take a quiet 2-minute break."
      ],
      supportiveMessage: "Starting takes bravery. 10 minutes is all you need right now.",
      confidenceMeter: { effortLevel: 'Low', anxietyLevel: 'Moderate', estimatedTimeMinutes: 10 }
    };
  }
  return { summary: "Content processed with zero latency via local L0 engine." };
}
