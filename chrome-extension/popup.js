/**
 * NeuroBridge One - Chrome Extension Popup Controller
 * Manages the 7 Cognitive Accessibility Modes, Sensory Switch, Theme persistence,
 * local-first processing, and one-click artifact export.
 */

class NeuroBridgePopup {
  constructor() {
    this.apiHost = 'http://localhost:3000';
    this.state = {
      activeTab: 'start',
      sensoryCalm: false,
      theme: 'default',
      bionic: false,
      focus: false,
      tts: false,
      dyslexia: false,
      lastArtifact: null
    };
    this.init();
  }

  async init() {
    await this.loadState();
    this.setupNavigationTabs();
    this.setupSensorySwitch();
    this.setupThemeSelector();
    this.setupModeHandlers();
    this.setupToolToggles();
    this.updateUI();
  }

  async loadState() {
    const { nbState } = await chrome.storage.sync.get('nbState');
    if (nbState) {
      this.state = { ...this.state, ...nbState };
    }
  }

  async saveState() {
    await chrome.storage.sync.set({ nbState: this.state });
  }

  setupNavigationTabs() {
    const tabs = document.querySelectorAll('.nb-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nb-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = `tab-${tab.dataset.tab}`;
        document.getElementById(targetId)?.classList.add('active');
        this.state.activeTab = tab.dataset.tab;
        this.saveState();
      });
    });

    document.getElementById('btn-launch-agent')?.addEventListener('click', async () => {
      await this.sendActionToTab('openAgentCopilot');
      window.close();
    });
  }

  setupSensorySwitch() {
    const toggle = document.getElementById('sensory-toggle');
    if (toggle) {
      toggle.checked = this.state.sensoryCalm;
      toggle.addEventListener('change', (e) => {
        this.state.sensoryCalm = e.target.checked;
        document.body.classList.toggle('nb-sensory-calm', this.state.sensoryCalm);
        this.saveState();
        this.sendActionToTab('toggleSensoryMode', { enabled: this.state.sensoryCalm });
      });
    }
  }

  setupThemeSelector() {
    const themeDots = document.querySelectorAll('.nb-theme-dot');
    themeDots.forEach(dot => {
      dot.addEventListener('click', () => {
        themeDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.state.theme = dot.dataset.theme;
        document.body.setAttribute('data-theme', this.state.theme);
        this.saveState();
        this.sendActionToTab('setTheme', { theme: this.state.theme });
      });
    });
  }

  setupToolToggles() {
    const toolBtns = document.querySelectorAll('.nb-tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        const feature = btn.dataset.feature;

        if (mode) {
          this.state[mode] = !this.state[mode];
          btn.classList.toggle('active', this.state[mode]);
          await this.sendActionToTab('toggleMode', { mode, enabled: this.state[mode] });
        } else if (feature) {
          this.state[feature] = !this.state[feature];
          btn.classList.toggle('active', this.state[feature]);
          await this.sendActionToTab('toggleFeature', { feature, enabled: this.state[feature] });
        }
        this.saveState();
      });
    });

    document.getElementById('btn-open-sanctuary')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    });
  }

  updateUI() {
    document.body.setAttribute('data-theme', this.state.theme);
    if (this.state.sensoryCalm) {
      document.body.classList.add('nb-sensory-calm');
    }

    const activeTabBtn = document.querySelector(`.nb-tab[data-tab="${this.state.activeTab}"]`);
    if (activeTabBtn) activeTabBtn.click();

    const activeThemeDot = document.querySelector(`.nb-theme-dot[data-theme="${this.state.theme}"]`);
    if (activeThemeDot) {
      document.querySelectorAll('.nb-theme-dot').forEach(d => d.classList.remove('active'));
      activeThemeDot.classList.add('active');
    }
  }

  // ---------------------------------------------------------------------------
  // MODE HANDLERS (Start, Simplify, Learn, Meet, Practice, Write, Guide)
  // ---------------------------------------------------------------------------
  setupModeHandlers() {
    // 1. START MODE
    document.getElementById('btn-run-start')?.addEventListener('click', () => this.handleStartMode(false));
    document.getElementById('btn-autopilot')?.addEventListener('click', () => this.handleStartMode(true));
    document.getElementById('btn-export-start')?.addEventListener('click', () => this.exportCurrentArtifact('start'));

    // 2. SIMPLIFY MODE
    document.getElementById('btn-run-simplify')?.addEventListener('click', () => this.handleSimplifyMode());
    document.getElementById('btn-export-simplify')?.addEventListener('click', () => this.exportCurrentArtifact('simplify'));

    // 3. LEARN MODE
    document.getElementById('btn-run-learn')?.addEventListener('click', () => this.handleLearnMode());
    document.getElementById('btn-export-learn')?.addEventListener('click', () => this.exportCurrentArtifact('learn'));

    // 4. MEET MODE
    document.getElementById('btn-run-meet')?.addEventListener('click', () => this.handleMeetMode());
    document.getElementById('btn-export-meet')?.addEventListener('click', () => this.exportCurrentArtifact('meet'));

    // 5. PRACTICE MODE
    document.getElementById('btn-run-practice')?.addEventListener('click', () => this.handlePracticeMode());

    // 6. WRITE MODE
    document.getElementById('btn-run-write')?.addEventListener('click', () => this.handleWriteMode());

    // 7. GUIDE MODE
    document.getElementById('btn-run-guide')?.addEventListener('click', () => this.handleGuideMode());
  }

  // 1. START MODE IMPLEMENTATION
  async handleStartMode(isStuck = false) {
    const inputEl = document.getElementById('start-task-input');
    const task = inputEl.value.trim() || (isStuck ? "Overcoming executive dysfunction / task freeze" : "Plan my project");
    const outputEl = document.getElementById('start-output');
    
    this.showLoading(outputEl, "Generating 10-minute action path...");

    const data = await this.callApi('/api/start', { task, isStuck });
    this.state.lastArtifact = { mode: 'start', data };

    document.getElementById('badge-effort').textContent = `Effort: ${data.confidenceMeter?.effortLevel || 'Low'}`;
    document.getElementById('badge-anxiety').textContent = `Anxiety: ${data.confidenceMeter?.anxietyLevel || 'Low'}`;
    document.getElementById('badge-time').textContent = `⏱️ ${data.confidenceMeter?.estimatedTimeMinutes || 10} mins`;

    document.getElementById('start-supportive').textContent = `"${data.supportiveMessage}"`;
    document.getElementById('start-question').textContent = data.clarifyingQuestion;
    document.getElementById('start-action').textContent = data.immediateTenMinuteAction;

    const stepsList = document.getElementById('start-steps-list');
    stepsList.replaceChildren();
    (data.microSteps || []).forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      stepsList.appendChild(li);
    });

    outputEl.style.display = 'flex';
  }

  // 2. SIMPLIFY MODE IMPLEMENTATION
  async handleSimplifyMode() {
    const outputEl = document.getElementById('simplify-output');
    this.showLoading(outputEl, "Extracting and simplifying text...");

    const pageContent = await this.sendActionToTab('getPageContent');
    const text = pageContent?.text || "Dense digital interfaces create cognitive overload.";

    const data = await this.callApi('/api/simplify', { text });
    this.state.lastArtifact = { mode: 'simplify', data };

    document.getElementById('simplify-grade').textContent = data.readabilityGrade || "Grade 6.0";
    document.getElementById('simplify-text').textContent = data.plainLanguageRewrite;

    const takeawaysUl = document.getElementById('simplify-takeaways');
    takeawaysUl.replaceChildren();
    (data.keyTakeaways || []).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      takeawaysUl.appendChild(li);
    });

    outputEl.style.display = 'block';
  }

  // 3. LEARN MODE IMPLEMENTATION
  async handleLearnMode() {
    const outputEl = document.getElementById('learn-output');
    this.showLoading(outputEl, "Building visual mind map...");

    const pageContent = await this.sendActionToTab('getPageContent');
    const text = pageContent?.text || "Cognitive accessibility requires clear structure and chunking.";

    const data = await this.callApi('/api/learn', { text });
    this.state.lastArtifact = { mode: 'learn', data };

    const mindmapContainer = document.getElementById('learn-mindmap');
    mindmapContainer.replaceChildren();

    const rootEl = document.createElement('div');
    rootEl.style.fontWeight = '700';
    rootEl.style.marginBottom = '8px';
    rootEl.textContent = `📍 Root: ${data.mindMap?.rootNode || 'Material'}`;
    mindmapContainer.appendChild(rootEl);

    (data.mindMap?.branches || []).forEach(b => {
      const branchDiv = document.createElement('div');
      branchDiv.style.marginLeft = '12px';
      branchDiv.style.marginBottom = '6px';
      branchDiv.innerHTML = `<strong>🔹 ${b.topic}</strong>`;
      const ul = document.createElement('ul');
      b.details.forEach(d => {
        const li = document.createElement('li');
        li.textContent = d;
        ul.appendChild(li);
      });
      branchDiv.appendChild(ul);
      mindmapContainer.appendChild(branchDiv);
    });

    // Render Quiz
    const quizBox = document.getElementById('learn-quiz-box');
    quizBox.replaceChildren();
    (data.quiz || []).forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.style.marginBottom = '10px';
      qDiv.innerHTML = `<p><strong>Q${idx + 1}: ${q.question}</strong></p>`;
      q.options.forEach((opt, oIdx) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'nb-btn nb-btn-ghost';
        optBtn.style.margin = '4px 0';
        optBtn.style.fontSize = '12px';
        optBtn.style.textAlign = 'left';
        optBtn.textContent = `${oIdx + 1}. ${opt}`;
        optBtn.onclick = () => {
          if (oIdx === q.answerIndex) {
            optBtn.style.borderColor = '#059669';
            optBtn.style.background = '#dcfce7';
            alert(`Correct! ${q.explanation}`);
          } else {
            optBtn.style.borderColor = '#dc2626';
            alert(`Try again! ${q.explanation}`);
          }
        };
        qDiv.appendChild(optBtn);
      });
      quizBox.appendChild(qDiv);
    });

    outputEl.style.display = 'block';
  }

  // 4. MEET MODE IMPLEMENTATION
  async handleMeetMode() {
    const transcript = document.getElementById('meet-transcript-input').value.trim() ||
      "Team meeting: We discussed the release plan. Action item for Alex to complete tests by Friday.";
    const outputEl = document.getElementById('meet-output');
    
    this.showLoading(outputEl, "Analyzing transcript...");

    const data = await this.callApi('/api/meet', { transcript });
    this.state.lastArtifact = { mode: 'meet', data };

    const actionsContainer = document.getElementById('meet-actions-list');
    actionsContainer.replaceChildren();
    (data.actionItems || []).forEach(a => {
      const div = document.createElement('div');
      div.className = 'nb-action-highlight';
      div.innerHTML = `<strong>${a.task}</strong><div>Owner: ${a.owner} | Deadline: ${a.deadline}</div>`;
      actionsContainer.appendChild(div);
    });

    const jargonContainer = document.getElementById('meet-jargon-list');
    jargonContainer.replaceChildren();
    (data.jargonDecoded || []).forEach(j => {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${j.term}:</strong> ${j.plainMeaning}`;
      jargonContainer.appendChild(p);
    });

    outputEl.style.display = 'block';
  }

  // 5. PRACTICE MODE IMPLEMENTATION
  async handlePracticeMode() {
    const topic = document.getElementById('practice-topic-input').value.trim() || "Asking for deadline extension";
    const outputEl = document.getElementById('practice-output');

    this.showLoading(outputEl, "Setting up role-play rehearsal...");

    const data = await this.callApi('/api/practice', { topic });
    document.getElementById('practice-partner-line').textContent = data.openingLine;
    document.getElementById('practice-tip').textContent = `💡 Coaching Tip: ${data.coachingTip}`;

    const optionsContainer = document.getElementById('practice-options');
    optionsContainer.replaceChildren();
    (data.suggestedResponses || []).forEach(resp => {
      const btn = document.createElement('button');
      btn.className = 'nb-btn nb-btn-ghost';
      btn.style.margin = '4px 0';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.innerHTML = `<strong>[${resp.tone}]</strong> ${resp.text}`;
      btn.onclick = () => {
        alert(`You selected: "${resp.text}"\nGreat practice!`);
      };
      optionsContainer.appendChild(btn);
    });

    outputEl.style.display = 'block';
  }

  // 6. WRITE MODE IMPLEMENTATION
  async handleWriteMode() {
    const text = document.getElementById('write-draft-input').value.trim() ||
      "The task was completed by the team member yesterday in a very complicated way.";
    const outputEl = document.getElementById('write-output');

    this.showLoading(outputEl, "Analyzing accessibility & passive voice...");

    const data = await this.callApi('/api/write', { text });
    document.getElementById('write-grade').textContent = `Original Reading Level: ${data.originalGradeLevel}`;

    const fixesContainer = document.getElementById('write-fixes');
    fixesContainer.replaceChildren();

    const p = document.createElement('p');
    p.innerHTML = `<strong>Suggested Plain Text:</strong> ${data.improvedText}`;
    fixesContainer.appendChild(p);

    (data.clarityFixes || []).forEach(fix => {
      const div = document.createElement('div');
      div.className = 'nb-action-highlight';
      div.innerHTML = `<div>Original: <s>${fix.originalSnippet}</s></div><div>Suggestion: <strong>${fix.suggestedSnippet}</strong></div><small>${fix.reason}</small>`;
      fixesContainer.appendChild(div);
    });

    outputEl.style.display = 'block';
  }

  // 7. GUIDE MODE IMPLEMENTATION
  async handleGuideMode() {
    const goal = document.getElementById('guide-goal-input').value.trim() || "Complete standard web form";
    const outputEl = document.getElementById('guide-output');

    this.showLoading(outputEl, "Generating step-by-step software guide...");

    const data = await this.callApi('/api/guide', { goal });
    const container = document.getElementById('guide-steps-container');
    container.replaceChildren();

    (data.steps || []).forEach(s => {
      const div = document.createElement('div');
      div.className = 'nb-action-highlight';
      div.style.marginBottom = '8px';
      div.innerHTML = `<strong>Step ${s.stepNumber}: ${s.title}</strong><p>${s.actionRequired}</p><small>💡 ${s.tip}</small>`;
      container.appendChild(div);
    });

    outputEl.style.display = 'block';
  }

  // EXPORT UTILITY
  async exportCurrentArtifact(mode) {
    if (!this.state.lastArtifact || this.state.lastArtifact.mode !== mode) {
      alert("Generate content first before exporting.");
      return;
    }
    const res = await this.callApi('/api/export', {
      mode: this.state.lastArtifact.mode,
      data: this.state.lastArtifact.data
    });

    if (res?.markdown) {
      const blob = new Blob([res.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `neurobridge-${mode}.md`;
      a.click();
    }
  }

  // API Call Wrapper with L0 Fallback Grace
  async callApi(endpoint, body) {
    try {
      const res = await fetch(`${this.apiHost}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('API route returned error status');
      return await res.json();
    } catch (err) {
      console.warn(`Local L0 fallback engaged for ${endpoint}:`, err.message);
      return this.getLocalL0Fallback(endpoint, body);
    }
  }

  getLocalL0Fallback(endpoint, body) {
    if (endpoint.includes('/start')) {
      return {
        clarifyingQuestion: "What is the single smallest action you can do in 10 minutes?",
        immediateTenMinuteAction: `Open a blank document for "${body.task || 'My task'}" and type 1 heading.`,
        microSteps: [
          "Step 1: Set a timer for 10 minutes.",
          "Step 2: Write 3 bullet points.",
          "Step 3: Take a quiet 2-minute break."
        ],
        supportiveMessage: "Starting takes bravery. 10 minutes is all you need right now.",
        confidenceMeter: { effortLevel: 'Low', anxietyLevel: 'Moderate', estimatedTimeMinutes: 10 }
      };
    }
    return { summary: "Content processed with zero latency." };
  }

  showLoading(element, message) {
    element.style.display = 'block';
    element.innerHTML = `<div style="padding: 12px; color: var(--nb-muted); font-style: italic;">⏱️ ${message}</div>`;
  }

  async sendActionToTab(action, payload = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        return await chrome.tabs.sendMessage(tab.id, { action, ...payload });
      }
    } catch (e) {
      console.warn("Could not reach active tab script:", e.message);
    }
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => new NeuroBridgePopup());
