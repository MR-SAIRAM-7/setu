import React, { useState } from 'react';
import { callModeApi } from '../../services/apiService';

const WriteModePane = () => {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputDraft = draft.trim() || "The documentation was updated by the engineering team.";
    setLoading(true);
    const data = await callModeApi('/api/write', { text: inputDraft });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2>✍️ Write Mode: Accessible Authoring Assistant</h2>
      <p className="pane-desc">Checks draft text for passive voice, sentence complexity, and readability.</p>

      <textarea 
        className="nb-main-textarea"
        placeholder="Type or paste draft document..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        {loading ? 'Analyzing...' : '✍️ Check Readability'}
      </button>

      {result && (
        <div className="artifact-card fade-in">
          <div className="grade-header-row">
            <span>Readability Level: <strong>{result.originalGradeLevel}</strong></span>
          </div>

          <div className="improved-text-box">
            <h3>Plain-Language Rewrite:</h3>
            <p>{result.improvedText}</p>
          </div>

          <div className="fixes-list">
            <h3>Specific Line Adjustments:</h3>
            {(result.clarityFixes || []).map((fix, idx) => (
              <div key={idx} className="fix-item">
                <div>Original: <s>{fix.originalSnippet}</s></div>
                <div>Suggested: <strong>{fix.suggestedSnippet}</strong></div>
                <small>Reason: {fix.reason}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WriteModePane;
