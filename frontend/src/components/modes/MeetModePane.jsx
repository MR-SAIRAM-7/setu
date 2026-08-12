import React, { useState } from 'react';
import { Mic, Download } from 'lucide-react';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';

const MeetModePane = () => {
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    const inputTranscript = transcript.trim() || "Meeting: Sarah will lead deployment by Friday. Alex double checks security.";
    setLoading(true);
    const data = await callModeApi('/api/meet', { transcript: inputTranscript });
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="mode-pane">
      <h2><Mic size={22} style={{ display: 'inline', marginRight: 8 }} /> Meet Mode: Transcript to Action Items &amp; Owners</h2>
      <p className="pane-desc">Extracts decisions, owner-assigned deadlines, and decodes corporate jargon from meeting transcripts.</p>

      <textarea 
        className="nb-main-textarea"
        placeholder="Paste raw meeting transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />
      <button className="nb-action-btn primary" onClick={handleRun} disabled={loading}>
        <Mic size={16} style={{ display: 'inline', marginRight: 6 }} />
        {loading ? 'Processing...' : 'Extract Action Items'}
      </button>

      {result && (
        <div className="artifact-card fade-in">
          <div className="card-top-bar">
            <h3>Action Items &amp; Assigned Owners</h3>
            <button className="export-link-btn" onClick={() => exportArtifactMarkdown('meet', result)}>
              <Download size={16} /> Export Summary
            </button>
          </div>

          <table className="actions-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Owner</th>
                <th>Deadline</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {(result.actionItems || []).map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.task}</strong></td>
                  <td>{item.owner}</td>
                  <td>{item.deadline}</td>
                  <td><span className={`priority-tag ${item.priority?.toLowerCase()}`}>{item.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="jargon-box">
            <h3>Corporate Jargon Decoded</h3>
            {(result.jargonDecoded || []).map((j, idx) => (
              <div key={idx} className="jargon-item">
                <strong>{j.term}:</strong> <span>{j.plainMeaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetModePane;
