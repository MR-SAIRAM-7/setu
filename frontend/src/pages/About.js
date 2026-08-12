import React from 'react';
import { Award, Zap, ShieldCheck, Layers, Brain, Rocket, Sparkles, Mic, MessageSquare, Edit3, Compass } from 'lucide-react';
import './About.css';

const About = () => {
  return (
    <div className="about">
      <header className="about-header">
        <div className="about-logo">
          <div className="logo-badge-lg" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: '#6366f1', color: 'white', borderRadius: 12, marginRight: 12 }}>
            <Brain size={24} />
          </div>
          <h1>NeuroRead</h1>
        </div>
        <p className="about-tagline">
          A unified cognitive accessibility layer making the web accessible for ADHD and Dyslexic minds.
        </p>
        <div className="score-banner">
          <Award size={18} /> Infinity Hackathon 2026 Strategy Brief · Problem Statement 01: NeuroInclusive Tech
        </div>
      </header>

      {/* Product Vision */}
      <section className="mission-section">
        <h2>One Engine, Seven Modes</h2>
        <div className="mission-card">
          <p>
            Neurodivergent individuals do not fail because they lack intelligence or motivation. They struggle because standard digital systems overflow working memory, obscure immediate next steps, trigger visual crowding, or create sensory strain.
          </p>
          <p>
            <strong>NeuroRead</strong> replaces fragmented single-purpose plugins with one unified suite that transforms digital content across 7 specialized cognitive modes:
          </p>
        </div>
      </section>

      {/* 7 Modes Summary */}
      <section className="modes-overview-section">
        <div className="modes-grid">
          <div className="mode-card">
            <h3><Rocket size={18} style={{ display: 'inline', marginRight: 6 }} /> Start Mode (Hero Flow)</h3>
            <p>Task initiation &amp; Wall of Awful copilot. Breaks daunting tasks into 10-minute immediate actions, 3-5 micro-steps, and Autopilot support.</p>
          </div>
          <div className="mode-card">
            <h3><Sparkles size={18} style={{ display: 'inline', marginRight: 6 }} /> Simplify Mode</h3>
            <p>Cognitive &amp; sensory overload reduction. Converts dense webpages into Grade 6.0 plain language and clutter-free view.</p>
          </div>
          <div className="mode-card">
            <h3><Brain size={18} style={{ display: 'inline', marginRight: 6 }} /> Learn Mode</h3>
            <p>Dense academic content to interactive visual Mind Maps, summaries, and self-check quick quizzes.</p>
          </div>
          <div className="mode-card">
            <h3><Mic size={18} style={{ display: 'inline', marginRight: 6 }} /> Meet Mode</h3>
            <p>Meeting comprehension. Extracts action items with owners and deadlines, key decisions, and decodes corporate jargon.</p>
          </div>
          <div className="mode-card">
            <h3><MessageSquare size={18} style={{ display: 'inline', marginRight: 6 }} /> Practice Mode</h3>
            <p>Social scripting and role-play rehearsal for difficult conversations, phone calls, or job interviews.</p>
          </div>
          <div className="mode-card">
            <h3><Edit3 size={18} style={{ display: 'inline', marginRight: 6 }} /> Write Mode</h3>
            <p>Accessible authoring assistant. Checks passive voice, sentence complexity, and readability metrics.</p>
          </div>
          <div className="mode-card">
            <h3><Compass size={18} style={{ display: 'inline', marginRight: 6 }} /> Guide Mode</h3>
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
            <p>Zero-latency deterministic local processing (L0) works 100% offline without API keys, upgrading smoothly when cloud AI models are connected.</p>
          </div>

          <div className="principle-item">
            <ShieldCheck size={24} color="#2563eb" />
            <h3>Trust &amp; Privacy Ledger</h3>
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
