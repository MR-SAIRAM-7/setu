import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Download } from 'lucide-react';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';

const SimplifyModePane = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputText = text.trim() || "Dense digital interfaces impose cognitive load exceeding working memory.";
    setLoading(true);
    const data = await callModeApi('/api/simplify', { text: inputText });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2><Sparkles size={22} style={{ display: 'inline', marginRight: 8 }} /> Simplify Mode: Plain Language &amp; Clutter Reduction</h2>
      <p className="pane-desc">Converts complex text, dense notices, or convoluted web pages into Grade 6.0 plain language.</p>

      <textarea 
        className="nb-main-textarea"
        placeholder="Paste dense text or webpage content here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        <Sparkles size={16} style={{ display: 'inline', marginRight: 6 }} />
        {loading ? 'Simplifying...' : 'Transform Text'}
      </button>

      {result && (
        <div className="artifact-card fade-in">
          <div className="card-top-bar">
            <span className="grade-pill">{result.readabilityGrade}</span>
            <button className="export-link-btn" onClick={() => exportArtifactMarkdown('simplify', result)}>
              <Download size={16} /> Export Markdown
            </button>
          </div>

          <div className="simplified-body">
            <h3>Plain Language Version:</h3>
            <p>{result.plainLanguageRewrite}</p>
          </div>

          <div className="takeaways-list">
            <h3>Key Takeaways:</h3>
            <ul>
              {(result.keyTakeaways || []).map((point, idx) => (
                <li key={idx}><CheckCircle2 size={16} color="#2563eb" style={{ display: 'inline', marginRight: 6 }} /> {point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimplifyModePane;
