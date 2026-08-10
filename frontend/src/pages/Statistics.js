import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Activity, 
  Clock, 
  Lock, 
  Zap,
  BarChart2,
  FileCheck
} from 'lucide-react';
import './Statistics.css';

const Statistics = () => {
  const [ledgerLogs] = useState([
    { id: 1, mode: 'Start Mode', rung: 'L0 (Deterministic Offline)', latency: '0 ms', bytesSent: 0, piiRedacted: 0, time: '2 mins ago' },
    { id: 2, mode: 'Simplify Mode', rung: 'L0 (Deterministic Offline)', latency: '12 ms', bytesSent: 0, piiRedacted: 2, time: '14 mins ago' },
    { id: 3, mode: 'Learn MindMap', rung: 'L2 (Cloud Flash Gemini)', latency: '1.2 s', bytesSent: 420, piiRedacted: 1, time: '1 hour ago' },
    { id: 4, mode: 'Meet Action Items', rung: 'L0 (Deterministic Offline)', latency: '4 ms', bytesSent: 0, piiRedacted: 0, time: '3 hours ago' }
  ]);

  return (
    <div className="statistics">
      <header className="statistics-header">
        <h1>Trust & Cognitive Load Ledger</h1>
        <p>Complete transparency into every AI call, compute rung, latency, and PII redactions.</p>
      </header>

      {/* Overview Cards */}
      <section className="overview-section">
        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">
              <Activity size={24} color="#2563eb" />
            </div>
            <div className="overview-info">
              <span className="overview-value">45 → 3</span>
              <span className="overview-label">Cognitive Load Score</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon">
              <Cpu size={24} color="#059669" />
            </div>
            <div className="overview-info">
              <span className="overview-value">75%</span>
              <span className="overview-label">L0 Offline Rung Executions</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon">
              <Lock size={24} color="#d97706" />
            </div>
            <div className="overview-info">
              <span className="overview-value">100%</span>
              <span className="overview-label">Local PII Redaction Rate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Compute Ladder Breakdown */}
      <section className="ladder-section">
        <h2>🪜 The Compute Ladder</h2>
        <div className="ladder-grid">
          <div className="ladder-card active">
            <div className="rung-tag l0">L0 Deterministic</div>
            <h3>0 ms · ₹0 · Offline</h3>
            <p>Runs locally in the browser with zero network requests. PII private by construction.</p>
          </div>
          <div className="ladder-card">
            <div className="rung-tag l1">L1 On-Device Model</div>
            <h3>~300 ms · ₹0 · Offline</h3>
            <p>Chrome Prompt API / Built-in model execution where available.</p>
          </div>
          <div className="ladder-card">
            <div className="rung-tag l2">L2 Cloud Flash</div>
            <h3>~1–2 s · Needs Consent</h3>
            <p>Structured Gemini/OpenAI call with strict JSON response schemas.</p>
          </div>
        </div>
      </section>

      {/* Trust Ledger Audit Table */}
      <section className="ledger-table-section">
        <h2>🛡️ Real-Time Audit Log (Trust Ledger)</h2>
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Mode</th>
              <th>Compute Rung</th>
              <th>Latency</th>
              <th>Network Outflow</th>
              <th>PII Redacted</th>
            </tr>
          </thead>
          <tbody>
            {ledgerLogs.map(log => (
              <tr key={log.id}>
                <td>{log.time}</td>
                <td><strong>{log.mode}</strong></td>
                <td><span className="rung-pill">{log.rung}</span></td>
                <td>{log.latency}</td>
                <td>{log.bytesSent} bytes</td>
                <td><span className="pii-tag">{log.piiRedacted} items</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Statistics;
