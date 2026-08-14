/**
 * SETU Commander — the in-page AI agent.
 *
 * Rebuilt in v3 as a conversational agent rather than a form with buttons.
 * The user states a goal in words (typed or spoken), the engine reads the live
 * page and returns a plan, and each step is executed against the real DOM.
 *
 * Safety is the defining constraint here. This runs on every site, including
 * banking and government portals, so:
 *   - The agent may only target controls it was actually shown.
 *   - Steps the backend flags `requiresConfirmation` (submit, pay, delete,
 *     send) never fire automatically — not even during Auto-Run. The run pauses
 *     and waits for a deliberate click.
 *   - Nothing is auto-filled with invented personal data. The previous build
 *     typed a fake identity ("Alex Morgan", a fake address and phone number)
 *     into arbitrary forms and could then click Submit unattended.
 */

(() => {
  const { Feature, UI, API, Text, Store } = window.SETU;

  class Commander extends Feature {
    static key = 'commander';

    constructor() {
      super();
      this.plan = null;
      this.stepIndex = 0;
      this.autoRun = false;
      this.busy = false;
      this.messages = [];
      this.highlighted = null;
      this.recognition = null;
    }

    onEnable() {
      this.build();
      this.restore();
    }

    onDisable() {
      this.stopAutoRun();
      this.clearHighlight();
      this.stopVoice();
      UI.destroyHost('commander');
    }

    open(initial = '') {
      if (!this.enabled) this.enable();
      // Clear any inline hide; the stylesheet owns the layout (display: flex).
      this.dock.style.display = '';
      const input = this.scope.querySelector('.composer input');
      if (initial) input.value = initial;
      input.focus();
    }

    /* ------------------------------------------------------------------ */
    /* Session continuity across navigations                              */
    /* ------------------------------------------------------------------ */

    persist() {
      try {
        sessionStorage.setItem(
          'setu_agent_session',
          JSON.stringify({ plan: this.plan, stepIndex: this.stepIndex, messages: this.messages.slice(-12) })
        );
      } catch (_) {
        /* storage full or blocked */
      }
    }

    restore() {
      try {
        const raw = sessionStorage.getItem('setu_agent_session');
        if (!raw) return;
        const saved = JSON.parse(raw);
        sessionStorage.removeItem('setu_agent_session');

        if (saved.plan?.steps?.length) {
          this.plan = saved.plan;
          this.stepIndex = Math.min(saved.stepIndex || 0, saved.plan.steps.length - 1);
          this.messages = saved.messages || [];
          this.messages.forEach((m) => this.appendMessage(m.role, m.text, { silent: true }));
          this.renderPlan();
          this.say('agent', 'Picking up where we left off after the page changed.');
        }
      } catch (_) {
        /* corrupt session — ignore */
      }
    }

    /* ------------------------------------------------------------------ */
    /* Page snapshot                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Describe the page to the model as a list of addressable controls.
     * Each gets a `ref` and a data attribute, so a plan can name a control
     * unambiguously without brittle CSS selectors.
     */
    snapshot({ maxControls = 60 } = {}) {
      document.querySelectorAll('[data-setu-ref]').forEach((el) => el.removeAttribute('data-setu-ref'));

      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        const style = getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
      };

      const controls = [];
      const nodes = document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], summary'
      );

      for (const el of nodes) {
        if (controls.length >= maxControls) break;
        if (Text.isOurs(el) || el.disabled || !isVisible(el)) continue;

        const label = (
          el.getAttribute('aria-label') ||
          el.innerText ||
          el.value ||
          el.placeholder ||
          el.title ||
          el.name ||
          (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText : '') ||
          el.getAttribute('alt') ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 70);

        if (!label) continue;

        const ref = `r${controls.length}`;
        el.setAttribute('data-setu-ref', ref);

        controls.push({
          ref,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          label,
          value: el.tagName === 'INPUT' && el.type !== 'password' ? String(el.value || '').slice(0, 40) : ''
        });
      }

      return {
        url: location.href,
        title: document.title,
        headings: [...document.querySelectorAll('h1, h2, h3')]
          .filter((el) => !Text.isOurs(el) && el.getClientRects().length)
          .map((el) => el.innerText.trim())
          .filter(Boolean)
          .slice(0, 14),
        controls,
        text: Text.pageText(3000)
      };
    }

    resolve(step) {
      if (step.targetRef) {
        const el = document.querySelector(`[data-setu-ref="${CSS.escape(step.targetRef)}"]`);
        if (el?.isConnected) return el;
      }

      // The page re-rendered and dropped our refs — fall back to the label.
      if (step.targetText) {
        const needle = step.targetText.toLowerCase();
        const candidates = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')];
        return (
          candidates.find((el) => {
            if (Text.isOurs(el) || !el.getClientRects().length) return false;
            const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '')
              .toLowerCase()
              .trim();
            return label === needle;
          }) ||
          candidates.find((el) => {
            if (Text.isOurs(el) || !el.getClientRects().length) return false;
            const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '')
              .toLowerCase();
            return label.includes(needle);
          }) ||
          null
        );
      }
      return null;
    }

    /* ------------------------------------------------------------------ */
    /* Conversation                                                       */
    /* ------------------------------------------------------------------ */

    async submit(text) {
      const goal = text.trim();
      if (!goal || this.busy) return;

      this.say('user', goal);
      this.busy = true;
      this.setThinking(true);

      try {
        const plan = await API.post('/api/agent/plan', { task: goal, pageContext: this.snapshot() });

        if (!plan.feasible) {
          this.say('agent', plan.blockedReason || "I can't do that from this page.");
          this.plan = null;
          this.renderPlan();
          return;
        }

        if (!plan.steps?.length) {
          this.say('agent', "I couldn't find the controls needed for that on this page.");
          return;
        }

        this.plan = plan;
        this.stepIndex = 0;
        this.say('agent', plan.understanding || `Here's my plan for "${goal}".`);
        if (plan.fallback) {
          this.say('agent', `Note: the AI engine was unreachable (${plan.fallbackReason || 'offline'}), so this is a basic local plan.`);
        }
        this.renderPlan();
        this.highlightCurrent();
      } catch (error) {
        this.say('agent', `I couldn't reach the SETU engine. ${error.message}`);
      } finally {
        this.busy = false;
        this.setThinking(false);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Execution                                                          */
    /* ------------------------------------------------------------------ */

    currentStep() {
      return this.plan?.steps?.[this.stepIndex] || null;
    }

    /**
     * Execute the current step.
     * @param {boolean} confirmed set only by an explicit user click on a
     *   step the backend flagged as irreversible.
     */
    async execute({ confirmed = false } = {}) {
      const step = this.currentStep();
      if (!step || this.busy) return;

      if (step.requiresConfirmation && !confirmed) {
        this.stopAutoRun();
        this.renderPlan();
        this.say(
          'agent',
          `This step will "${step.targetText || step.instruction}", which I can't undo. Press Confirm below if you want me to do it.`
        );
        return;
      }

      const selfContained = ['scroll', 'read', 'wait'];
      const target = selfContained.includes(step.actionType) ? null : this.resolve(step);

      if (!target && !selfContained.includes(step.actionType)) {
        this.say('agent', `I couldn't find "${step.targetText}" on the page any more. It may have moved.`);
        this.stopAutoRun();
        return;
      }

      this.busy = true;

      try {
        switch (step.actionType) {
          case 'scroll':
            window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
            break;

          case 'wait':
            await new Promise((resolve) => setTimeout(resolve, 1200));
            break;

          case 'read':
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;

          case 'fill':
          case 'select':
            await this.fill(target, step);
            break;

          case 'click':
          case 'submit':
          case 'navigate':
          default:
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise((resolve) => setTimeout(resolve, 320));
            // A navigation may tear down this context — save first.
            this.persist();
            target.click();
            break;
        }

        this.advance();
      } catch (error) {
        this.say('agent', `That step didn't work: ${error.message}`);
        this.stopAutoRun();
      } finally {
        this.busy = false;
      }
    }

    async fill(target, step) {
      target.focus();

      if (target.tagName === 'SELECT') {
        const wanted = String(step.valueToFill || '').toLowerCase();
        const option =
          [...target.options].find((o) => o.value.toLowerCase() === wanted) ||
          [...target.options].find((o) => o.text.toLowerCase().includes(wanted));
        if (!option) throw new Error(`no option matching "${step.valueToFill}"`);
        target.value = option.value;
      } else if (target.type === 'checkbox' || target.type === 'radio') {
        target.checked = step.valueToFill !== 'false';
      } else {
        // Without a supplied value we hand control back rather than inventing
        // personal data — this is someone's real form.
        if (!step.valueToFill) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.flash(target);
          this.say('agent', `Please type your ${step.targetText || 'details'} here — I won't guess personal information.`);
          this.stopAutoRun();
          throw new Error('needs-user-input');
        }
        target.value = step.valueToFill;
      }

      // Fire the events frameworks listen for, so React/Vue see the change.
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      this.flash(target);
    }

    advance() {
      this.clearHighlight();

      if (this.stepIndex >= this.plan.steps.length - 1) {
        this.stopAutoRun();
        this.say('agent', this.plan.supportiveMessage || 'That is everything on my list. Nicely done.');
        this.renderPlan();
        return;
      }

      this.stepIndex += 1;
      this.renderPlan();
      this.highlightCurrent();
      this.persist();
    }

    goTo(index) {
      if (!this.plan) return;
      this.stepIndex = Math.max(0, Math.min(this.plan.steps.length - 1, index));
      this.clearHighlight();
      this.renderPlan();
      this.highlightCurrent();
    }

    async startAutoRun() {
      if (!this.plan || this.autoRun) return;
      this.autoRun = true;
      this.renderPlan();

      while (this.autoRun && this.plan && this.stepIndex < this.plan.steps.length) {
        const step = this.currentStep();

        // Auto-run stops dead at anything irreversible.
        if (step.requiresConfirmation) {
          this.stopAutoRun();
          this.say('agent', `Stopping here — "${step.instruction}" needs your confirmation.`);
          this.renderPlan();
          return;
        }

        const before = this.stepIndex;
        await this.execute();
        await new Promise((resolve) => setTimeout(resolve, 900));

        // No forward progress means we are stuck; do not spin.
        if (this.stepIndex === before) break;
      }

      this.stopAutoRun();
    }

    stopAutoRun() {
      this.autoRun = false;
      this.renderPlan();
    }

    /* ------------------------------------------------------------------ */
    /* Target highlighting                                                */
    /* ------------------------------------------------------------------ */

    highlightCurrent() {
      const step = this.currentStep();
      if (!step) return;

      const target = this.resolve(step);
      if (!target) return;

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlighted = target;
      this.paintRing(target);
      this.ringTimer = setInterval(() => this.paintRing(target), 260);
      this.cleanup(() => clearInterval(this.ringTimer));
    }

    /** Ring is drawn in our own shadow layer, so page CSS can't hide it. */
    paintRing(target) {
      if (!target?.isConnected) return;

      const root = UI.host('agent-ring', { layer: 'reading', interactive: false });
      if (!this.ring) {
        const style = document.createElement('style');
        style.textContent = `
          .ring {
            position: fixed; border-radius: 8px; pointer-events: none;
            border: 3px solid var(--accent-2);
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-2) 25%, transparent), 0 0 22px var(--accent-2);
            animation: throb 1.7s ease-in-out infinite;
            transition: top .18s ease, left .18s ease, width .18s ease, height .18s ease;
          }
          @keyframes throb { 0%,100%{opacity:1} 50%{opacity:.55} }
        `;
        root.appendChild(style);
        const scope = document.createElement('div');
        scope.className = 'setu-scope';
        this.ring = document.createElement('div');
        this.ring.className = 'ring';
        scope.appendChild(this.ring);
        root.appendChild(scope);
      }

      const rect = target.getBoundingClientRect();
      Object.assign(this.ring.style, {
        top: `${rect.top - 4}px`,
        left: `${rect.left - 4}px`,
        width: `${rect.width + 8}px`,
        height: `${rect.height + 8}px`,
        display: rect.width ? 'block' : 'none'
      });
    }

    clearHighlight() {
      clearInterval(this.ringTimer);
      UI.destroyHost('agent-ring');
      this.ring = null;
      this.highlighted = null;
    }

    flash(el) {
      const original = el.style.outline;
      el.style.outline = '3px solid #4ade80';
      setTimeout(() => {
        el.style.outline = original;
      }, 900);
    }

    /* ------------------------------------------------------------------ */
    /* Voice                                                              */
    /* ------------------------------------------------------------------ */

    toggleVoice() {
      if (this.recognition) return this.stopVoice();

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) {
        this.say('agent', 'Voice input is not supported in this browser — please type instead.');
        return;
      }

      const recognition = new Recognition();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      const input = this.scope.querySelector('.composer input');
      const micButton = this.scope.querySelector('[data-act="mic"]');
      micButton.dataset.active = 'true';

      recognition.onresult = (event) => {
        const transcript = [...event.results].map((r) => r[0].transcript).join('');
        input.value = transcript;
        if (event.results[event.results.length - 1].isFinal) {
          this.stopVoice();
          this.submit(transcript);
        }
      };
      recognition.onerror = (event) => {
        this.stopVoice();
        if (event.error !== 'aborted') {
          this.say('agent', `I couldn't hear that (${event.error}). Please type your goal.`);
        }
      };
      recognition.onend = () => this.stopVoice();

      this.recognition = recognition;
      recognition.start();
    }

    stopVoice() {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch (_) {
          /* already stopped */
        }
        this.recognition = null;
      }
      const micButton = this.scope?.querySelector('[data-act="mic"]');
      if (micButton) micButton.dataset.active = 'false';
    }

    /* ------------------------------------------------------------------ */
    /* View                                                               */
    /* ------------------------------------------------------------------ */

    say(role, text) {
      this.messages.push({ role, text });
      this.appendMessage(role, text);
    }

    appendMessage(role, text, { silent = false } = {}) {
      const log = this.scope?.querySelector('.log');
      if (!log) return;

      const bubble = document.createElement('div');
      bubble.className = `msg ${role}`;
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;

      if (!silent && role === 'agent') {
        log.setAttribute('aria-busy', 'false');
      }
    }

    setThinking(on) {
      const el = this.scope?.querySelector('.thinking');
      if (el) el.style.display = on ? 'flex' : 'none';
    }

    renderPlan() {
      const wrap = this.scope?.querySelector('.plan');
      if (!wrap) return;

      if (!this.plan?.steps?.length) {
        wrap.innerHTML = '';
        wrap.style.display = 'none';
        return;
      }

      wrap.style.display = 'block';
      const step = this.currentStep();
      const total = this.plan.steps.length;
      const finished = this.stepIndex >= total - 1 && !this.autoRun;

      wrap.innerHTML = `
        <div class="plan-bar"><div class="plan-fill" style="width:${((this.stepIndex + 1) / total) * 100}%"></div></div>
        <div class="plan-head">
          <span>Step ${this.stepIndex + 1} of ${total}</span>
          ${this.autoRun ? '<span class="running">AUTO-RUNNING</span>' : ''}
        </div>
        <ol class="plan-steps">
          ${this.plan.steps
            .map(
              (s, i) => `
            <li class="plan-step" data-index="${i}" data-state="${
                i < this.stepIndex ? 'done' : i === this.stepIndex ? 'current' : 'todo'
              }">
              <span class="dot">${i < this.stepIndex ? '✓' : i + 1}</span>
              <span class="plan-text">${Text.escape(s.instruction)}${
                s.requiresConfirmation ? '<em class="warn">needs confirmation</em>' : ''
              }</span>
            </li>`
            )
            .join('')}
        </ol>
        ${step?.tip ? `<p class="tip">${Text.escape(step.tip)}</p>` : ''}
        <div class="plan-acts">
          <button class="setu-btn" data-act="prev" ${this.stepIndex === 0 ? 'disabled' : ''}>Back</button>
          ${
            step?.requiresConfirmation
              ? `<button class="setu-btn" data-variant="danger" data-act="confirm">Confirm &amp; do it</button>`
              : `<button class="setu-btn" data-variant="primary" data-act="do" ${finished ? 'disabled' : ''}>Do this step</button>`
          }
          <button class="setu-btn" data-act="auto">${this.autoRun ? 'Pause' : 'Auto-run'}</button>
          <button class="setu-btn" data-act="skip" ${finished ? 'disabled' : ''}>Skip</button>
        </div>
      `;

      wrap.querySelectorAll('.plan-step').forEach((el) => {
        el.onclick = () => this.goTo(Number(el.dataset.index));
      });

      const act = (name, fn) => {
        const el = wrap.querySelector(`[data-act="${name}"]`);
        if (el) el.onclick = fn;
      };
      act('prev', () => this.goTo(this.stepIndex - 1));
      act('do', () => this.execute());
      act('confirm', () => this.execute({ confirmed: true }));
      act('skip', () => this.advance());
      act('auto', () => (this.autoRun ? this.stopAutoRun() : this.startAutoRun()));
    }

    build() {
      const root = UI.host('commander', { layer: 'panel', interactive: true });
      root.appendChild(this.styles());

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="dock" role="dialog" aria-label="SETU Commander">
          <header class="head">
            <div class="id">
              <span class="pulse"></span>
              <div>
                <strong>SETU Commander</strong>
                <small>Tell me what you want to do on this page</small>
              </div>
            </div>
            <button class="x" data-act="close" aria-label="Close Commander">×</button>
          </header>

          <div class="log" role="log" aria-live="polite"></div>
          <div class="thinking"><span></span><span></span><span></span></div>
          <div class="plan" style="display:none"></div>

          <div class="composer">
            <input type="text" placeholder="e.g. find the login button, summarise this page…" aria-label="Your goal" />
            <button data-act="mic" data-active="false" aria-label="Speak your goal" title="Speak">🎤</button>
            <button data-act="send" data-variant="primary" aria-label="Send">↑</button>
          </div>
          <div class="quick">
            <button data-goal="Summarise this page for me">Summarise</button>
            <button data-goal="Break this page into simple steps">Break it down</button>
            <button data-goal="Find the main action button on this page">Find the button</button>
          </div>
        </div>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.dock = scope.querySelector('.dock');

      const input = scope.querySelector('.composer input');
      const send = () => {
        const value = input.value;
        input.value = '';
        this.submit(value);
      };

      scope.querySelector('[data-act="send"]').onclick = send;
      scope.querySelector('[data-act="mic"]').onclick = () => this.toggleVoice();
      scope.querySelector('[data-act="close"]').onclick = () => this.disable();
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          send();
        }
      };
      scope.querySelectorAll('.quick button').forEach((btn) => {
        btn.onclick = () => this.submit(btn.dataset.goal);
      });

      this.say('agent', "Tell me what you'd like to do on this page and I'll walk you through it.");
    }

    styles() {
      const style = document.createElement('style');
      style.textContent = `
        .dock {
          position: fixed; right: 20px; bottom: 20px;
          width: min(388px, calc(100vw - 32px)); max-height: min(680px, calc(100vh - 40px));
          display: flex; flex-direction: column;
          background: var(--bg-soft); border: 1px solid var(--border);
          border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; pointer-events: auto;
        }
        .head { display:flex; align-items:center; justify-content:space-between; gap:10px;
                padding:14px 16px; border-bottom:1px solid var(--border); }
        .id { display:flex; align-items:center; gap:10px; }
        .id strong { display:block; font-size:14px; }
        .id small { display:block; font-size:11.5px; color:var(--text-dim); }
        .pulse { width:9px; height:9px; border-radius:50%; background:var(--accent-2);
                 box-shadow:0 0 9px var(--accent-2); animation:throb 2.2s ease-in-out infinite; }
        @keyframes throb { 0%,100%{opacity:1} 50%{opacity:.4} }
        .x { background:none; border:none; color:var(--text-dim); font-size:19px; cursor:pointer; line-height:1; }
        .x:hover { color:var(--danger); }

        .log { flex:1; min-height:120px; max-height:250px; overflow-y:auto;
               padding:14px 16px; display:flex; flex-direction:column; gap:9px; }
        .msg { max-width:88%; padding:9px 13px; border-radius:13px; font-size:13.2px; line-height:1.55; white-space:pre-wrap; }
        .msg.agent { align-self:flex-start; background:var(--surface); border:1px solid var(--border); border-bottom-left-radius:5px; }
        .msg.user  { align-self:flex-end; background:var(--accent); color:#0b1020; font-weight:500; border-bottom-right-radius:5px; }

        .thinking { display:none; gap:4px; padding:0 20px 10px; }
        .thinking span { width:6px; height:6px; border-radius:50%; background:var(--text-dim); animation:bounce 1.3s ease-in-out infinite; }
        .thinking span:nth-child(2){ animation-delay:.18s } .thinking span:nth-child(3){ animation-delay:.36s }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }

        .plan { border-top:1px solid var(--border); padding:13px 16px; max-height:290px; overflow-y:auto; }
        .plan-bar { height:3px; background:var(--surface); border-radius:2px; overflow:hidden; margin-bottom:10px; }
        .plan-fill { height:100%; background:var(--accent-2); transition:width .3s ease; }
        .plan-head { display:flex; justify-content:space-between; align-items:center;
                     font-size:11px; font-weight:700; letter-spacing:.05em; color:var(--text-dim); margin-bottom:9px; }
        .running { color:var(--accent-2); }
        .plan-steps { list-style:none; display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
        .plan-step { display:flex; gap:9px; align-items:flex-start; padding:7px 9px; border-radius:9px; cursor:pointer; }
        .plan-step:hover { background:rgba(255,255,255,.05); }
        .plan-step[data-state="current"] { background:rgba(124,140,255,.14); border:1px solid var(--accent); }
        .plan-step[data-state="done"] { opacity:.5; }
        .dot { flex-shrink:0; width:19px; height:19px; border-radius:50%; background:var(--surface);
               border:1px solid var(--border); font-size:10.5px; font-weight:800; display:grid; place-items:center; }
        .plan-step[data-state="done"] .dot { background:var(--accent-2); color:#0b1020; border-color:var(--accent-2); }
        .plan-step[data-state="current"] .dot { background:var(--accent); color:#0b1020; border-color:var(--accent); }
        .plan-text { font-size:12.8px; line-height:1.5; }
        .warn { display:block; font-size:10.5px; color:var(--warn); font-style:normal; font-weight:700; margin-top:2px; }
        .tip { font-size:11.8px; color:var(--text-dim); font-style:italic; margin-bottom:10px; line-height:1.5; }
        .plan-acts { display:flex; gap:6px; flex-wrap:wrap; }
        .plan-acts .setu-btn { flex:1; min-width:78px; min-height:32px; font-size:12px; padding:6px 9px; }

        .composer { display:flex; gap:7px; padding:12px 14px; border-top:1px solid var(--border); }
        .composer input {
          flex:1; padding:10px 13px; background:var(--surface); color:var(--text);
          border:1px solid var(--border); border-radius:10px; font-size:13px;
        }
        .composer input:focus { outline:none; border-color:var(--accent); }
        .composer button {
          width:38px; border-radius:10px; background:var(--surface);
          border:1px solid var(--border); color:var(--text); cursor:pointer; font-size:14px;
        }
        .composer button:hover { border-color:var(--accent); }
        .composer button[data-variant="primary"] { background:var(--accent); border-color:var(--accent); color:#0b1020; font-weight:800; }
        .composer button[data-active="true"] { background:var(--danger); border-color:var(--danger); }

        .quick { display:flex; gap:6px; padding:0 14px 13px; flex-wrap:wrap; }
        .quick button {
          background:transparent; border:1px solid var(--border); color:var(--text-dim);
          border-radius:999px; padding:5px 11px; font-size:11.5px; cursor:pointer;
        }
        .quick button:hover { border-color:var(--accent); color:var(--text); }
      `;
      return style;
    }
  }

  window.SETU.features.set('commander', Commander);
})();
