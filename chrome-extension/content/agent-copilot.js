/**
 * SETU Commander — the in-page AI agent.
 *
 * The user states a goal in words (typed or spoken), the engine reads the live
 * page, and the answer comes back as either a plain-language reply or a plan
 * whose steps are executed against the real DOM.
 *
 * Three constraints shape everything here.
 *
 * Safety. This runs on every site, including banking and government portals:
 *   - The agent may only target controls it was actually shown.
 *   - Steps flagged `requiresConfirmation` (submit, pay, delete, send) never
 *     fire automatically — not even during Auto-Run. The run pauses and waits
 *     for a deliberate click.
 *   - Nothing is auto-filled with invented personal data.
 *   - Auto-Run never resumes by itself across a page load. Automation that
 *     restarts unattended on a page nobody has looked at is a different and
 *     much worse thing than automation the user is watching.
 *
 * Survival. A click can navigate, a form can reload the page, a site can
 * refresh itself mid-task. The whole session — conversation, plan, position,
 * panel geometry — is mirrored into sessionStorage on every change and
 * restored on the next load, so the panel comes back exactly where it was
 * instead of vanishing at the moment it was being relied on. Only an explicit
 * close ends a session.
 *
 * Latency. The planner runs on free-tier models that take 30-45 seconds cold,
 * and the engine itself sleeps on a free host and needs up to a minute to wake.
 * So the wait is always narrated — real stages, elapsed seconds, a note when it
 * is long enough to mean the engine was asleep — and always cancellable.
 */

(() => {
  const { Feature, UI, API, Text, Store, Page, Dock, Scroll, Session, icon } = window.SETU;

  /** Per-tab in sessionStorage; per-tab in the local mirror too, via Session.key. */
  const SESSION_KEY = 'setu_agent_session';

  /** Label patterns that mean "this control does something you can't undo". */
  const IRREVERSIBLE_LABEL =
    /\b(submit|pay|purchase|buy|checkout|order|confirm|delete|remove|send|transfer|withdraw|deposit|apply now|sign up|register|book now|place order|unsubscribe|deactivate|close account)\b/i;

  /**
   * Goals that want an answer, not an action.
   *
   * Routing these to the planner produced a one-step plan that said "read the
   * page" — technically a plan, useless as an answer. They go to the explainer
   * instead, which is also markedly faster.
   */
  const QUESTION_INTENT =
    /^(summari[sz]e|explain|what|why|how|who|when|where|tell me|describe|is |are |does |do |can )/i;

  const MAX_AUTORUN_STEPS = 24;

  /** Panel geometry. Spacious design tailored for cognitive accessibility and legible reading. */
  const MIN_WIDTH = 440;
  const MAX_WIDTH = 880;
  const DEFAULT_WIDTH = 620;

  class Commander extends Feature {
    static key = 'commander';

    constructor() {
      super();
      this.plan = null;
      this.stepIndex = 0;
      this.finished = false;
      this.autoRun = false;
      this.autoRunInterrupted = false;
      this.busy = false;
      this.messages = [];
      this.lastGoal = '';
      this.controller = null;
      this.recognition = null;
      this.minimised = false;
      this.geometry = null;
      this.width = DEFAULT_WIDTH;
      this.stopSpotlight = null;
      this.releaseDock = null;
    }

    onEnable() {
      this.build();
      this.trackSelection();
      this.restore();

      // Nudge a sleeping engine awake while the user is still typing. The
      // free host takes 30-60 seconds to come back, and overlapping that with
      // the time somebody spends composing a goal removes it from their
      // first request entirely.
      API.warm();

      // A reload or navigation can happen at any moment, including mid-action.
      this.listen(window, 'beforeunload', () => this.persist());
      this.listen(window, 'pagehide', () => this.persist());
      this.listen(document, 'visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.persist();
      });
    }

    onDisable() {
      this.cancelRequest();
      this.autoRun = false;
      this.clearHighlight();
      this.stopVoice();
      this.releaseDock?.();
      this.releaseDock = null;
      // An explicit close by the user ends the session; a navigation or reload does not.
      this.clearSession();
      UI.destroyHost('commander');
      this.scope = null;
      this.dock = null;
    }

    open(initial = '') {
      if (!this.enabled) {
        this.enable()
          .then(() => this.open(initial))
          .catch((error) => UI.toast(error.message, { tone: 'error' }));
        return;
      }

      this.setMinimised(false);
      const input = this.scope?.querySelector('.composer input');
      if (!input) return;
      if (initial) input.value = initial;
      input.focus();
      input.select?.();
    }

    /* ------------------------------------------------------------------ */
    /* Session continuity                                                 */
    /* ------------------------------------------------------------------ */

    /**
     * Everything needed to put the panel back exactly as it was.
     * Written on every change and state progression into both sessionStorage and
     * chrome.storage.local, so the agent stays open and active across page reloads,
     * navigations, and redirects.
     */
    persist({ stepIndex = this.stepIndex } = {}) {
      if (!this.enabled) return;
      const data = {
        open: true,
        active: true,
        plan: this.plan,
        stepIndex,
        finished: this.finished,
        lastGoal: this.lastGoal,
        autoRunInterrupted: this.autoRun || this.autoRunInterrupted,
        autoRun: this.autoRun,
        minimised: this.minimised,
        geometry: this.geometry,
        width: this.width,
        messages: this.messages.slice(-30),
        savedAt: Date.now()
      };

      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } catch (_) {
        /* storage full or blocked */
      }

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          chrome.storage.local.set({ [Session.key]: data });
        } catch (_) {
          /* ignore */
        }
      }
    }

    clearSession() {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch (_) {
        /* ignore */
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          chrome.storage.local.remove(Session.key);
        } catch (_) {
          /* ignore */
        }
      }
    }

    /**
     * Restore after a reload or a navigation.
     *
     * Seamlessly re-inflates the exact transcript, plan, current step, geometry, and width.
     */
    async restore() {
      let saved = null;
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (_) {
        /* ignore */
      }

      // Falls back to the local mirror only when sessionStorage is blocked.
      // Session.key is scoped to this tab, so another tab's plan can never be
      // restored onto this page.
      if (!saved && typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          const res = await new Promise((resolve) => {
            chrome.storage.local.get(Session.key, resolve);
          });
          const stored = res?.[Session.key];
          if (stored) saved = typeof stored === 'string' ? JSON.parse(stored) : stored;
        } catch (_) {
          /* ignore */
        }
      }

      if (!saved?.open) return;

      // Ignore stale sessions older than 2 hours
      if (saved.savedAt && (Date.now() - saved.savedAt > 7200000)) {
        this.clearSession();
        return;
      }

      this.width = Number(saved.width) || DEFAULT_WIDTH;
      this.geometry = saved.geometry || null;
      this.applyGeometry();
      this.setMinimised(Boolean(saved.minimised));

      this.lastGoal = saved.lastGoal || '';

      if (Array.isArray(saved.messages) && saved.messages.length) {
        this.clearLog();
        this.messages = saved.messages;
        this.messages.forEach((m) => this.appendMessage(m.role, m.text, m.options || {}));
      }

      if (saved.plan?.steps?.length) {
        this.plan = saved.plan;
        this.finished = Boolean(saved.finished);
        this.stepIndex = Math.min(saved.stepIndex || 0, saved.plan.steps.length - 1);
        this.autoRunInterrupted = Boolean(saved.autoRunInterrupted);

        this.say(
          'agent',
          this.autoRunInterrupted
            ? `The page refreshed while I was working. I've kept your plan and stopped at step ${this.stepIndex + 1} of ${this.plan.steps.length} — press Continue or 'Do this step' when you're ready.`
            : `Still here — plan active on step ${this.stepIndex + 1} of ${this.plan.steps.length}.`
        );

        this.renderPlan();
        setTimeout(() => {
          this.highlightCurrent();
        }, 300);
      } else {
        this.say('agent', 'Still here — page refreshed with your session preserved.');
      }
    }

    /* ------------------------------------------------------------------ */
    /* Page snapshot                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Describe the page to the model as a list of addressable controls.
     *
     * Delegated to the shared snapshot in setu-core. Two things came out of
     * moving it there, and both were real bugs. It descends open shadow roots,
     * so the agent now sees the controls on the large share of the modern web
     * that builds them as web components — on those sites it used to report
     * that a visibly button-covered page had no controls at all. And it hands
     * out in-memory handles instead of writing `data-setu-ref` attributes onto
     * the page, so opening the 3-step path mid-plan no longer wipes the
     * agent's targets out from under it.
     */
    snapshot(options) {
      return Page.snapshot(options);
    }

    resolve(step) {
      return Page.resolve(step);
    }

    /**
     * Remember the page text the user had highlighted.
     *
     * Reading it at the moment they ask is too late: clicking into the composer,
     * or on a suggestion chip, collapses the document selection first — so
     * "explain this" about a highlighted paragraph would silently become
     * "explain the whole page".
     */
    trackSelection() {
      this.heldSelection = Text.selection();

      this.listen(document, 'selectionchange', () => {
        const selection = document.getSelection();
        const anchor = selection?.anchorNode;
        if (anchor && Text.isOurs(anchor)) return; // our own composer

        const text = String(selection || '').trim();
        if (text.length > 1) this.heldSelection = text;
      });
    }

    /* ------------------------------------------------------------------ */
    /* Conversation                                                       */
    /* ------------------------------------------------------------------ */

    async submit(text) {
      const goal = String(text || '').trim();
      if (!goal || this.busy) return;

      this.lastGoal = goal;
      this.say('user', goal);
      await this.run(goal);
    }

    /** Re-issue the last goal after a failure, without retyping it. */
    retry() {
      if (this.lastGoal && !this.busy) this.run(this.lastGoal);
    }

    async run(goal) {
      this.busy = true;
      this.controller = new AbortController();

      const asking = QUESTION_INTENT.test(goal);
      this.startStages(
        asking
          ? ['Reading this page', 'Asking the engine', 'Writing it plainly']
          : ['Reading this page', 'Asking the engine', 'Checking every step']
      );

      try {
        if (asking) await this.answer(goal);
        else await this.planFor(goal);
      } catch (error) {
        this.reportFailure(error);
      } finally {
        this.busy = false;
        this.controller = null;
        this.stopStages();
        this.persist();
      }
    }

    /**
     * Answer a question about the page in plain language.
     *
     * Uses the selection when there is one: "explain this" while text is
     * highlighted should be about that text, not the whole document.
     *
     * Streamed, and rendered as it arrives. The engine runs on free models
     * that take twenty to forty seconds to finish a paragraph and about a
     * second to start one; waiting for the whole answer spent that entire
     * difference on a spinner. Everything else in this method — the stage
     * labels, the elapsed counter — exists to make a wait legible. Streaming
     * removes most of the wait instead.
     */
    async answer(goal) {
      const selection = Text.selection() || this.heldSelection || '';
      const source = selection || Text.pageText(6000);

      if (!source) {
        this.say('agent', "There isn't enough readable text on this page for me to work from.");
        return;
      }

      if (selection) {
        this.say('agent', `Working from the ${selection.length} characters you highlighted.`);
      }

      this.setStage(1);

      const payload = {
        text: `${goal}\n\n---\n${selection ? 'SELECTED TEXT' : 'PAGE CONTENT'}:\n${source}`,
        language: Store.getSetting('language') || 'English'
      };

      // The bubble is created empty and filled in place, so the first words
      // land on screen the moment the model produces them.
      let bubble = null;
      let streamed = '';

      try {
        streamed = await API.stream('/api/agent/explain/stream', payload, {
          signal: this.controller.signal,
          onChunk: (_chunk, whole) => {
            if (!bubble) {
              this.stopStages();
              bubble = this.beginStreamedMessage();
            }
            this.updateStreamedMessage(bubble, whole);
          }
        });
      } catch (error) {
        if (error.name === 'AbortError') throw error;

        // Streaming failed outright — an old engine build with no SSE route,
        // a proxy that buffers, a dropped connection. The buffered endpoint is
        // slower but is not going anywhere.
        console.warn('[SETU:agent] stream unavailable, falling back to buffered:', error.message);
        this.setStage(1);
        const { explanation, fallback } = await API.post('/api/agent/explain', payload, {
          signal: this.controller.signal,
          timeoutMs: window.SETU.DEFAULTS.fastTimeoutMs
        });

        this.setStage(2);
        this.say('agent', String(explanation || '').trim() || "I couldn't summarise that.", {
          speakable: true
        });
        if (fallback) {
          this.say('agent', 'Note: the AI engine was unavailable, so that was a basic local summary.');
        }
        return;
      }

      this.setStage(2);

      const finalText = String(streamed || '').trim();
      if (!finalText) {
        this.say('agent', "I couldn't summarise that.");
        return;
      }

      if (bubble) {
        // Commit the streamed bubble into the transcript so it survives a
        // reload with the rest of the conversation.
        this.finishStreamedMessage(bubble, finalText);
      } else {
        this.say('agent', finalText, { speakable: true });
      }
    }

    /* ------------------------------------------------------------------ */
    /* Streamed message rendering                                         */
    /* ------------------------------------------------------------------ */

    /** An agent bubble that will be filled in as tokens arrive. */
    beginStreamedMessage() {
      const log = this.scope?.querySelector('.log');
      if (!log) return null;

      const turn = document.createElement('div');
      turn.className = 'msg agent streaming';

      const body = document.createElement('div');
      body.className = 'msg-text';
      turn.appendChild(body);

      log.appendChild(turn);
      log.scrollTop = log.scrollHeight;
      return turn;
    }

    updateStreamedMessage(turn, text) {
      if (!turn) return;
      const body = turn.querySelector('.msg-text');
      if (!body) return;

      body.textContent = text;

      // Follow the text only while the reader is already at the bottom.
      // Yanking the transcript down while they are reading something further
      // up is the single most irritating thing a streaming panel can do.
      const log = this.scope?.querySelector('.log');
      if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 90) {
        log.scrollTop = log.scrollHeight;
      }
    }

    finishStreamedMessage(turn, text) {
      turn?.classList.remove('streaming');

      // Record it without re-rendering: the bubble is already on screen.
      this.messages.push({ role: 'agent', text, options: { speakable: true } });
      this.persist();

      if (!turn) return;
      const actions = document.createElement('div');
      actions.className = 'msg-acts';

      const speak = document.createElement('button');
      speak.type = 'button';
      speak.innerHTML = `${icon('speaker-high', { size: 14 })}Read aloud`;
      speak.onclick = () => window.setuLens?.speak(text);
      actions.appendChild(speak);

      turn.appendChild(actions);
    }

    async planFor(goal) {
      const pageContext = this.snapshot();

      let plan;
      try {
        this.setStage(1);
        plan = await API.post(
          '/api/agent/plan',
          { task: goal, pageContext },
          { signal: this.controller.signal }
        );
        this.setStage(2);
      } catch (error) {
        if (error.name === 'AbortError') throw error;

        // The engine is unreachable. A keyword plan built from the snapshot is
        // far less clever, but it still points at the right button — which is
        // most of what someone stuck on a page actually needs.
        const local = this.localPlan(goal, pageContext);
        if (!local) throw error;

        this.say('agent', `I can't reach the SETU engine (${error.message}) — here's what I can see myself.`);
        plan = local;
      }

      if (!plan.feasible) {
        this.say('agent', plan.blockedReason || "I can't do that from this page.");
        this.plan = null;
        this.renderPlan();
        return;
      }

      if (!plan.steps?.length) {
        this.say('agent', "I couldn't find the controls needed for that on this page.");
        this.plan = null;
        this.renderPlan();
        return;
      }

      this.plan = plan;
      this.stepIndex = 0;
      this.finished = false;
      this.autoRunInterrupted = false;
      this.say('agent', plan.understanding || `Here's my plan for "${goal}".`);
      if (plan.fallback) {
        this.say(
          'agent',
          `Note: the AI engine was unreachable${plan.fallbackReason ? ` (${plan.fallbackReason})` : ''}, so this is a basic plan.`
        );
      }
      this.renderPlan();
      this.highlightCurrent();
    }

    /**
     * A deterministic plan built entirely in the page, for when the engine is
     * down. Matches the goal's words against the control labels we can see.
     */
    localPlan(goal, pageContext) {
      const words = goal
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !/^(the|and|for|this|that|with|from|into|please|help|find|click|show)$/.test(word)
        );

      if (!words.length) return null;

      const scored = pageContext.controls
        .map((control) => {
          const label = control.label.toLowerCase();
          const score = words.reduce((sum, word) => sum + (label.includes(word) ? word.length : 0), 0);
          return { control, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (!scored.length) return null;

      const steps = scored.map(({ control }, index) => {
        const isField = ['input', 'textarea', 'select'].includes(control.tag);
        return {
          stepNumber: index + 1,
          instruction: isField ? `Fill in "${control.label}".` : `Go to "${control.label}".`,
          actionType: isField ? 'fill' : 'click',
          targetRef: control.ref,
          targetText: control.label,
          valueToFill: '',
          tip: 'Matched by name from what is on screen — check it is the right one.',
          // The same safety gate the engine applies, so an offline plan is not
          // a way around confirmation.
          requiresConfirmation: IRREVERSIBLE_LABEL.test(control.label) || control.type === 'submit'
        };
      });

      return {
        goal,
        understanding: `I found ${steps.length} thing${steps.length === 1 ? '' : 's'} on this page matching "${goal}".`,
        feasible: true,
        blockedReason: '',
        steps,
        supportiveMessage: 'That is everything I could match without the engine.',
        fallback: true,
        fallbackReason: 'engine offline'
      };
    }

    reportFailure(error) {
      if (error.name === 'AbortError') {
        this.say('agent', 'Stopped. Ask me again whenever you are ready.');
        return;
      }

      const guidance = {
        offline: 'Open SETU settings and check the engine URL, or start your own backend.',
        timeout:
          'The engine is on a free host that sleeps when idle, and free AI models are slow when cold. Trying again usually works.',
        'rate-limited': 'Give it a minute — the AI quota needs a moment to recover.',
        unavailable: 'The engine is running but has no AI provider configured.',
        server: 'The engine hit an internal error.'
      }[error.code];

      this.say('agent', guidance ? `${error.message}\n\n${guidance}` : error.message, { retry: true });
    }

    cancelRequest() {
      this.controller?.abort();
      this.controller = null;
    }

    /* ------------------------------------------------------------------ */
    /* Execution                                                          */
    /* ------------------------------------------------------------------ */

    currentStep() {
      return this.plan?.steps?.[this.stepIndex] || null;
    }

    /**
     * Execute the current step.
     * @param {boolean} confirmed set only by an explicit user click on a step
     *   the backend flagged as irreversible.
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

      // `read` needs its target resolved so it can be scrolled to; only these
      // two genuinely need nothing from the page.
      const targetless = ['scroll', 'wait'];
      const needsTarget = !targetless.includes(step.actionType);
      const target = needsTarget ? this.resolve(step) : null;

      if (needsTarget && !target) {
        this.say(
          'agent',
          `I couldn't find "${step.targetText || step.instruction}" on the page any more. It may have moved — try Skip, or ask me again so I can re-read the page.`
        );
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
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.flash(target);
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
            // A click can navigate away and tear down this whole context, so
            // the resume point is written *before* the click — and it points at
            // the next step, because this one is about to be done.
            this.persist({ stepIndex: Math.min(this.stepIndex + 1, this.plan.steps.length - 1) });
            target.click();
            // Still here, so it was an in-page click: advance for real.
            await new Promise((resolve) => setTimeout(resolve, 150));
            break;
        }

        this.advance();
      } catch (error) {
        if (error.message !== 'needs-user-input') {
          this.say('agent', `That step didn't work: ${error.message}`);
        }
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
          this.say(
            'agent',
            `Please type your ${step.targetText || 'details'} here — I won't guess personal information. Press "Done, next step" when you have.`
          );
          this.stopAutoRun();
          this.renderPlan({ awaitingInput: true });
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
        this.finished = true;
        this.say('agent', this.plan.supportiveMessage || 'That is everything on my list. Nicely done.');
        this.renderPlan();
        this.persist();
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
      this.finished = false;
      this.clearHighlight();
      this.renderPlan();
      this.highlightCurrent();
      this.persist();
    }

    async startAutoRun() {
      if (!this.plan || this.autoRun) return;
      this.autoRun = true;
      this.autoRunInterrupted = false;
      this.renderPlan();

      let guard = 0;
      while (this.autoRun && this.plan && this.stepIndex < this.plan.steps.length) {
        if ((guard += 1) > MAX_AUTORUN_STEPS) break;

        const step = this.currentStep();
        if (!step) break;

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
      if (!this.autoRun) return;
      this.autoRun = false;
      this.renderPlan();
      this.persist();
    }

    /* ------------------------------------------------------------------ */
    /* Target highlighting                                                */
    /* ------------------------------------------------------------------ */

    highlightCurrent() {
      const step = this.currentStep();
      if (!step || this.finished) return;

      const target = this.resolve(step);
      if (!target) return;

      // Through the arbiter, so the target is brought into view on the Focus
      // Mode reader when that is open rather than behind it.
      Scroll.into(target, { block: 'center' });
      this.clearHighlight();
      this.stopSpotlight = UI.spotlight(target);
    }

    clearHighlight() {
      this.stopSpotlight?.();
      this.stopSpotlight = null;
    }

    flash(el) {
      const original = el.style.outline;
      el.style.outline = '3px solid #0088b0';
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
      micButton.setAttribute('aria-label', 'Stop listening');

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
        if (event.error === 'not-allowed') {
          this.say(
            'agent',
            'Microphone access is blocked for this site. Allow it in the address bar, or type instead.'
          );
        } else if (event.error !== 'aborted') {
          this.say('agent', `I couldn't hear that (${event.error}). Please type your goal.`);
        }
      };
      recognition.onend = () => this.stopVoice();

      this.recognition = recognition;
      try {
        recognition.start();
      } catch (_) {
        this.stopVoice();
      }
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
      if (micButton) {
        micButton.dataset.active = 'false';
        micButton.setAttribute('aria-label', 'Speak your goal');
      }
    }

    /* ------------------------------------------------------------------ */
    /* Transcript                                                         */
    /* ------------------------------------------------------------------ */

    say(role, text, options = {}) {
      this.messages.push({ role, text, options });
      this.appendMessage(role, text, options);
      this.persist();
    }

    clearLog() {
      const log = this.scope?.querySelector('.log');
      if (log) log.innerHTML = '';
      this.messages = [];
    }

    /**
     * User turns are cyan bubbles; the agent's are plain prose.
     *
     * That asymmetry is deliberate and comes from the design system: the
     * assistant is the page talking, not a chat partner, and wrapping its
     * answers in bubbles made a reading aid look like a messaging app.
     */
    appendMessage(role, text, { retry = false, speakable = false } = {}) {
      const log = this.scope?.querySelector('.log');
      if (!log) return;

      const turn = document.createElement('div');
      turn.className = `msg ${role}`;

      const body = document.createElement('div');
      body.className = 'msg-text';
      body.textContent = text;
      turn.appendChild(body);

      if (retry || speakable) {
        const actions = document.createElement('div');
        actions.className = 'msg-acts';

        if (retry) {
          const button = document.createElement('button');
          button.type = 'button';
          button.innerHTML = `${icon('arrow-counter-clockwise', { size: 14 })}Try again`;
          button.onclick = () => this.retry();
          actions.appendChild(button);
        }
        if (speakable) {
          const button = document.createElement('button');
          button.type = 'button';
          button.innerHTML = `${icon('speaker-high', { size: 14 })}Read aloud`;
          button.onclick = () => window.setuLens?.speak(text);
          actions.appendChild(button);
        }
        turn.appendChild(actions);
      }

      log.appendChild(turn);
      log.scrollTop = log.scrollHeight;
    }

    /* ------------------------------------------------------------------ */
    /* Staged progress                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * Three named stages, never a spinner.
     *
     * The stages track real events — page read, request in flight, response
     * being turned into a plan — rather than a fake progress bar. The elapsed
     * counter sits on whichever stage is live, and past ~15 seconds it says why
     * it is slow, because that is exactly when a person starts to assume the
     * thing is broken.
     */
    startStages(labels) {
      this.stageLabels = labels;
      this.stageIndex = 0;
      this.stageStartedAt = Date.now();

      const wrap = this.scope?.querySelector('.stages');
      if (!wrap) return;

      wrap.innerHTML = `
        <ol class="stage-list">
          ${labels
            .map(
              (label, index) => `
            <li class="stage" data-index="${index}" data-state="${index === 0 ? 'active' : 'todo'}">
              <span class="stage-icon">${icon(['book-open', 'tree-structure', 'pen-nib'][index] || 'book-open', { size: 16 })}</span>
              <span class="stage-label">${Text.escape(label)}</span>
              <span class="stage-time"></span>
            </li>`
            )
            .join('')}
        </ol>
        <p class="stage-note"></p>
        <button class="setu-btn" data-act="cancel">${icon('x', { size: 15 })}Cancel</button>
      `;
      wrap.dataset.show = 'true';
      wrap.querySelector('[data-act="cancel"]').onclick = () => this.cancelRequest();

      this.paintStages();
      this.every('stages', 1000, () => this.paintStages());
    }

    setStage(index) {
      this.stageIndex = index;
      this.paintStages();
    }

    paintStages() {
      const wrap = this.scope?.querySelector('.stages');
      if (!wrap || wrap.dataset.show !== 'true') return;

      const seconds = Math.round((Date.now() - this.stageStartedAt) / 1000);

      wrap.querySelectorAll('.stage').forEach((el) => {
        const index = Number(el.dataset.index);
        el.dataset.state = index < this.stageIndex ? 'done' : index === this.stageIndex ? 'active' : 'todo';
        el.querySelector('.stage-time').textContent =
          index === this.stageIndex && seconds > 2 ? `${seconds}s` : '';
      });

      const note = wrap.querySelector('.stage-note');
      if (note) {
        note.textContent =
          seconds > 15
            ? 'Taking a while — the engine sleeps when it is idle, and free AI models are slow when cold. It is still working.'
            : '';
      }
    }

    stopStages() {
      this.clearEvery('stages');
      const wrap = this.scope?.querySelector('.stages');
      if (wrap) {
        wrap.dataset.show = 'false';
        wrap.innerHTML = '';
      }
    }

    /* ------------------------------------------------------------------ */
    /* Plan view                                                          */
    /* ------------------------------------------------------------------ */

    renderPlan({ awaitingInput = false } = {}) {
      const wrap = this.scope?.querySelector('.plan');
      if (!wrap) return;

      if (!this.plan?.steps?.length) {
        wrap.innerHTML = '';
        wrap.dataset.show = 'false';
        return;
      }

      wrap.dataset.show = 'true';
      const step = this.currentStep();
      const total = this.plan.steps.length;
      const done = Boolean(this.finished);
      const progress = done ? 100 : ((this.stepIndex + 1) / total) * 100;

      wrap.innerHTML = `
        <div class="plan-bar"><div class="plan-fill" style="width:${progress}%"></div></div>
        <div class="plan-head">
          <span class="setu-kicker">${done ? 'Plan complete' : `Step ${this.stepIndex + 1} of ${total}`}</span>
          ${this.autoRun ? '<span class="setu-tag" data-tone="accent">Auto-running</span>' : ''}
          ${this.autoRunInterrupted && !this.autoRun ? '<span class="setu-tag">Paused by the page</span>' : ''}
        </div>
        <ol class="plan-steps">
          ${this.plan.steps
            .map((s, i) => {
              const state = done || i < this.stepIndex ? 'done' : i === this.stepIndex ? 'current' : 'todo';
              return `
            <li class="plan-step" data-index="${i}" tabindex="0" data-state="${state}">
              <span class="dot">${state === 'done' ? icon('check', { size: 12 }) : i + 1}</span>
              <span class="plan-text">${Text.escape(s.instruction)}${
                s.requiresConfirmation
                  ? `<em class="warn">${icon('warning', { size: 12 })}needs your confirmation</em>`
                  : ''
              }</span>
            </li>`;
            })
            .join('')}
        </ol>
        ${step?.tip && !done ? `<p class="tip">${Text.escape(step.tip)}</p>` : ''}
        <div class="plan-acts">
          <button class="setu-btn" data-act="prev" ${this.stepIndex === 0 ? 'disabled' : ''}>Back</button>
          ${
            done
              ? `<button class="setu-btn" data-act="restart">${icon('arrow-counter-clockwise', { size: 15 })}Start over</button>`
              : step?.requiresConfirmation
                ? `<button class="setu-btn" data-variant="danger" data-act="confirm">${icon('warning', { size: 15 })}Confirm &amp; do it</button>`
                : `<button class="setu-btn" data-variant="primary" data-act="do">${
                    awaitingInput ? 'Done, next step' : 'Do this step'
                  }</button>`
          }
          <button class="setu-btn" data-act="auto" ${done ? 'disabled' : ''}>${
            this.autoRun ? 'Pause' : this.autoRunInterrupted ? 'Continue' : 'Auto-run'
          }</button>
          <button class="setu-btn" data-act="skip" ${done ? 'disabled' : ''}>Skip</button>
        </div>
      `;

      wrap.querySelectorAll('.plan-step').forEach((el) => {
        const jump = () => this.goTo(Number(el.dataset.index));
        el.onclick = jump;
        el.onkeydown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            jump();
          }
        };
      });

      const act = (name, fn) => {
        const el = wrap.querySelector(`[data-act="${name}"]`);
        if (el) el.onclick = fn;
      };
      act('prev', () => this.goTo(this.stepIndex - 1));
      act('do', () => (awaitingInput ? this.advance() : this.execute()));
      act('confirm', () => this.execute({ confirmed: true }));
      act('skip', () => this.advance());
      act('restart', () => this.goTo(0));
      act('auto', () => (this.autoRun ? this.stopAutoRun() : this.startAutoRun()));
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                              */
    /* ------------------------------------------------------------------ */

    setMinimised(next) {
      this.minimised = next;
      if (this.dock) this.dock.dataset.minimised = String(next);

      const button = this.scope?.querySelector('[data-act="minimise"]');
      if (button) {
        button.innerHTML = icon(next ? 'arrows-out' : 'minus', { size: 16 });
        button.setAttribute('aria-label', next ? 'Expand Commander' : 'Minimise Commander');
      }
      this.persist();
    }

    applyGeometry() {
      if (!this.dock) return;
      this.dock.style.width = `${this.width}px`;
      if (this.geometry) {
        // A restored hand-placed position outranks the dock, same as a drag.
        this.releaseDock?.();
        this.releaseDock = null;

        Object.assign(this.dock.style, {
          left: `${this.geometry.left}px`,
          top: `${this.geometry.top}px`,
          right: 'auto',
          bottom: 'auto'
        });
        this.clampIntoView();
      }
    }

    /** A panel restored onto a smaller window must not end up off-screen. */
    clampIntoView() {
      if (!this.dock || !this.geometry) return;
      const width = this.dock.offsetWidth || this.width;
      const height = this.dock.offsetHeight || 200;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, this.geometry.left));
      const top = Math.max(8, Math.min(window.innerHeight - Math.min(height, 120) - 8, this.geometry.top));
      this.geometry = { left, top };
      this.dock.style.left = `${left}px`;
      this.dock.style.top = `${top}px`;
    }

    build() {
      const root = UI.host('commander', { layer: 'panel', interactive: true });
      root.appendChild(this.styles());

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <section class="dock" role="dialog" aria-label="SETU AI Copilot" data-minimised="false">
          <button class="grip" data-act="resize" aria-label="Resize SETU Copilot" title="Drag left/right to resize"></button>
          <header class="head">
            <div class="id">
              <span class="pulse" aria-hidden="true"></span>
              <div class="id-text">
                <strong>SETU Copilot</strong>
                <small>AI Cognitive Companion · Connected</small>
              </div>
            </div>
            <div class="head-acts">
              <button class="icon-btn" data-act="minimise" aria-label="Minimise Copilot" title="Minimise">${icon('minus', { size: 16 })}</button>
              <button class="icon-btn" data-act="close" aria-label="Close Copilot" title="Close">${icon('x', { size: 16 })}</button>
            </div>
          </header>

          <div class="body">
            <div class="log" role="log" aria-live="polite"></div>
            <div class="stages" data-show="false" aria-live="polite"></div>
            <div class="plan" data-show="false"></div>

            <div class="composer">
              <input type="text" placeholder="e.g. summarise this page, find the login button, or explain this" aria-label="What would you like to do on this page?" />
              <button class="icon-btn" data-act="mic" data-active="false" aria-label="Speak your goal" title="Speak">${icon('microphone', { size: 19 })}</button>
              <button class="icon-btn" data-variant="primary" data-act="send" aria-label="Send goal" title="Send">${icon('arrow-up', { size: 19 })}</button>
            </div>
            <div class="quick">
              <button data-goal="Summarise this page for me">Summarise page</button>
              <button data-goal="Explain this page in simple words">Explain simply</button>
              <button data-goal="Find the main action button on this page">Find main action</button>
              <button data-goal="List key takeaways from this text">Key takeaways</button>
            </div>
          </div>
        </section>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.dock = scope.querySelector('.dock');
      this.dock.style.width = `${this.width}px`;

      const input = scope.querySelector('.composer input');
      const send = () => {
        const value = input.value;
        input.value = '';
        this.submit(value);
      };

      scope.querySelector('[data-act="send"]').onclick = send;
      scope.querySelector('[data-act="mic"]').onclick = () => this.toggleVoice();
      scope.querySelector('[data-act="minimise"]').onclick = () => this.setMinimised(!this.minimised);
      scope.querySelector('[data-act="close"]').onclick = () => window.setu?.toggle('commander', false) || window.setuLens?.toggle('commander', false);

      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          send();
        }
      };

      this.listen(scope, 'keydown', (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          window.setu?.toggle('commander', false) || window.setuLens?.toggle('commander', false);
        }
      });

      scope.querySelectorAll('.quick button').forEach((btn) => {
        btn.onclick = () => this.submit(btn.dataset.goal);
      });

      this.makeDraggable(scope.querySelector('.head'));
      this.makeResizable(scope.querySelector('[data-act="resize"]'));
      this.listen(window, 'resize', () => this.clampIntoView());

      // Docked, so Auto Scroll's bar and the visual map do not end up
      // underneath it. A user drag opts out — see makeDraggable.
      this.releaseDock = Dock.register('commander', 'bottom-right', this.dock);
      Dock.observe(this.dock);

      this.say('agent', "Tell me what you'd like to do on this page and I'll guide or navigate you step by step.");
    }

    /**
     * Let the user move the panel.
     */
    makeDraggable(handle) {
      let origin = null;

      const onDown = (event) => {
        if (event.target.closest('button')) return;
        const rect = this.dock.getBoundingClientRect();
        origin = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        handle.setPointerCapture?.(event.pointerId);
        this.dock.dataset.dragging = 'true';
      };

      const onMove = (event) => {
        if (!origin) return;

        // Once it has been placed by hand, having it snap back when another
        // tool opens would be worse than the overlap the dock prevents.
        this.releaseDock?.();
        this.releaseDock = null;

        const width = this.dock.offsetWidth;
        const height = this.dock.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, origin.left + event.clientX - origin.x));
        const top = Math.max(8, Math.min(window.innerHeight - height - 8, origin.top + event.clientY - origin.y));
        this.geometry = { left, top };
        Object.assign(this.dock.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
      };

      const onUp = (event) => {
        if (!origin) return;
        origin = null;
        handle.releasePointerCapture?.(event.pointerId);
        this.dock.dataset.dragging = 'false';
        this.persist();
      };

      this.listen(handle, 'pointerdown', onDown);
      this.listen(handle, 'pointermove', onMove);
      this.listen(handle, 'pointerup', onUp);
      this.listen(handle, 'pointercancel', onUp);
    }

    /** Widen the panel for a long plan, or narrow it to see the page. */
    makeResizable(grip) {
      let origin = null;

      const onDown = (event) => {
        event.preventDefault();
        origin = { x: event.clientX, width: this.dock.offsetWidth, left: this.dock.getBoundingClientRect().left };
        grip.setPointerCapture?.(event.pointerId);
        this.dock.dataset.dragging = 'true';
      };

      const onMove = (event) => {
        if (!origin) return;
        const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, origin.width - (event.clientX - origin.x)));
        this.width = Math.round(next);
        this.dock.style.width = `${this.width}px`;
      };

      const onUp = (event) => {
        if (!origin) return;
        origin = null;
        grip.releasePointerCapture?.(event.pointerId);
        this.dock.dataset.dragging = 'false';
        this.clampIntoView();
        this.persist();
      };

      this.listen(grip, 'pointerdown', onDown);
      this.listen(grip, 'pointermove', onMove);
      this.listen(grip, 'pointerup', onUp);
      this.listen(grip, 'pointercancel', onUp);
    }

    styles() {
      const style = document.createElement('style');
      style.textContent = [
        '.dock {',
        '  position: fixed;',
        `  width: ${DEFAULT_WIDTH}px; max-width: calc(100vw - 32px); min-width: ${MIN_WIDTH}px;`,
        '  max-height: min(840px, calc(100vh - 36px));',
        '  display: flex; flex-direction: column;',
        '  background: var(--surface); border: 1px solid var(--border);',
        '  border-radius: var(--radius-lg); box-shadow: var(--shadow); overflow: hidden;',
        '  pointer-events: auto; font-family: var(--font);',
        '  transition: box-shadow 0.2s ease;',
        '}',
        '.dock[data-minimised="true"] .body { display: none; }',
        '.dock[data-dragging="true"] { user-select: none; }',
        '',
        '/* Resize grip on the leading left edge. */',
        '.grip {',
        '  position: absolute; left: 0; top: 0; bottom: 0; width: 8px;',
        '  background: transparent; border: none; cursor: ew-resize; padding: 0; z-index: 10;',
        '}',
        '.grip:hover, .grip:focus-visible { background: var(--accent-100); outline: none; }',
        '',
        '.head {',
        '  display:flex; align-items:center; justify-content:space-between; gap:16px;',
        '  padding:16px 22px; border-bottom:1px solid var(--border);',
        '  background: var(--bg); cursor: move; flex-shrink: 0;',
        '}',
        '.id { display:flex; align-items:center; gap:12px; min-width: 0; }',
        '.id-text { min-width: 0; }',
        '.id strong { display:block; font-size:16.5px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }',
        '.id small { display:block; font-size:12px; color:var(--text-dim); margin-top: 1px; }',
        '.pulse {',
        '  width:9px; height:9px; border-radius:50%; background:var(--accent); flex-shrink: 0;',
        '  animation:pulse 2.2s ease-in-out infinite;',
        '}',
        '@keyframes pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:.4; transform:scale(0.85)} }',
        '.head-acts { display:flex; gap:6px; flex-shrink: 0; }',
        '',
        '.icon-btn {',
        '  display: grid; place-items: center;',
        '  background: transparent; border: 1px solid transparent; color: var(--text-dim);',
        '  padding: 7px; border-radius: var(--radius); cursor: pointer;',
        '  transition: background .15s ease, border-color .15s ease, color .15s ease;',
        '}',
        '.icon-btn:hover { color: var(--accent-900); background: var(--accent-100); border-color: var(--accent); }',
        '.icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }',
        '',
        // `flex: 1; min-height: 0` is what lets the transcript and plan give up
        // height when the panel hits its ceiling. Without it their fixed
        // max-heights summed past the dock's own, and `overflow: hidden` on the
        // dock clipped whatever came last — which was the composer, the one
        // control the agent cannot function without.
        '.body { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }',
        '',
        '/* Transcript */',
        '.log {',
        '  flex:1 1 auto; min-height:0; max-height:400px; overflow-y:auto;',
        '  padding:22px; display:flex; flex-direction:column; gap:16px; background: var(--surface);',
        '}',
        '.msg { max-width: 90%; }',
        '.msg-text { font-size:15px; line-height:1.6; white-space:pre-wrap; }',
        '.msg.agent { align-self:flex-start; color: var(--text); }',
        '.msg.agent .msg-text { opacity: .92; }',
        '.msg.user {',
        '  align-self:flex-end; background:var(--accent); color:var(--on-accent);',
        '  padding: 12px 18px; border-radius: var(--radius-lg) var(--radius-lg) 2px var(--radius-lg);',
        '}',
        '.msg.user .msg-text { font-weight: 600; }',
        '.msg-acts { display:flex; gap:8px; margin-top:10px; }',
        '.msg-acts button {',
        '  display:inline-flex; align-items:center; gap:5px;',
        '  background:transparent; border:1px solid var(--border); color:var(--text);',
        '  border-radius:999px; padding:4px 12px; font-family: var(--font);',
        '  font-size:12.5px; font-weight:600; cursor:pointer;',
        '}',
        '.msg-acts button:hover { border-color: var(--accent); background: var(--accent-100); color: var(--accent-700); }',
        '.msg-acts button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }',
        '',
        '/* A caret while tokens are still arriving, so a pause between them',
        '   reads as "still writing" rather than "finished, and that was it". */',
        '.msg.streaming .msg-text::after {',
        '  content: ""; display: inline-block; vertical-align: text-bottom;',
        '  width: 2px; height: 1.05em; margin-left: 2px;',
        '  background: var(--accent); animation: setu-caret 1s steps(2, start) infinite;',
        '}',
        '@keyframes setu-caret { 0%,100% { opacity: 1 } 50% { opacity: 0 } }',
        '',
        '/* Staged progress */',
        '.stages { display:none; padding: 0 22px 16px; background: var(--surface); flex-shrink: 0; }',
        '.stages[data-show="true"] { display:block; }',
        '.stage-list { list-style:none; display:flex; flex-direction:column; gap:9px; margin-bottom:12px; }',
        '.stage { display:flex; align-items:center; gap:10px; font-size:14px; color:var(--text-dim); opacity:.4; }',
        '.stage[data-state="active"] { color:var(--accent-700); opacity:1; font-weight:600; }',
        '.stage[data-state="done"] { opacity:.75; }',
        '.stage-icon { display:grid; place-items:center; flex-shrink:0; }',
        '.stage-label { flex:1; min-width:0; }',
        '.stage-time { font-size:12.5px; font-variant-numeric: tabular-nums; }',
        '.stage-note { font-size:13px; line-height:1.5; color:var(--text-dim); margin-bottom:12px; }',
        '.stages .setu-btn { width:100%; min-height:36px; font-size:13.5px; padding:6px 14px; }',
        '',
        // `flex: 0 1 auto` — the plan keeps its natural height while there is
        // room, and yields before the composer does when there is not.
        '.plan { display:none; flex: 0 1 auto; min-height: 0; border-top:1px solid var(--border); padding:18px 22px; max-height:360px; overflow-y:auto; background: var(--bg); }',
        '.plan[data-show="true"] { display:block; }',
        '.plan-bar { height:4px; background:var(--border); border-radius:2px; overflow:hidden; margin-bottom:14px; }',
        '.plan-fill { height:100%; background:var(--accent); transition:width .3s ease; }',
        '.plan-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; }',
        '.plan-steps { list-style:none; display:flex; flex-direction:column; gap:9px; margin-bottom:14px; }',
        '.plan-step {',
        '  display:flex; gap:12px; align-items:flex-start; padding:12px 14px;',
        '  border-radius:var(--radius); border: 1px solid transparent;',
        '  background: var(--surface); cursor:pointer;',
        '  transition: border-color .15s ease, background .15s ease;',
        '}',
        '.plan-step:hover { border-color:var(--accent); }',
        '.plan-step:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }',
        '.plan-step[data-state="current"] { background:var(--accent-100); border-color:var(--accent); color: var(--accent-900); }',
        '.plan-step[data-state="done"] { opacity:.6; }',
        '.dot {',
        '  flex-shrink:0; width:22px; height:22px; border-radius:50%; background:var(--bg);',
        '  border:1px solid var(--border); font-size:11.5px; font-weight:700;',
        '  display:grid; place-items:center;',
        '}',
        '.plan-step[data-state="done"] .dot,',
        '.plan-step[data-state="current"] .dot { background:var(--accent); color:var(--on-accent); border-color:var(--accent); }',
        '.plan-text { font-size:14.5px; line-height:1.55; }',
        '.warn {',
        '  display:flex; align-items:center; gap:5px; font-size:11.5px; color:var(--accent-2-700);',
        '  font-style:normal; font-weight:700; margin-top:4px;',
        '  text-transform: uppercase; letter-spacing: 0.06em;',
        '}',
        '.tip { font-size:13.5px; color:var(--text-dim); font-style:italic; margin-bottom:14px; line-height:1.5; }',
        // Pinned to the foot of the scrolling plan: these buttons are the whole
        // point of the panel, and a long plan pushed them out of sight.
        '.plan-acts {',
        '  display:flex; gap:9px; flex-wrap:wrap;',
        '  position: sticky; bottom: -18px;',
        '  padding: 10px 0 0; margin-top: 2px;',
        '  background: var(--bg); box-shadow: 0 -8px 12px -8px rgba(32,30,29,.18);',
        '}',
        '.plan-acts .setu-btn { flex:1 1 100px; min-height:38px; font-size:13.5px; padding:7px 12px; gap: 6px; }',
        '',
        '.composer { display:flex; gap:10px; padding:16px 22px; border-top:1px solid var(--border); background: var(--bg); flex-shrink: 0; }',
        '.composer input {',
        '  flex:1; min-width: 0; min-height: 48px; padding:11px 16px;',
        '  background:var(--surface); color:var(--text);',
        '  border:1px solid var(--border); border-radius:var(--radius);',
        '  font-family: var(--font); font-size:15px;',
        '}',
        '.composer input::placeholder { color: var(--text-dim); }',
        '.composer input:focus { outline:none; border-color:var(--accent); box-shadow: 0 0 0 1px var(--accent); }',
        '.composer .icon-btn {',
        '  width:48px; height:48px; flex-shrink: 0; border-color: var(--border);',
        '  background:var(--surface); color:var(--text);',
        '}',
        '.composer .icon-btn[data-variant="primary"] { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }',
        '.composer .icon-btn[data-variant="primary"]:hover { background:var(--accent-600); border-color:var(--accent-600); color:var(--on-accent); }',
        '.composer .icon-btn[data-active="true"] { background:var(--accent-2); border-color:var(--accent-2); color:#fff; }',
        '',
        '.quick { display:flex; gap:9px; padding:0 22px 16px; flex-wrap:wrap; background: var(--bg); flex-shrink: 0; }',
        '.quick button {',
        '  background:transparent; border:1px solid var(--border); color:var(--text);',
        '  border-radius:999px; padding:5px 14px; font-family: var(--font);',
        '  font-size:13px; font-weight:600; cursor:pointer;',
        '  transition: border-color .15s ease, background .15s ease, color .15s ease;',
        '}',
        '.quick button:hover { border-color:var(--accent); color:var(--accent-700); background: var(--accent-100); }',
        '.quick button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }'
      ].join('\n');
      return style;
    }
  }

  window.SETU.features.set('commander', Commander);
})();
