import React, { useState } from 'react';
import { callModeApi } from '../../services/apiService';

const GuideModePane = () => {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputGoal = goal.trim() || "Submit an expense claim on company portal";
    setLoading(true);
    const data = await callModeApi('/api/guide', { goal: inputGoal });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2>📍 Guide Mode: Software Step Literacy</h2>
      <p className="pane-desc">Creates clear, step-by-step instructions for digital workflows or online forms.</p>

      <input 
        type="text"
        className="nb-main-input"
        placeholder="Workflow goal (e.g. Reset password on student portal)"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        {loading ? 'Generating guide...' : '📍 Build Step Guide'}
      </button>

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
