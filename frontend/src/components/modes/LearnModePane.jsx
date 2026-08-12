import React, { useState } from 'react';
import { Brain, Compass, BookOpen, Download } from 'lucide-react';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';

const LearnModePane = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputText = text.trim() || "Neural plasticity is the ability of the brain to change throughout life.";
    setLoading(true);
    const data = await callModeApi('/api/learn', { text: inputText });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2><Brain size={22} style={{ display: 'inline', marginRight: 8 }} /> Learn Mode: Mind Map &amp; Quiz Generator</h2>
      <p className="pane-desc">Transforms dense academic text or articles into an interactive Visual Mind Map and Quick Quiz.</p>

      <textarea 
        className="nb-main-textarea"
        placeholder="Paste educational material or paper snippet here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        <Brain size={16} style={{ display: 'inline', marginRight: 6 }} />
        {loading ? 'Processing...' : 'Generate Mind Map'}
      </button>

      {result && (
        <div className="artifact-card fade-in">
          <div className="card-top-bar">
            <h3>Visual Mind Map Structure</h3>
            <button className="export-link-btn" onClick={() => exportArtifactMarkdown('learn', result)}>
              <Download size={16} /> Export Mind Map
            </button>
          </div>

          <div className="mindmap-root-node">
            <Compass size={16} style={{ display: 'inline', marginRight: 6 }} />
            Root: <strong>{result.mindMap?.rootNode}</strong>
          </div>

          <div className="mindmap-tree-grid">
            {(result.mindMap?.branches || []).map((b, idx) => (
              <div key={idx} className="mindmap-branch-card">
                <h4><BookOpen size={16} style={{ display: 'inline', marginRight: 6 }} /> {b.topic}</h4>
                <ul>
                  {b.details.map((d, dIdx) => (
                    <li key={dIdx}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="quiz-section">
            <h3>Self-Check Quiz</h3>
            {(result.quiz || []).map((q, idx) => (
              <div key={idx} className="quiz-card">
                <p><strong>Q{idx + 1}: {q.question}</strong></p>
                <div className="quiz-options-list">
                  {q.options.map((opt, oIdx) => (
                    <button 
                      key={oIdx} 
                      className="quiz-opt-btn"
                      onClick={() => {
                        if (oIdx === q.answerIndex) {
                          alert(`Correct! ${q.explanation}`);
                        } else {
                          alert(`Try again! ${q.explanation}`);
                        }
                      }}
                    >
                      {oIdx + 1}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnModePane;
