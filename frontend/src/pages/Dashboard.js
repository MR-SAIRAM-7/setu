import React, { useState } from 'react';
import { 
  Rocket, 
  Sparkles, 
  Brain, 
  Mic, 
  MessageSquare, 
  Edit3, 
  Compass, 
  Download, 
  Zap, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle,
  Share2,
  FileText
} from 'lucide-react';
import './Dashboard.css';

const API_BASE = 'http://localhost:3000';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('start');
  const [loading, setLoading] = useState(false);

  // Mode 1: Start State
  const [startTask, setStartTask] = useState('');
  const [startResult, setStartResult] = useState(null);

  // Mode 2: Simplify State
  const [simplifyText, setSimplifyText] = useState('');
  const [simplifyResult, setSimplifyResult] = useState(null);

  // Mode 3: Learn State
  const [learnText, setLearnText] = useState('');
  const [learnResult, setLearnResult] = useState(null);

  // Mode 4: Meet State
  const [meetTranscript, setMeetTranscript] = useState('');
  const [meetResult, setMeetResult] = useState(null);

  // Mode 5: Practice State
  const [practiceTopic, setPracticeTopic] = useState('');
  const [practiceResult, setPracticeResult] = useState(null);

  // Mode 6: Write State
  const [writeDraft, setWriteDraft] = useState('');
  const [writeResult, setWriteResult] = useState(null);

  // Mode 7: Guide State
  const [guideGoal, setGuideGoal] = useState('');
  const [guideResult, setGuideResult] = useState(null);

  // 1. RUN START MODE
  const handleRunStart = async (isStuck = false) => {
    const task = startTask.trim() || (isStuck ? "Overcoming task freeze / anxiety" : "Plan my final year project");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, isStuck })
      });
      const data = await res.json();
      setStartResult(data);
    } catch (err) {
      console.warn("Using local L0 fallback for Start mode");
      setStartResult({
        clarifyingQuestion: "What is the single smallest action you can do in the next 10 minutes?",
        immediateTenMinuteAction: `Open a blank document titled "${task}" and type down 3 initial heading ideas.`,
        microSteps: [
          "Step 1: Set a timer for 10 minutes (no pressure to finish).",
          "Step 2: Note down 3 main sub-topics.",
          "Step 3: Complete just 1 sentence.",
          "Step 4: Take a 2-minute breath break."
        ],
        supportiveMessage: "Starting is the hardest part. You don't have to finish today — just give yourself 10 quiet minutes.",
        confidenceMeter: { effortLevel: 'Low', anxietyLevel: 'Moderate', estimatedTimeMinutes: 10 }
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. RUN SIMPLIFY MODE
  const handleRunSimplify = async () => {
    const text = simplifyText.trim() || "Dense digital interfaces impose cognitive load exceeding working memory.";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/simplify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setSimplifyResult(data);
    } catch (err) {
      setSimplifyResult({
        plainLanguageRewrite: "In plain terms: Dense websites make reading exhausting for brains with ADHD or Dyslexia. Simplifying text removes unnecessary clutter.",
        keyTakeaways: ["Dense text overloads working memory.", "Plain language makes reading 3x faster.", "Sensory themes prevent eye strain."],
        sensoryTips: ["Turn on Sensory Calm mode", "Use Bionic Reading visual anchors"],
        readabilityGrade: "Grade 6.0 Plain Language"
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. RUN LEARN MODE
  const handleRunLearn = async () => {
    const text = learnText.trim() || "Neural plasticity is the ability of the brain to change throughout an individual's life. It allows neurons in the brain to compensate for injury and disease and to adjust their activities in response to new situations or to changes in their environment.";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setLearnResult(data);
    } catch (err) {
      setLearnResult({
        summary: "Neural plasticity allows the brain to reorganize itself by forming new neural connections throughout life.",
        mindMap: {
          rootNode: "Neural Plasticity",
          branches: [
            { topic: "Core Function", details: ["Brain reorganization", "Forming new connections"] },
            { topic: "Benefits", details: ["Compensates for injury", "Adapts to new environments"] }
          ]
        },
        quiz: [
          {
            question: "What is neural plasticity?",
            options: ["The brain's ability to adapt and form new connections", "A permanent fixed brain state", "A type of muscle tissue"],
            answerIndex: 0,
            explanation: "Neural plasticity describes how neurons adapt and rewire."
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // 4. RUN MEET MODE
  const handleRunMeet = async () => {
    const transcript = meetTranscript.trim() || "Meeting: Sarah will lead the backend deployment by Friday. Alex needs to double-check CORS configurations and report back tomorrow morning.";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const data = await res.json();
      setMeetResult(data);
    } catch (err) {
      setMeetResult({
        summary: "Meeting focused on backend deployment timelines and CORS configuration checks.",
        keyDecisions: ["Sarah leads backend deployment", "Alex handles security checks"],
        actionItems: [
          { task: "Lead backend deployment", owner: "Sarah", deadline: "Friday", priority: "High" },
          { task: "Check CORS configuration", owner: "Alex", deadline: "Tomorrow morning", priority: "Medium" }
        ],
        jargonDecoded: [
          { term: "CORS", plainMeaning: "Cross-Origin Resource Sharing (web security rule)" }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // 5. RUN PRACTICE MODE
  const handleRunPractice = async () => {
    const topic = practiceTopic.trim() || "Asking manager for deadline extension on report";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      setPracticeResult(data);
    } catch (err) {
      setPracticeResult({
        scenarioContext: `Rehearsal: ${topic}`,
        openingLine: `Manager: "Hi! I saw your note about the project timeline. What did you want to discuss?"`,
        suggestedResponses: [
          { label: "Direct & Clear", text: "Hi! I wanted to check if we could extend the report deadline by two days so I can finish thorough testing.", tone: "Direct" },
          { label: "Collaborative", text: "Thanks for making time. I have completed 80% of the report and would appreciate 48 extra hours to polish the remaining sections.", tone: "Collaborative" }
        ],
        coachingTip: "Take a deep breath. Stating your progress before asking for extra time builds confidence."
      });
    } finally {
      setLoading(false);
    }
  };

  // 6. RUN WRITE MODE
  const handleRunWrite = async () => {
    const text = writeDraft.trim() || "The documentation was updated by the engineering team after several issues were identified by testing.";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setWriteResult(data);
    } catch (err) {
      setWriteResult({
        originalGradeLevel: "Grade 11.4",
        improvedText: "The engineering team updated the documentation after testing identified issues.",
        passiveVoiceInstances: ["was updated", "were identified"],
        clarityFixes: [
          { originalSnippet: "was updated by the engineering team", suggestedSnippet: "The engineering team updated", reason: "Active voice makes sentences easier to parse." }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // 7. RUN GUIDE MODE
  const handleRunGuide = async () => {
    const goal = guideGoal.trim() || "Submit an expense claim on company portal";
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal })
      });
      const data = await res.json();
      setGuideResult(data);
    } catch (err) {
      setGuideResult({
        workflowName: goal,
        totalSteps: 3,
        steps: [
          { stepNumber: 1, title: "Open Expense Tab", actionRequired: "Click on 'My Claims' in the left navigation menu.", tip: "It has a small dollar sign icon next to it." },
          { stepNumber: 2, title: "Attach Receipt File", actionRequired: "Click 'Upload Receipt' and choose your receipt image/PDF.", tip: "Ensure file size is under 5 MB." },
          { stepNumber: 3, title: "Click Submit", actionRequired: "Review total amount and press 'Submit Claim'.", tip: "You will receive an instant email receipt." }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // EXPORT MARKDOWN ARTIFACT
  const handleExport = async (mode, data) => {
    if (!data) return;
    try {
      const res = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data })
      });
      const result = await res.json();
      if (result.markdown) {
        const blob = new Blob([result.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `neurobridge-${mode}.md`;
        a.click();
      }
    } catch (e) {
      alert("Could not export artifact.");
    }
  };

  const tabs = [
    { id: 'start', label: 'Start Mode', icon: Rocket, badge: 'Hero Flow' },
    { id: 'simplify', label: 'Simplify Mode', icon: Sparkles },
    { id: 'learn', label: 'Learn Mode', icon: Brain },
    { id: 'meet', label: 'Meet Mode', icon: Mic },
    { id: 'practice', label: 'Practice Mode', icon: MessageSquare },
    { id: 'write', label: 'Write Mode', icon: Edit3 },
    { id: 'guide', label: 'Guide Mode', icon: Compass },
  ];

  return (
    <div className="nb-workspace">
      {/* Workspace Header Banner */}
      <header className="workspace-header">
        <div>
          <h1>Unified Cognitive Accessibility Workspace</h1>
          <p>Transform overwhelm into concrete next actions across 7 specialized cognitive modes.</p>
        </div>
      </header>

      {/* Tab Navigation Grid */}
      <div className="mode-tabs-grid">
        {tabs.map(t => (
          <button 
            key={t.id}
            className={`mode-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={18} />
            <span>{t.label}</span>
            {t.badge && <span className="hero-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* MODE CONTENTS */}
      <div className="workspace-content-container">

        {/* 1. START MODE (WALL OF AWFUL) */}
        {activeTab === 'start' && (
          <div className="mode-pane">
            <div className="pane-header-box">
              <h2>🚀 Start Mode: Wall of Awful Copilot</h2>
              <button className="autopilot-pulse-btn" onClick={() => handleRunStart(true)}>
                ⚡ I am stuck! (Autopilot)
              </button>
            </div>
            <p className="pane-desc">
              When a daunting task freezes your initiation capacity, NeuroBridge One breaks it down into one 10-minute action and tiny micro-steps.
            </p>

            <div className="input-group">
              <input 
                type="text" 
                className="nb-main-input"
                placeholder="What task are you avoiding right now? (e.g. Write final project documentation)"
                value={startTask}
                onChange={(e) => setStartTask(e.target.value)}
              />
              <button className="nb-action-btn primary" onClick={() => handleRunStart(false)} disabled={loading}>
                {loading ? 'Analyzing task...' : 'Get First Action'}
              </button>
            </div>

            {startResult && (
              <div className="artifact-card fade-in">
                <div className="card-top-bar">
                  <h3>🎯 Starting Action Plan</h3>
                  <button className="export-link-btn" onClick={() => handleExport('start', startResult)}>
                    <Download size={16} /> Export Markdown
                  </button>
                </div>

                {/* Confidence Meter */}
                <div className="confidence-meter-row">
                  <span className="meter-badge effort">Effort: {startResult.confidenceMeter?.effortLevel}</span>
                  <span className="meter-badge anxiety">Anxiety: {startResult.confidenceMeter?.anxietyLevel}</span>
                  <span className="meter-badge time">⏱️ {startResult.confidenceMeter?.estimatedTimeMinutes} Minutes</span>
                </div>

                <blockquote className="supportive-quote">
                  "{startResult.supportiveMessage}"
                </blockquote>

                <div className="clarifying-q-box">
                  <HelpCircle size={20} color="#2563eb" />
                  <div>
                    <strong>Clarifying Question:</strong>
                    <p>{startResult.clarifyingQuestion}</p>
                  </div>
                </div>

                <div className="ten-min-box">
                  <div className="ten-min-header">
                    <Clock size={20} color="#059669" />
                    <strong>Immediate 10-Minute Action Path:</strong>
                  </div>
                  <p className="ten-min-text">{startResult.immediateTenMinuteAction}</p>
                  <button className="start-timer-btn" onClick={() => alert("10-minute timer started! Take it step by step.")}>
                    ⏱️ Launch 10-Min Focus Session
                  </button>
                </div>

                <div className="micro-steps-box">
                  <h4>Next Micro-Steps:</h4>
                  <ul>
                    {(startResult.microSteps || []).map((step, idx) => (
                      <li key={idx}><CheckCircle2 size={16} color="#2563eb" /> {step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SIMPLIFY MODE */}
        {activeTab === 'simplify' && (
          <div className="mode-pane">
            <h2>✨ Simplify Mode: Plain Language & Clutter Reduction</h2>
            <p className="pane-desc">Converts complex text, dense notices, or convoluted web pages into Grade 6.0 plain language.</p>

            <textarea 
              className="nb-main-textarea"
              placeholder="Paste dense text or webpage content here..."
              value={simplifyText}
              onChange={(e) => setSimplifyText(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunSimplify} disabled={loading}>
              {loading ? 'Simplifying...' : '✨ Transform Text'}
            </button>

            {simplifyResult && (
              <div className="artifact-card fade-in">
                <div className="card-top-bar">
                  <span className="grade-pill">{simplifyResult.readabilityGrade}</span>
                  <button className="export-link-btn" onClick={() => handleExport('simplify', simplifyResult)}>
                    <Download size={16} /> Export Markdown
                  </button>
                </div>

                <div className="simplified-body">
                  <h3>Plain Language Version:</h3>
                  <p>{simplifyResult.plainLanguageRewrite}</p>
                </div>

                <div className="takeaways-list">
                  <h3>Key Takeaways:</h3>
                  <ul>
                    {(simplifyResult.keyTakeaways || []).map((point, idx) => (
                      <li key={idx}>🔹 {point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. LEARN MODE */}
        {activeTab === 'learn' && (
          <div className="mode-pane">
            <h2>🧠 Learn Mode: Mind Map & Quiz Generator</h2>
            <p className="pane-desc">Transforms dense academic text or articles into an interactive Visual Mind Map and Quick Quiz.</p>

            <textarea 
              className="nb-main-textarea"
              placeholder="Paste educational material or paper snippet here..."
              value={learnText}
              onChange={(e) => setLearnText(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunLearn} disabled={loading}>
              {loading ? 'Processing...' : '🧠 Generate Mind Map'}
            </button>

            {learnResult && (
              <div className="artifact-card fade-in">
                <div className="card-top-bar">
                  <h3>Visual Mind Map Structure</h3>
                  <button className="export-link-btn" onClick={() => handleExport('learn', learnResult)}>
                    <Download size={16} /> Export Mind Map
                  </button>
                </div>

                <div className="mindmap-root-node">
                  📍 Root: <strong>{learnResult.mindMap?.rootNode}</strong>
                </div>

                <div className="mindmap-tree-grid">
                  {(learnResult.mindMap?.branches || []).map((b, idx) => (
                    <div key={idx} className="mindmap-branch-card">
                      <h4>🔹 {b.topic}</h4>
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
                  {(learnResult.quiz || []).map((q, idx) => (
                    <div key={idx} className="quiz-card">
                      <p><strong>Q{idx + 1}: {q.question}</strong></p>
                      <div className="quiz-options-list">
                        {q.options.map((opt, oIdx) => (
                          <button 
                            key={oIdx} 
                            className="quiz-opt-btn"
                            onClick={() => {
                              if (oIdx === q.answerIndex) {
                                alert(`Correct! 🎉 ${q.explanation}`);
                              } else {
                                alert(`Try again! 💡 ${q.explanation}`);
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
        )}

        {/* 4. MEET MODE */}
        {activeTab === 'meet' && (
          <div className="mode-pane">
            <h2>🎙️ Meet Mode: Transcript to Action Items & Owners</h2>
            <p className="pane-desc">Extracts decisions, owner-assigned deadlines, and decodes corporate jargon from meeting transcripts.</p>

            <textarea 
              className="nb-main-textarea"
              placeholder="Paste raw meeting transcript here..."
              value={meetTranscript}
              onChange={(e) => setMeetTranscript(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunMeet} disabled={loading}>
              {loading ? 'Processing...' : '🎙️ Extract Action Items'}
            </button>

            {meetResult && (
              <div className="artifact-card fade-in">
                <div className="card-top-bar">
                  <h3>Action Items & Assigned Owners</h3>
                  <button className="export-link-btn" onClick={() => handleExport('meet', meetResult)}>
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
                    {(meetResult.actionItems || []).map((item, idx) => (
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
                  {(meetResult.jargonDecoded || []).map((j, idx) => (
                    <div key={idx} className="jargon-item">
                      <strong>{j.term}:</strong> <span>{j.plainMeaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. PRACTICE MODE */}
        {activeTab === 'practice' && (
          <div className="mode-pane">
            <h2>💬 Practice Mode: Social Scripting Rehearsal</h2>
            <p className="pane-desc">Rehearse challenging conversations, interviews, or phone calls with adaptive dialogue choices.</p>

            <input 
              type="text"
              className="nb-main-input"
              placeholder="Scenario topic (e.g. Asking landlord for repair update)"
              value={practiceTopic}
              onChange={(e) => setPracticeTopic(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunPractice} disabled={loading}>
              {loading ? 'Setting up rehearsal...' : '💬 Start Rehearsal'}
            </button>

            {practiceResult && (
              <div className="artifact-card fade-in">
                <blockquote className="roleplay-opening">
                  {practiceResult.openingLine}
                </blockquote>

                <h3>Suggested Script Responses:</h3>
                <div className="responses-grid">
                  {(practiceResult.suggestedResponses || []).map((r, idx) => (
                    <div key={idx} className="response-card" onClick={() => alert(`You selected response: "${r.text}"\nGreat practice!`)}>
                      <span className="tone-badge">{r.tone}</span>
                      <p>"{r.text}"</p>
                    </div>
                  ))}
                </div>

                <div className="coaching-banner">
                  💡 <strong>Coaching Tip:</strong> {practiceResult.coachingTip}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. WRITE MODE */}
        {activeTab === 'write' && (
          <div className="mode-pane">
            <h2>✍️ Write Mode: Accessible Authoring Assistant</h2>
            <p className="pane-desc">Checks draft text for passive voice, sentence complexity, and readability.</p>

            <textarea 
              className="nb-main-textarea"
              placeholder="Type or paste draft document..."
              value={writeDraft}
              onChange={(e) => setWriteDraft(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunWrite} disabled={loading}>
              {loading ? 'Analyzing...' : '✍️ Check Readability'}
            </button>

            {writeResult && (
              <div className="artifact-card fade-in">
                <div className="grade-header-row">
                  <span>Readability Level: <strong>{writeResult.originalGradeLevel}</strong></span>
                </div>

                <div className="improved-text-box">
                  <h3>Plain-Language Rewrite:</h3>
                  <p>{writeResult.improvedText}</p>
                </div>

                <div className="fixes-list">
                  <h3>Specific Line Adjustments:</h3>
                  {(writeResult.clarityFixes || []).map((fix, idx) => (
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
        )}

        {/* 7. GUIDE MODE */}
        {activeTab === 'guide' && (
          <div className="mode-pane">
            <h2>📍 Guide Mode: Software Step Literacy</h2>
            <p className="pane-desc">Creates clear, step-by-step instructions for digital workflows or online forms.</p>

            <input 
              type="text"
              className="nb-main-input"
              placeholder="Workflow goal (e.g. Reset password on student portal)"
              value={guideGoal}
              onChange={(e) => setGuideGoal(e.target.value)}
            />
            <button className="nb-action-btn primary" onClick={handleRunGuide} disabled={loading}>
              {loading ? 'Generating guide...' : '📍 Build Step Guide'}
            </button>

            {guideResult && (
              <div className="artifact-card fade-in">
                <h3>Workflow: {guideResult.workflowName}</h3>
                <div className="guide-steps-list">
                  {(guideResult.steps || []).map((s) => (
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
        )}

      </div>
    </div>
  );
};

export default Dashboard;
