/**
 * NeuroRead Fully Autonomous In-Page AI Agent & Navigation Copilot
 *
 * Fully autonomous browser agent capable of executing multi-step goals on any webpage.
 * Automatically plans, navigates, auto-fills forms, clicks buttons, scrolls, extracts data,
 * and recovers gracefully across DOM changes.
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
    this.targetClickListener = null;
    this.isAutoRunning = false;
    this.autoRunTimer = null;
    this.init();
  }

  async init() {
    try {
      const { apiHost } = await chrome.storage.sync.get('apiHost');
      if (apiHost) this.apiHost = apiHost;
    } catch (_) {}

    chrome.runtime.onMessage?.addListener((request, _sender, sendResponse) => {
      if (request.action === 'openAgentCopilot') {
        this.openOverlay(request.initialTask || '');
        sendResponse({ success: true });
      } else if (request.action === 'startAgentTask') {
        this.openOverlay(request.task || '');
        if (request.task) this.executeTask(request.task, true);
        sendResponse({ success: true });
      } else if (request.action === 'autoFillForm') {
        this.autoFillEntireForm();
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
      console.warn("[NeuroRead Agent] Could not restore session:", e);
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
          <span class="nb-agent-badge-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
          </span>
          <div>
            <h3>NeuroRead AI Autonomous Agent</h3>
            <span class="nb-agent-subtitle">Fully Autonomous Web Task Execution</span>
          </div>
        </div>
        <button class="nb-agent-close-btn" title="Close Agent">&times;</button>
      </div>

      <div class="nb-agent-input-container">
        <div class="nb-agent-input-row">
          <input type="text" class="nb-agent-input" placeholder="e.g. Fill form, search article, apply for passbook..." value="${initialTask}" />
          <button class="nb-agent-mic-btn" title="Speak command (Voice input)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </button>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="nb-agent-start-btn" style="flex: 1; background: #059669;" id="btn-autorun-task">Auto-Run Agent</button>
          <button class="nb-agent-start-btn" style="flex: 1;" id="btn-plan-task">Step Plan</button>
          <button class="nb-agent-start-btn" id="btn-autofill-form" style="background: #2563eb; flex: 1;">Auto-Fill Form</button>
        </div>
      </div>

      <div class="nb-agent-step-area" style="display: none;">
        <div class="nb-agent-progress-bar">
          <div class="nb-agent-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="nb-agent-step-counter" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Step <span id="nb-step-num">1</span> of <span id="nb-step-total">1</span></span>
          <span id="nb-autorun-status" style="font-size: 11px; color: #059669; font-weight: 700;"></span>
        </div>
        
        <div class="nb-agent-instruction-card">
          <p class="nb-agent-instruction-text" id="nb-instruction"></p>
          <div class="nb-agent-tip-text" id="nb-tip"></div>
        </div>

        <div class="nb-agent-control-buttons">
          <button class="nb-agent-action-btn highlight" id="btn-execute-step" style="background: #059669; color: #fff; border: none; font-weight: 700;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Execute Step
          </button>
          <button class="nb-agent-action-btn highlight" id="btn-toggle-autorun" style="background: #6366f1; color: #fff; border: none; font-weight: 700;">
            Auto-Run All
          </button>
          <button class="nb-agent-action-btn speak" id="btn-speak-step">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            Read Aloud
          </button>
        </div>

        <div class="nb-agent-nav-footer">
          <button class="nb-agent-nav-btn prev" id="btn-prev-step" disabled>&larr; Previous</button>
          <button class="nb-agent-nav-btn next" id="btn-next-step">Next Step &rarr;</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.attachOverlayListeners();
  }

  attachOverlayListeners() {
    this.overlay.querySelector('.nb-agent-close-btn').onclick = () => this.closeOverlay();
    
    this.overlay.querySelector('#btn-autorun-task').onclick = () => {
      const task = this.overlay.querySelector('.nb-agent-input').value.trim();
      if (task) this.executeTask(task, true);
    };

    this.overlay.querySelector('#btn-plan-task').onclick = () => {
      const task = this.overlay.querySelector('.nb-agent-input').value.trim();
      if (task) this.executeTask(task, false);
    };

    this.overlay.querySelector('#btn-autofill-form').onclick = () => this.autoFillEntireForm();
    this.overlay.querySelector('.nb-agent-mic-btn').onclick = () => this.startVoiceRecognition();
    
    this.overlay.querySelector('#btn-execute-step').onclick = () => this.executeCurrentStep();
    this.overlay.querySelector('#btn-toggle-autorun').onclick = () => {
      if (this.isAutoRunning) {
        this.stopAutoRun();
      } else {
        this.startAutoRun();
      }
    };
    this.overlay.querySelector('#btn-speak-step').onclick = () => this.speakCurrentStep();
    this.overlay.querySelector('#btn-prev-step').onclick = () => this.navigateStep(-1);
    this.overlay.querySelector('#btn-next-step').onclick = () => this.navigateStep(1);

    this.overlay.querySelector('.nb-agent-input').onkeydown = (e) => {
      if (e.key === 'Enter') {
        const task = e.target.value.trim();
        if (task) this.executeTask(task, true);
      }
    };
  }

  closeOverlay() {
    this.stopAutoRun();
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.clearHighlight();
  }

  // Full Autonomous Loop Controller
  async startAutoRun() {
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;
    this.isAutoRunning = true;
    
    const autoBtn = this.overlay.querySelector('#btn-toggle-autorun');
    if (autoBtn) {
      autoBtn.textContent = 'Pause Auto-Run';
      autoBtn.style.background = '#f43f5e';
    }

    const statusEl = this.overlay.querySelector('#nb-autorun-status');
    if (statusEl) statusEl.textContent = 'AUTONOMOUS RUNNING...';

    while (this.isAutoRunning && this.currentStepIdx < this.currentPlan.steps.length) {
      await this.executeCurrentStepAsync();
      await new Promise(r => setTimeout(r, 1400));
    }

    this.stopAutoRun();
  }

  stopAutoRun() {
    this.isAutoRunning = false;
    if (this.autoRunTimer) {
      clearTimeout(this.autoRunTimer);
      this.autoRunTimer = null;
    }
    const autoBtn = this.overlay?.querySelector('#btn-toggle-autorun');
    if (autoBtn) {
      autoBtn.textContent = 'Auto-Run All';
      autoBtn.style.background = '#6366f1';
    }
    const statusEl = this.overlay?.querySelector('#nb-autorun-status');
    if (statusEl) statusEl.textContent = '';
  }

  // Smart Autonomous Form Auto-Fill Engine
  autoFillEntireForm() {
    const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'))
      .filter(el => el.offsetParent !== null && !el.disabled && !el.readOnly && !el.closest('#nb-agent-overlay'));

    if (!fields.length) {
      alert("No fillable form fields found on this page.");
      return;
    }

    let filledCount = 0;
    fields.forEach(field => {
      const labelText = (
        field.id ? (document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.innerText || '') : ''
      ) || field.getAttribute('aria-label') || field.placeholder || field.name || field.type || '';

      const lower = labelText.toLowerCase();
      let fillVal = '';

      if (/email/i.test(lower) || field.type === 'email') {
        fillVal = 'alex.morgan@example.com';
      } else if (/first.*name|fname/i.test(lower)) {
        fillVal = 'Alex';
      } else if (/last.*name|lname/i.test(lower)) {
        fillVal = 'Morgan';
      } else if (/name/i.test(lower)) {
        fillVal = 'Alex Morgan';
      } else if (/phone|mobile|tel/i.test(lower) || field.type === 'tel') {
        fillVal = '+1 (555) 019-2834';
      } else if (/address|street/i.test(lower)) {
        fillVal = '123 Innovation Blvd, Suite 400';
      } else if (/city/i.test(lower)) {
        fillVal = 'San Francisco';
      } else if (/zip|postal/i.test(lower)) {
        fillVal = '94107';
      } else if (/state|province/i.test(lower)) {
        fillVal = 'California';
      } else if (/company|organization/i.test(lower)) {
        fillVal = 'NeuroRead Technologies';
      } else if (/subject|title/i.test(lower)) {
        fillVal = 'Accessibility Support Request';
      } else if (/comment|message|description|feedback|note/i.test(lower) || field.tagName === 'TEXTAREA') {
        fillVal = 'This form has been automatically populated by the NeuroRead Autonomous Accessibility Copilot.';
      } else if (field.type === 'checkbox') {
        field.checked = true;
        filledCount++;
      } else if (field.tagName === 'SELECT') {
        if (field.options.length > 1) {
          field.selectedIndex = 1;
          filledCount++;
        }
      } else if (!field.value) {
        fillVal = 'Sample Information';
      }

      if (fillVal && field.tagName !== 'SELECT' && field.type !== 'checkbox') {
        field.focus();
        field.value = fillVal;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.classList.add('nb-agent-target-highlight');
        setTimeout(() => field.classList.remove('nb-agent-target-highlight'), 2000);
        filledCount++;
      }
    });

    const stepArea = this.overlay.querySelector('.nb-agent-step-area');
    stepArea.style.display = 'block';
    this.overlay.querySelector('#nb-instruction').textContent = `Success! Auto-filled ${filledCount} form fields on this page.`;
    this.overlay.querySelector('#nb-tip').textContent = "Review the populated details and click Submit when ready.";
    this.speakText(`Auto-filled ${filledCount} form fields on this page.`);
  }

  // Live Page DOM Extraction Engine
  extractPageContext() {
    const title = document.title || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(el => el.offsetParent !== null)
      .map(el => el.innerText.trim())
      .filter(Boolean)
      .slice(0, 10);

    const controls = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"]'))
      .filter(el => {
        if (!el.offsetParent) return false;
        if (el.closest('#nb-agent-overlay') || el.closest('#setu-container') || el.closest('#nb-line-focus-root')) return false;
        return true;
      })
      .slice(0, 30)
      .map((el, idx) => {
        let selector = el.id ? `#${CSS.escape(el.id)}` : el.className ? `.${CSS.escape(el.className.split(' ')[0])}` : el.tagName.toLowerCase();
        let label = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.name || `Element ${idx + 1}`;
        return { selector, label: label.trim().slice(0, 40), tag: el.tagName.toLowerCase(), type: el.type || '' };
      });

    return { title, headings, controls };
  }

  async executeTask(task, autoRun = false) {
    const stepArea = this.overlay.querySelector('.nb-agent-step-area');
    stepArea.style.display = 'block';
    this.overlay.querySelector('#nb-instruction').textContent = "Analyzing page DOM & generating autonomous action plan...";
    this.overlay.querySelector('#nb-tip').textContent = "Please wait a moment.";

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
      console.warn("[NeuroRead Agent] Using L0 Local DOM Engine:", e.message);
      this.currentPlan = this.generateLocalDOMPlan(task, pageContext);
    }

    this.currentStepIdx = 0;
    this.renderCurrentStep();

    if (autoRun) {
      setTimeout(() => this.startAutoRun(), 600);
    }
  }

  renderCurrentStep() {
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;

    const total = this.currentPlan.steps.length;
    const step = this.currentPlan.steps[this.currentStepIdx];

    this.overlay.querySelector('#nb-step-num').textContent = this.currentStepIdx + 1;
    this.overlay.querySelector('#nb-step-total').textContent = total;
    this.overlay.querySelector('#nb-instruction').textContent = step.instruction;
    this.overlay.querySelector('#nb-tip').textContent = `Tip: ${step.tip}`;

    const progressPct = ((this.currentStepIdx + 1) / total) * 100;
    this.overlay.querySelector('.nb-agent-progress-fill').style.width = `${progressPct}%`;

    this.overlay.querySelector('#btn-prev-step').disabled = this.currentStepIdx === 0;
    const nextBtn = this.overlay.querySelector('#btn-next-step');
    nextBtn.textContent = this.currentStepIdx === total - 1 ? "Finish Task" : "Next Step \u2192";

    // Auto highlight current step target on live DOM
    this.highlightCurrentTarget();

    // Auto read step aloud
    this.speakCurrentStep();
  }

  navigateStep(delta) {
    if (!this.currentPlan) return;
    const newIdx = this.currentStepIdx + delta;
    if (newIdx >= 0 && newIdx < this.currentPlan.steps.length) {
      this.currentStepIdx = newIdx;
      this.renderCurrentStep();
    } else if (newIdx >= this.currentPlan.steps.length) {
      this.stopAutoRun();
      alert("Autonomous task complete! All steps executed.");
      this.closeOverlay();
    }
  }

  // Find target element on page with fuzzy matching fallbacks
  findTargetElement(step) {
    let target = null;
    if (step.targetSelector) {
      try {
        target = document.querySelector(step.targetSelector);
      } catch (_) {}
    }

    if (!target && step.targetText) {
      const lower = step.targetText.toLowerCase();
      const candidates = Array.from(document.querySelectorAll('a, button, input, select, textarea, label, h1, h2, h3, [role="button"]'))
        .filter(el => !el.closest('#nb-agent-overlay') && el.offsetParent !== null);
      
      target = candidates.find(el => (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').toLowerCase().includes(lower));
    }

    return target;
  }

  // Async Step Execution Promise for Autonomous Loop
  async executeCurrentStepAsync() {
    return new Promise((resolve) => {
      this.executeCurrentStep();
      setTimeout(resolve, 800);
    });
  }

  // Execute Action directly on DOM target
  executeCurrentStep() {
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;
    const step = this.currentPlan.steps[this.currentStepIdx];
    const target = this.findTargetElement(step);

    if (!target) {
      if (step.actionType === 'scroll') {
        window.scrollBy({ top: window.innerHeight * 0.6, behavior: 'smooth' });
        this.navigateStep(1);
        return;
      }
      this.navigateStep(1);
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (step.actionType === 'click' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button') {
      target.classList.add('nb-agent-target-highlight');
      setTimeout(() => {
        try {
          target.click();
        } catch (err) {
          console.warn("Click failed:", err);
        }
        this.navigateStep(1);
      }, 400);
    } else if (step.actionType === 'fill' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      target.focus();
      target.select?.();
      
      let fillVal = step.valueToFill || target.value || '';
      if (!fillVal) {
        const label = (target.placeholder || target.name || target.id || '').toLowerCase();
        if (/email/i.test(label)) fillVal = 'alex.morgan@example.com';
        else if (/name/i.test(label)) fillVal = 'Alex Morgan';
        else if (/phone|tel/i.test(label)) fillVal = '+1 (555) 019-2834';
        else fillVal = 'Sample Input';
      }

      target.value = fillVal;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.classList.add('nb-agent-target-highlight');
      setTimeout(() => target.classList.remove('nb-agent-target-highlight'), 1200);

      this.navigateStep(1);
    } else if (step.actionType === 'scroll') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.navigateStep(1);
    } else {
      target.focus();
      this.navigateStep(1);
    }
  }

  // High-Contrast DOM Target Element Highlighter & Floating Badge Tooltip
  highlightCurrentTarget() {
    this.clearHighlight();
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;

    const step = this.currentPlan.steps[this.currentStepIdx];
    const target = this.findTargetElement(step);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('nb-agent-target-highlight');
      this.activeHighlightEl = target;

      // Attach auto-step listener: when user clicks target manually, auto advance step!
      this.targetClickListener = () => {
        setTimeout(() => this.navigateStep(1), 300);
      };
      target.addEventListener('click', this.targetClickListener, { once: true });

      // Attach floating step badge tooltip directly over element
      this.badgeTooltip = document.createElement('div');
      this.badgeTooltip.className = 'nb-agent-floating-badge';
      this.badgeTooltip.style.pointerEvents = 'auto';
      this.badgeTooltip.innerHTML = `
        <span>Step ${step.stepNumber}: ${step.actionType?.toUpperCase() || 'ACTION'}</span>
        <button id="nb-badge-exec-btn" style="background:#ffffff; color:#059669; border:none; padding:2px 8px; border-radius:10px; font-weight:700; cursor:pointer; margin-left:6px;">Execute</button>
      `;
      document.body.appendChild(this.badgeTooltip);

      this.badgeTooltip.querySelector('#nb-badge-exec-btn').onclick = (e) => {
        e.stopPropagation();
        this.executeCurrentStep();
      };

      const rect = target.getBoundingClientRect();
      this.badgeTooltip.style.top = `${Math.max(10, window.scrollY + rect.top - 40)}px`;
      this.badgeTooltip.style.left = `${Math.max(10, window.scrollX + rect.left)}px`;
    }
  }

  clearHighlight() {
    if (this.activeHighlightEl) {
      if (this.targetClickListener) {
        this.activeHighlightEl.removeEventListener('click', this.targetClickListener);
        this.targetClickListener = null;
      }
      this.activeHighlightEl.classList.remove('nb-agent-target-highlight');
      this.activeHighlightEl = null;
    }
    if (this.badgeTooltip) {
      this.badgeTooltip.remove();
      this.badgeTooltip = null;
    }
  }

  speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  speakCurrentStep() {
    if (!this.currentPlan || !this.currentPlan.steps?.length) return;
    const step = this.currentPlan.steps[this.currentStepIdx];
    this.speakText(`Step ${step.stepNumber}. ${step.instruction}`);
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
      if (/fill|form|input/i.test(speechResult)) {
        this.autoFillEntireForm();
      } else {
        this.executeTask(speechResult, true);
      }
    };

    recognition.onerror = () => {
      input.placeholder = "Could not hear speech. Please type your task.";
    };

    recognition.start();
  }

  generateLocalDOMPlan(task, pageContext) {
    const controls = pageContext.controls || [];
    const login = controls.find(c => /login|sign in|member|passbook|portal|log in/i.test(c.label));
    const submit = controls.find(c => /submit|apply|proceed|next|register|search|send/i.test(c.label));

    const steps = [];
    if (login) {
      steps.push({
        stepNumber: 1,
        instruction: `Click the "${login.label}" link highlighted on the page to open access portal.`,
        targetSelector: login.selector,
        targetText: login.label,
        actionType: 'click',
        tip: 'Target element is surrounded by a glowing green ring.'
      });
    }
    steps.push({
      stepNumber: steps.length + 1,
      instruction: `Enter your details into the primary form field on the screen.`,
      targetSelector: 'input[type="text"], input[type="search"], textarea',
      targetText: 'Input field',
      actionType: 'fill',
      valueToFill: 'Alex Morgan',
      tip: 'Take your time entering text or click Auto-Fill Form.'
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
