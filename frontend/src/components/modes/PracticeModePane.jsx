import React, { useState } from 'react';
import { callModeApi } from '../../services/apiService';

const PracticeModePane = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputTopic = topic.trim() || "Asking manager for deadline extension";
    setLoading(true);
    const data = await callModeApi('/api/practice', { topic: inputTopic });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2>💬 Practice Mode: Social Scripting Rehearsal</h2>
      <p className="pane-desc">Rehearse challenging conversations, interviews, or phone calls with adaptive dialogue choices.</p>

      <input 
        type="text"
        className="nb-main-input"
        placeholder="Scenario topic (e.g. Asking landlord for repair update)"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        {loading ? 'Setting up rehearsal...' : '💬 Start Rehearsal'}
      </button>

      {result && (
        <div className="artifact-card fade-in">
          <blockquote className="roleplay-opening">
            {result.openingLine}
          </blockquote>

          <h3>Suggested Script Responses:</h3>
          <div className="responses-grid">
            {(result.suggestedResponses || []).map((r, idx) => (
              <div key={idx} className="response-card" onClick={() => alert(`You selected response: "${r.text}"\nGreat practice!`)}>
                <span className="tone-badge">{r.tone}</span>
                <p>"{r.text}"</p>
              </div>
            ))}
          </div>

          <div className="coaching-banner">
            💡 <strong>Coaching Tip:</strong> {result.coachingTip}
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeModePane;
