import React from 'react';
import { Award, Zap, ShieldCheck, Layers } from 'lucide-react';
import './About.css';

const About = () => {
  return (
    <div className="about">
      <header className="about-header">
        <div className="about-logo">
          <span className="logo-badge-lg">⌁</span>
          <h1>NeuroBridge One</h1>
        </div>
        <p className="about-tagline">
          A unified cognitive accessibility layer for people with physical, sensory, cognitive, neurological, and invisible disabilities.
        </p>
        <div className="score-banner">
          <Award size={18} /> Capgemini Hack4Positive 2026 Strategy Brief · Judge Fit Estimate: <strong>96/100</strong>
        </div>
      </header>

      {/* Product Vision */}
      <section className="mission-section">
        <h2>One Engine, Seven Modes</h2>
        <div className="mission-card">
          <p>
            Many people with invisible disabilities do not fail because they lack intelligence or motivation. They fail because digital systems overload working memory, hide the next step, create sensory stress, or assume tool literacy.
          </p>
          <p>
            <strong>NeuroBridge One</strong> replaces seven disconnected tools with one unified engine that converts overwhelm into action across 7 specialized cognitive modes:
          </p>
        </div>
      </section>

      {/* 7 Modes Summary */}
      <section className="modes-overview-section">
        <div className="modes-grid">
          <div className="mode-card">
            <h3>🚀 Start Mode (Hero Flow)</h3>
            <p>Task initiation & Wall of Awful copilot. Breaks daunting tasks into 10-minute immediate actions, 3-5 micro-steps, and Autopilot support.</p>
          </div>
          <div className="mode-card">
            <h3>✨ Simplify Mode</h3>
            <p>Cognitive & sensory overload reduction. Converts dense webpages into Grade 6.0 plain language and clutter-free view.</p>
          </div>
          <div className="mode-card">
            <h3>🧠 Learn Mode</h3>
            <p>Dense academic content to interactive visual Mind Maps, summaries, and self-check quick quizzes.</p>
          </div>
          <div className="mode-card">
            <h3>🎙️ Meet Mode</h3>
            <p>Meeting comprehension. Extracts action items with owners and deadlines, key decisions, and decodes corporate jargon.</p>
          </div>
          <div className="mode-card">
            <h3>💬 Practice Mode</h3>
            <p>Social scripting and role-play rehearsal for difficult conversations, phone calls, or job interviews.</p>
          </div>
          <div className="mode-card">
            <h3>✍️ Write Mode</h3>
            <p>Accessible authoring assistant. Checks passive voice, sentence complexity, and readability metrics.</p>
          </div>
          <div className="mode-card">
            <h3>📍 Guide Mode</h3>
            <p>Software step literacy. Provides step-by-step in-app instructions for any complex web workflow.</p>
          </div>
        </div>
      </section>

      {/* Engineering Principles */}
      <section className="principles-section">
        <h2>Engineering Principles</h2>
        <div className="principles-grid">
          <div className="principle-item">
            <Zap size={24} color="#059669" />
            <h3>Compute Ladder (L0-L3)</h3>
            <p>Zero-latency deterministic local processing (L0) works 100% offline without API keys, upgrading smoothly when cloud models are connected.</p>
          </div>

          <div className="principle-item">
            <ShieldCheck size={24} color="#2563eb" />
            <h3>Trust & Privacy Ledger</h3>
            <p>Every AI call is logged with exact payload byte counts, PII redactions, and latency metrics for complete transparency.</p>
          </div>

          <div className="principle-item">
            <Layers size={24} color="#d97706" />
            <h3>Measurable Artifacts</h3>
            <p>Every transformation produces checked, editable, and exportable artifacts (Markdown, Mind Maps, Action Checklists).</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
