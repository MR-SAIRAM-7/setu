/**
 * NeuroBridge In-Page Autonomous AI Agent & Navigation Copilot
 *
 * Inspects live page DOM structure, accepts text/voice task requests,
 * and guides ADHD & Dyslexic users step-by-step with glowing DOM highlights,
 * audio read-alouds, and auto-step detection.
 */

class NeuroBridgeAgentCopilot {
  constructor() {
    this.overlay = null;
    this.currentPlan = null;
    this.currentStepIdx = 0;
    this.activeHighlightEl = null;
    this.badgeTooltip = null;
    this.recognition = null;
    this.apiHost = 'http://localhost:3000';
    this.init();
  }

  init() {
    chrome.runtime.onMessage?.addListener((request, _sender, sendResponse) => {
      if (request.action === 'openAgentCopilot') {
        this.openOverlay(request.initialTask || '');
        sendResponse({ success: true });
      } else if (request.action === 'startAgentTask') {
        this.openOverlay(request.task || '');
        if (request.task) this.executeTask(request.task);
        sendResponse({ success: true });
      }
    });

    // Auto-detect page URL navigation for step advancement
    window.addEventListener('beforeunload', () => {
      if (this.currentPlan) {
        sessionStorage.setItem('nb_agent_active_plan', JSON.stringify({
          plan: this.currentPlan,
          stepIdx: Math.min(this.currentStepIdx + 1, this.currentPlan.steps.length - 1)
        }));
      }
    });

    this.restoreActiveSession();
  }

  restoreActiveSession() {
    try {
      const saved = sessionStorage.getItem('nb_agent_active_plan');
      if (saved) {
        const { plan, stepIdx } = JSON.parse(saved);
        sessionStorage.removeItem('nb_agent_active_plan');
        if (plan && plan.steps?.length) {
          this.currentPlan = plan;
          this.currentStepIdx = stepIdx || 0;
          this.openOverlay();
          this.renderCurrentStep();
        }
      }
    } catch (e) {
      console.warn("Could not restore agent session:", e);
    }
  }

  openOverlay(initialTask = '') {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      const input = this.overlay.querySelector('.nb-agent-input');
      if (input && initialTask) input.value = initialTask;
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'nb-agent-overlay';
    this.overlay.innerHTML = `
      <div class="nb-agent-header">
        <div class="nb-agent-title-box">
          <span class="nb-agent-badge-icon">🤖</span>
          <div>
            <h3>NeuroBridge AI Agent</h3>
            <span class="nb-agent-subtitle">In-Page Step-by-Step Navigator</span>
          </div>
        </div>
        <button class="nb-agent-close-btn" title="Close Agent">×</button>
      </div>

      <div class="nb-agent-input-container">
        <div class="nb-agent-input-row">
          <input type="text" class="nb-agent-input" placeholder="e.g. Apply for EPFO, Submit form, Login..." value="${initialTask}" />
          <button class="nb-agent-mic-btn" title="Speak command (Voice input)">🎙️</button>
        </div>
        <button class="nb-agent-start-btn">Start Navigation</button>
      </div>

      <div class="nb-agent-step-area" style="display: none;">
        <div class="nb-agent-progress-bar">
          <div class="nb-agent-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="nb-agent-step-counter">Step <span id="nb-step-num">1</span> of <span id="nb-step-total">1</span></div>
        
        <div class="nb-agent-instruction-card">
          <p class="nb-agent-instruction-text" id="nb-instruction"></p>
          <div class="nb-agent-tip-text" id="nb-tip"></div>
        </div>

        <div class="nb-agent-control-buttons">
          <button class="nb-agent-action-btn highlight" id="btn-highlight-target">🎯 Highlight Target</button>
          <button class="nb-agent-action-btn speak" id="btn-speak-step">🔊 Read Aloud</button>
        </div>

        <div class="nb-agent-nav-footer">
          <button class="nb-agent-nav-btn prev" id="btn-prev-step" disabled>← Previous</button>
          <button class="nb-agent-nav-btn next" id="btn-next-step">Next Step →</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.attachOverlayListeners();
  }

  attachOverlayListeners() {
    this.overlay.querySelector('.nb-agent-close-btn').onclick = () => this.closeOverlay();
    this.overlay.querySelector('.nb-agent-start-btn').onclick = () => {
      const task = this.overlay.querySelector('.nb-agent-input').value.trim();
      if (task) this.executeTask(task);
    };
    this.overlay.querySelector('.nb-agent-mic-btn').onclick = () => this.startVoiceRecognition();
    
    this.overlay.querySelector('#btn-highlight-target').onclick = () => this.highlightCurrentTarget();
    this.overlay.querySelector('#btn-speak-step').onclick = () => this.speakCurrentStep();
    this.overlay.querySelector('#btn-prev-step').onclick = () => this.navigateStep(-1);
    this.overlay.querySelector('#btn-next-step').onclick = () => this.navigateStep(1);

    this.overlay.querySelector('.nb-agent-input').onkeydown = (e) => {
      if (e.key === 'Enter') {
        const task = e.target.value.trim();
        if (task) this.executeTask(task);
      }
    };
  }

  closeOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.clearHighlight();
  }

  // Live Page DOM Extraction
  extractPageContext() {
    const title = document.title || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(el => el.offsetParent !== null)
      .map(el => el.innerText.trim())
      .filter(Boolean)
      .slice(0, 10);

    const controls = Array.from(document.querySelectorAll('a, button, input, select, [role="button"]'))
      .filter(el => {
        if (!el.offsetParent) return false;
        const type = String(el.type || '').toLowerCase();
        return !['password', 'hidden'].includes(type);
      })
      .map((el, idx) => {
        const text = (el.innerText || el.value || el.placeholder || el.ariaLabel || el.title || '').trim();
        return {
          id: el.id || `ctrl-${idx}`,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          label: text.slice(0, 80),
          selector: this.generateCssSelector(el)
        };
      })
      .filter(c => c.label.length > 0)
      .slice(0, 25);

    return { title, headings, controls };
  }

  generateCssSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.split(/\s+/).filter(c => c && !c.startsWith('nb-')).slice(0, 2).join('.');
      if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    }
    return el.tagName.toLowerCase();
  }

  async executeTask(task) {
    const stepArea = this.overlay.querySelector('.nb-agent-step-area');
    stepArea.style.display = 'block';
    this.overlay.querySelector('#nb-instruction').textContent = "Analyzing page structure and generating navigation plan...";
    this.overlay.querySelector('#nb-tip').textContent = "";

    const pageContext = this.extractPageContext();

    try {
      const res = await fetch(`${this.apiHost}/api/agent/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, pageContext })
      });
      if (!res.ok) throw new Error("Backend error");
      this.currentPlan = await res.json();
    } catch (e) {
      console.warn("Using L0 Local DOM Navigation Agent:", e.message);
      this.currentPlan = this.generateLocalDOMPlan(task, pageContext);
    }

    this.currentStepIdx = 0;
    this.renderCurrentStep();
  }

  renderCurrentStep() {
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;

    const total = this.currentPlan.steps.length;
    const step = this.currentPlan.steps[this.currentStepIdx];

    this.overlay.querySelector('#nb-step-num').textContent = this.currentStepIdx + 1;
    this.overlay.querySelector('#nb-step-total').textContent = total;
    this.overlay.querySelector('#nb-instruction').textContent = step.instruction;
    this.overlay.querySelector('#nb-tip').textContent = `💡 Tip: ${step.tip}`;

    const progressPct = ((this.currentStepIdx + 1) / total) * 100;
    this.overlay.querySelector('.nb-agent-progress-fill').style.width = `${progressPct}%`;

    this.overlay.querySelector('#btn-prev-step').disabled = this.currentStepIdx === 0;
    const nextBtn = this.overlay.querySelector('#btn-next-step');
    nextBtn.textContent = this.currentStepIdx === total - 1 ? "Finish ✓" : "Next Step →";

    // Auto highlight current step target on DOM
    this.highlightCurrentTarget();
  }

  navigateStep(delta) {
    if (!this.currentPlan) return;
    const newIdx = this.currentStepIdx + delta;
    if (newIdx >= 0 && newIdx < this.currentPlan.steps.length) {
      this.currentStepIdx = newIdx;
      this.renderCurrentStep();
    } else if (newIdx >= this.currentPlan.steps.length) {
      alert("Task navigation complete! You've reached the final step.");
      this.closeOverlay();
    }
  }

  // High-Contrast DOM Target Element Highlighter
  highlightCurrentTarget() {
    this.clearHighlight();
    if (!this.currentPlan) return;

    const step = this.currentPlan.steps[this.currentStepIdx];
    let target = null;

    if (step.targetSelector) {
      try {
        target = document.querySelector(step.targetSelector);
      } catch (_) {}
    }

    if (!target && step.targetText) {
      const lower = step.targetText.toLowerCase();
      const candidates = Array.from(document.querySelectorAll('a, button, input, select, label, h1, h2, h3, [role="button"]'));
      target = candidates.find(el => (el.innerText || el.value || el.placeholder || '').toLowerCase().includes(lower));
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('nb-agent-target-highlight');
      this.activeHighlightEl = target;

      // Attach floating step badge tooltip
      this.badgeTooltip = document.createElement('div');
      this.badgeTooltip.className = 'nb-agent-floating-badge';
      this.badgeTooltip.textContent = `📍 Step ${step.stepNumber}: Perform Action Here`;
      document.body.appendChild(this.badgeTooltip);

      const rect = target.getBoundingClientRect();
      this.badgeTooltip.style.top = `${window.scrollY + rect.top - 36}px`;
      this.badgeTooltip.style.left = `${window.scrollX + rect.left}px`;
    }
  }

  clearHighlight() {
    if (this.activeHighlightEl) {
      this.activeHighlightEl.classList.remove('nb-agent-target-highlight');
      this.activeHighlightEl = null;
    }
    if (this.badgeTooltip) {
      this.badgeTooltip.remove();
      this.badgeTooltip = null;
    }
  }

  speakCurrentStep() {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps[this.currentStepIdx];
    const textToSpeak = `Step ${step.stepNumber}. ${step.instruction}`;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  startVoiceRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Voice recognition is not supported in this browser. Please type your task.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    const input = this.overlay.querySelector('.nb-agent-input');
    input.placeholder = "Listening... Speak your task now!";

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      input.value = speechResult;
      this.executeTask(speechResult);
    };

    recognition.onerror = () => {
      input.placeholder = "Could not hear speech. Please type your task.";
    };

    recognition.start();
  }

  generateLocalDOMPlan(task, pageContext) {
    const controls = pageContext.controls || [];
    const login = controls.find(c => /login|sign in|member|passbook|portal|log in/i.test(c.label));
    const submit = controls.find(c => /submit|apply|proceed|next|register/i.test(c.label));

    const steps = [];
    if (login) {
      steps.push({
        stepNumber: 1,
        instruction: `Click the "${login.label}" link highlighted on the page to open the access portal.`,
        targetSelector: login.selector,
        targetText: login.label,
        actionType: 'click',
        tip: 'Target element is surrounded by a glowing green ring.'
      });
    }
    steps.push({
      stepNumber: steps.length + 1,
      instruction: `Enter your details into the primary form field on the screen.`,
      targetSelector: 'input[type="text"]',
      targetText: 'Input field',
      actionType: 'fill',
      tip: 'Take your time entering text.'
    });
    steps.push({
      stepNumber: steps.length + 1,
      instruction: `Click "${submit ? submit.label : 'Submit'}" to complete your task for "${task}".`,
      targetSelector: submit ? submit.selector : 'button[type="submit"]',
      targetText: submit ? submit.label : 'Submit',
      actionType: 'click',
      tip: 'Check all details before submitting.'
    });

    return { goal: task, totalSteps: steps.length, currentStepIndex: 0, steps, supportiveMessage: `Guiding you step-by-step through ${task}.` };
  }
}

// Instantiate In-Page Agent
if (typeof window !== 'undefined') {
  window.nbAgentCopilot = new NeuroBridgeAgentCopilot();
}
