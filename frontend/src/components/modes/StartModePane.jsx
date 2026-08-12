import React, { useState } from 'react';
import { Rocket, Zap, Target, Clock, HelpCircle, CheckCircle2, Download } from 'lucide-react';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';

const StartModePane = () => {
  const [task, setTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async (isStuck = false) => {
    const inputTask = task.trim() || (isStuck ? "Overcoming task freeze" : "Plan my project");
    setLoading(true);
    const data = await callModeApi('/api/start', { task: inputTask, isStuck });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <div className="pane-header-box">
        <h2><Rocket size={22} style={{ display: 'inline', marginRight: 8 }} /> Start Mode: Wall of Awful Copilot</h2>
        <button className="autopilot-pulse-btn" onClick={() => handleRun(true)}>
          <Zap size={14} style={{ display: 'inline', marginRight: 4 }} /> I am stuck! (Autopilot)
        </button>
      </div>
      <p className="pane-desc">
        When a daunting task freezes your initiation capacity, NeuroRead breaks it down into one 10-minute action and tiny micro-steps.
      </p>

      <div className="input-group">
        <input 
          type="text" 
          className="nb-main-input"
          placeholder="What task are you avoiding right now? (e.g. Write final project documentation)"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <button className="nb-action-btn primary" onClick={() => handleRun(false)} disabled={loading}>
          {loading ? 'Analyzing task...' : 'Get First Action'}
        </button>
      </div>

      {result && (
        <div className="artifact-card fade-in">
          <div className="card-top-bar">
            <h3><Target size={18} style={{ display: 'inline', marginRight: 6 }} /> Starting Action Plan</h3>
            <button className="export-link-btn" onClick={() => exportArtifactMarkdown('start', result)}>
              <Download size={16} /> Export Markdown
            </button>
          </div>

          <div className="confidence-meter-row">
            <span className="meter-badge effort">Effort: {result.confidenceMeter?.effortLevel}</span>
            <span className="meter-badge anxiety">Anxiety: {result.confidenceMeter?.anxietyLevel}</span>
            <span className="meter-badge time">
              <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
              {result.confidenceMeter?.estimatedTimeMinutes} Minutes
            </span>
          </div>

          <blockquote className="supportive-quote">
            "{result.supportiveMessage}"
          </blockquote>

          <div className="clarifying-q-box">
            <HelpCircle size={20} color="#2563eb" />
            <div>
              <strong>Clarifying Question:</strong>
              <p>{result.clarifyingQuestion}</p>
            </div>
          </div>

          <div className="ten-min-box">
            <div className="ten-min-header">
              <Clock size={20} color="#059669" />
              <strong>Immediate 10-Minute Action Path:</strong>
            </div>
            <p className="ten-min-text">{result.immediateTenMinuteAction}</p>
            <button className="start-timer-btn" onClick={() => alert("10-minute timer started! Take it step by step.")}>
              <Clock size={14} style={{ display: 'inline', marginRight: 4 }} /> Launch 10-Min Focus Session
            </button>
          </div>

          <div className="micro-steps-box">
            <h4>Next Micro-Steps:</h4>
            <ul>
              {(result.microSteps || []).map((step, idx) => (
                <li key={idx}><CheckCircle2 size={16} color="#2563eb" /> {step}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StartModePane;
