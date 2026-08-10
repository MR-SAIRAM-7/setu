import React, { useState } from 'react';
import { Bot, Volume2, Target } from 'lucide-react';
import { callModeApi, callAgentNavigate } from '../../services/apiService';

const GuideModePane = () => {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [agentPlan, setAgentPlan] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const handleRunGuide = async () => {
    const inputGoal = goal.trim() || "Apply for EPFO Member Passbook";
    setLoading(true);
    const data = await callModeApi('/api/guide', { goal: inputGoal });
    setResult(data);
    setLoading(false);
  };

  const handleRunAgent = async () => {
    const inputGoal = goal.trim() || "Apply for EPFO Member Passbook";
    setLoading(true);
    const plan = await callAgentNavigate(inputGoal, {
      title: "EPFO Member Unified Portal",
      controls: [
        { label: "Member Passbook Login", type: "a", selector: "a#passbook-login" },
        { label: "UAN / Member ID Input", type: "input", selector: "input#uan-field" },
        { label: "Submit Claim", type: "button", selector: "button#submit-btn" }
      ]
    });
    setAgentPlan(plan);
    setCurrentStepIdx(0);
    setLoading(false);
  };

  const speakStep = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="mode-pane">
      <h2>📍 Guide & In-Page Autonomous AI Agent Navigator</h2>
      <p className="pane-desc">
        Simplifies heavy, clumsy portals (e.g. EPFO, GST, banking, university sites) for ADHD & Dyslexia minds by parsing DOM code and guiding you step-by-step.
      </p>

      <div className="input-group">
        <input 
          type="text"
          className="nb-main-input"
          placeholder="What task do you want to perform? (e.g. Apply for EPFO, File return, Login to portal)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <button className="nb-action-btn primary" onClick={handleRunAgent} disabled={loading}>
          <Bot size={18} /> {loading ? 'Analyzing Portal...' : '🤖 Launch AI Agent Navigator'}
        </button>
        <button className="nb-action-btn secondary" onClick={handleRunGuide} disabled={loading} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
          📍 Basic Step Guide
        </button>
      </div>

      {/* Autonomous Agent Simulation Experience */}
      {agentPlan && (
        <div className="artifact-card fade-in" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <div className="card-top-bar">
            <h3>🤖 AI Agent Active Navigation Plan: {agentPlan.goal}</h3>
            <span className="meter-badge time">Step {currentStepIdx + 1} of {agentPlan.steps?.length}</span>
          </div>

          <blockquote className="supportive-quote">
            "{agentPlan.supportiveMessage}"
          </blockquote>

          {agentPlan.steps?.[currentStepIdx] && (
            <div className="ten-min-box">
              <div className="ten-min-header">
                <Target size={20} color="#059669" />
                <strong>Current Step {agentPlan.steps[currentStepIdx].stepNumber}:</strong>
              </div>
              <p className="ten-min-text" style={{ fontSize: '15px', fontWeight: '700' }}>
                {agentPlan.steps[currentStepIdx].instruction}
              </p>
              <small style={{ color: 'var(--text-secondary)' }}>
                💡 {agentPlan.steps[currentStepIdx].tip}
              </small>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button 
                  className="start-timer-btn"
                  onClick={() => speakStep(agentPlan.steps[currentStepIdx].instruction)}
                  style={{ background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Volume2 size={16} /> Read Step Aloud
                </button>
                <button 
                  className="start-timer-btn"
                  onClick={() => alert(`Highlighting element "${agentPlan.steps[currentStepIdx].targetText}" with a green glowing halo on screen!`)}
                >
                  🎯 Highlight Target Element
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button 
              className="export-link-btn"
              disabled={currentStepIdx === 0}
              onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
            >
              ← Previous Step
            </button>
            <button 
              className="start-timer-btn"
              onClick={() => {
                if (currentStepIdx < agentPlan.steps.length - 1) {
                  setCurrentStepIdx(prev => prev + 1);
                } else {
                  alert("🎉 Task complete! You successfully navigated the portal.");
                }
              }}
            >
              {currentStepIdx < agentPlan.steps.length - 1 ? 'Next Step →' : 'Finish Task ✓'}
            </button>
          </div>
        </div>
      )}

      {/* Basic Step Guide */}
      {result && (
        <div className="artifact-card fade-in">
          <h3>Workflow: {result.workflowName}</h3>
          <div className="guide-steps-list">
            {(result.steps || []).map((s) => (
              <div key={s.stepNumber} className="step-card">
                <div className="step-num">Step {s.stepNumber}</div>
                <div className="step-info">
                  <h4>{s.title}</h4>
                  <p>{s.actionRequired}</p>
                  <small>💡 {s.tip}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuideModePane;
