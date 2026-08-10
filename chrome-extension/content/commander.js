// SETU Commander
// A bounded, on-page command layer. Commands are interpreted locally and any
// click or form fill is previewed for explicit confirmation before it happens.
class SetuCommander {
  constructor() {
    this.overlay = null;
    this.recognition = null;
    this.pendingAction = null;
    this.language = 'en';
  }

  open() {
    if (this.overlay) {
      this.overlay.querySelector('.setu-command-input')?.focus();
      return;
    }
    this.overlay = document.createElement('section');
    this.overlay.id = 'setu-commander';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'SETU Commander');
    this.overlay.innerHTML = `
      <div class="setu-commander-header">
        <div><p class="setu-kicker">SETU Commander</p><h2>What would make this easier?</h2></div>
        <button class="setu-dismiss" aria-label="Close commander">×</button>
      </div>
      <p class="setu-muted">Try “simplify this page”, “find checkout”, “fill my contact details”, or “explain the selected text”.</p>
      <div class="setu-command-row">
        <input class="setu-command-input" type="text" autocomplete="off" placeholder="Type a command…" aria-label="Command">
        <button class="setu-mic" type="button" aria-label="Speak a command">🎙</button>
      </div>
      <div class="setu-command-options">
        <label>Explain in <select class="setu-language"><option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="bn">Bengali</option></select></label>
        <label class="setu-speak-label"><input class="setu-speak-answer" type="checkbox"> Read answer aloud</label>
      </div>
      <div class="setu-command-result" aria-live="polite">I’ll always show a preview before clicking or filling anything.</div>
      <div class="setu-command-confirm" hidden>
        <button class="setu-secondary" data-action="cancel">Cancel</button><button class="setu-primary" data-action="confirm">Confirm</button>
      </div>`;
    document.body.appendChild(this.overlay);
    const input = this.overlay.querySelector('.setu-command-input');
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.execute(input.value);
      if (event.key === 'Escape') this.close();
    });
    this.overlay.querySelector('.setu-dismiss').addEventListener('click', () => this.close());
    this.overlay.querySelector('.setu-mic').addEventListener('click', () => this.listen());
    this.overlay.querySelector('.setu-language').addEventListener('change', (event) => { this.language = event.target.value; });
    this.overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.clearPending());
    this.overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => this.confirmPending());
    input.focus();
  }

  close() {
    this.recognition?.stop();
    this.overlay?.remove();
    this.overlay = null;
    this.pendingAction = null;
  }

  setResult(message, tone = '') {
    const result = this.overlay?.querySelector('.setu-command-result');
    if (!result) return;
    result.textContent = message;
    result.dataset.tone = tone;
  }

  async listen() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.setResult('Voice recognition is not available in this browser. You can type the same command.');
      return;
    }
    this.recognition?.stop();
    this.recognition = new Recognition();
    this.recognition.lang = this.language === 'en' ? navigator.language : `${this.language}-IN`;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.setResult('Listening…');
    this.recognition.onresult = (event) => {
      const command = event.results[0][0].transcript;
      this.overlay.querySelector('.setu-command-input').value = command;
      this.execute(command);
    };
    this.recognition.onerror = () => this.setResult('I could not hear that. Please try again or type your command.');
    this.recognition.start();
  }

  normalize(command) {
    return command.toLowerCase().replace(/[^a-z0-9\s@.-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  pageContext() {
    const root = document.querySelector('article, main, [role="main"]') || document.body;
    const headings = Array.from(root.querySelectorAll('h1, h2, h3')).filter((heading) => heading.offsetParent !== null).map((heading) => heading.innerText.trim()).filter(Boolean).slice(0, 12);
    const controls = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"]'))
      .filter((element) => element.offsetParent !== null && !/password|card|cc-|cvv|otp|security/i.test(`${element.type} ${element.name} ${element.id} ${element.autocomplete}`))
      .map((element) => this.describeElement(element)).filter(Boolean).slice(0, 30);
    return { title: document.title, headings, controls, hasForm: Boolean(document.querySelector('form')), hasSelection: Boolean(window.getSelection()?.toString().trim()) };
  }

  async requestAgentPlan(command) {
    try {
      const response = await fetch('http://localhost:3000/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, context: this.pageContext() })
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.plan || null;
    } catch (_) {
      return null;
    }
  }

  async executeAgentPlan(plan) {
    if (!plan?.intent) return false;
    switch (plan.intent) {
      case 'focus':
        (window.setu || window.setu)?.toggleMode('focus', true);
        this.setResult(plan.message);
        return true;
      case 'task_path':
        (window.setu || window.setu)?.toggleMode('chunking', true);
        this.setResult(plan.message);
        return true;
      case 'visual_breakdown':
        (window.setu || window.setu)?.features.visual?.open();
        this.setResult(plan.message);
        return true;
      case 'explain_selection':
        await this.explainSelection();
        return true;
      case 'read': {
        const selection = window.getSelection()?.toString().trim();
        const text = selection || document.querySelector('article, main, [role="main"]')?.innerText || document.body.innerText;
        (window.setu || window.setu)?.toggleFeature('tts', true);
        (window.setu || window.setu)?.features.tts?.speak(text.slice(0, 8000));
        this.setResult(plan.message);
        return true;
      }
      case 'scroll':
        window.scrollBy({ top: (plan.direction === 'up' ? -1 : 1) * Math.round(window.innerHeight * 0.7), behavior: 'smooth' });
        this.setResult(plan.message);
        return true;
      case 'find':
      case 'click': {
        if (!plan.target) return false;
        const element = this.findElement(plan.target);
        if (!element) { this.setResult(`I could not find “${plan.target}” on this page. Try the exact visible label.`, 'warning'); return true; }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('setu-next-target');
        window.setTimeout(() => element.classList.remove('setu-next-target'), 2200);
        if (plan.intent === 'click') {
          this.pendingAction = () => element.click();
          this.showConfirmation(`${plan.message} Confirm to click “${this.describeElement(element)}”.`);
        } else {
          this.setResult(plan.message);
        }
        return true;
      }
      case 'fill_profile':
        await this.previewFormFill();
        return true;
      case 'save_sanctuary': {
        const artifact = await (window.setu || window.setu)?.features.sanctuary?.save();
        if (artifact) {
          chrome.runtime.sendMessage({ action: 'openSanctuary' });
          this.setResult('Saved locally to SETU Sanctuary. Your map and flashcards are ready.');
        }
        return true;
      }
      case 'clarify':
        this.setResult(plan.message);
        return true;
      default:
        return false;
    }
  }

  async execute(command) {
    const agentPlan = await this.requestAgentPlan(command);
    if (agentPlan && await this.executeAgentPlan(agentPlan)) return;
    const normalized = this.normalize(command);
    if (!normalized) return;
    this.clearPending();
    if (/simplify|focus mode|remove distractions/.test(normalized)) {
      (window.setu || window.setu)?.toggleMode('focus', true);
      this.setResult('Focus Mode is on. I kept the article and removed surrounding clutter.');
      return;
    }
    if (/task|step by step|checklist|chunk/.test(normalized)) {
      (window.setu || window.setu)?.toggleMode('chunking', true);
      this.setResult('I made a task path. Start with the highlighted first step.');
      return;
    }
    if (/explain.*(visual|image|chart|table)|visual.*explain/.test(normalized)) {
      (window.setu || window.setu)?.features.visual?.open();
      this.setResult('I opened a plain-language breakdown of the page visuals.');
      return;
    }
    if (/explain.*(selected|selection)|what does this mean|explain this/.test(normalized)) {
      await this.explainSelection();
      return;
    }
    if (/read( this| page| selected| aloud)?/.test(normalized)) {
      const selection = window.getSelection()?.toString().trim();
      const text = selection || document.querySelector('article, main, [role="main"]')?.innerText || document.body.innerText;
      (window.setu || window.setu)?.toggleFeature('tts', true);
      (window.setu || window.setu)?.features.tts?.speak(text.slice(0, 8000));
      this.setResult(selection ? 'Reading your selected text aloud.' : 'Reading the main page aloud.');
      return;
    }
    if (/scroll (down|next)/.test(normalized)) {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: 'smooth' });
      this.setResult('Moved down one comfortable screen.');
      return;
    }
    if (/scroll (up|back)/.test(normalized)) {
      window.scrollBy({ top: -Math.round(window.innerHeight * 0.7), behavior: 'smooth' });
      this.setResult('Moved up one comfortable screen.');
      return;
    }
    if (/fill.*(profile|contact|details|form)/.test(normalized)) {
      await this.previewFormFill();
      return;
    }
    const target = normalized.replace(/^(find|go to|navigate to|click|open)\s+/, '').trim();
    if (target && target !== normalized || /^(find|go to|navigate to|click|open)\b/.test(normalized)) {
      const element = this.findElement(target);
      if (!element) {
        this.setResult(`I could not find “${target}”. Try the exact button or field label.`, 'warning');
        return;
      }
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('setu-next-target');
      window.setTimeout(() => element.classList.remove('setu-next-target'), 2200);
      if (/^click\b/.test(normalized)) {
        this.pendingAction = () => element.click();
        this.showConfirmation(`“${this.describeElement(element)}” is ready. Confirm to click it.`);
      } else {
        this.setResult(`I found “${this.describeElement(element)}” and brought it into view.`);
      }
      return;
    }
    this.setResult('I can simplify the page, make a task path, find a button or field, fill saved contact details, read aloud, or explain selected text.');
  }

  findElement(query) {
    const terms = query.split(' ').filter(Boolean);
    const elements = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"]'))
      .filter((element) => element.offsetParent !== null && !element.disabled);
    return elements.find((element) => {
      const label = `${this.describeElement(element)} ${element.name || ''} ${element.id || ''}`.toLowerCase();
      return terms.every((term) => label.includes(term));
    });
  }

  describeElement(element) {
    return (element.getAttribute('aria-label') || element.labels?.[0]?.innerText || element.innerText || element.value || element.placeholder || element.name || element.type || 'page control').trim().replace(/\s+/g, ' ').slice(0, 100);
  }

  async previewFormFill() {
    const { setuProfile = {} } = await chrome.storage.sync.get('setuProfile');
    const profile = { ...setuProfile };
    const candidateFields = Array.from(document.querySelectorAll('input, textarea, select')).filter((field) => (
      field.offsetParent !== null && !field.disabled && !/password|cc-|card|cvv|security|otp/i.test(`${field.type} ${field.name} ${field.id} ${field.autocomplete}`)
    ));
    const matches = candidateFields.map((field) => ({ field, value: this.valueForField(field, profile) })).filter((match) => match.value);
    if (!matches.length) {
      this.setResult('No saved matching contact details yet. Add your optional profile in Advanced Settings, then try again.');
      return;
    }
    this.pendingAction = () => {
      matches.forEach(({ field, value }) => {
        field.focus();
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
      matches[0].field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    this.showConfirmation(`SETU found ${matches.length} matching field${matches.length === 1 ? '' : 's'}. It will fill only contact details and will not submit the form.`);
  }

  valueForField(field, profile) {
    const hints = `${field.name} ${field.id} ${field.autocomplete} ${this.describeElement(field)}`.toLowerCase();
    if (/first.?name|given-name/.test(hints)) return profile.firstName;
    if (/last.?name|family-name|surname/.test(hints)) return profile.lastName;
    if (/e-?mail/.test(hints)) return profile.email;
    if (/phone|tel|mobile/.test(hints)) return profile.phone;
    if (/address/.test(hints)) return profile.address;
    if (/city/.test(hints)) return profile.city;
    if (/zip|postal|pincode/.test(hints)) return profile.postalCode;
    return '';
  }

  showConfirmation(message) {
    this.setResult(message);
    this.overlay.querySelector('.setu-command-confirm').hidden = false;
  }

  clearPending() {
    this.pendingAction = null;
    if (this.overlay) this.overlay.querySelector('.setu-command-confirm').hidden = true;
  }

  confirmPending() {
    if (!this.pendingAction) return;
    this.pendingAction();
    this.clearPending();
    this.setResult('Done. SETU did not submit anything. Please review the page before you continue.');
  }

  async explainSelection() {
    const selection = window.getSelection()?.toString().trim();
    const text = selection || document.querySelector('article, main, [role="main"]')?.innerText?.slice(0, 1800);
    if (!text) {
      this.setResult('Select text first, or open a page with readable content.');
      return;
    }
    this.setResult('Making that clearer…');
    let explanation;
    try {
      const response = await fetch('http://localhost:3000/api/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: this.language })
      });
      if (!response.ok) throw new Error('Service unavailable');
      ({ explanation } = await response.json());
    } catch (_) {
      explanation = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').replace(/\b(therefore|however|moreover)\b/gi, 'So');
    }
    this.setResult(explanation);
    if (this.overlay.querySelector('.setu-speak-answer').checked) {
      (window.setu || window.setu)?.features.tts?.speak(explanation);
    }
  }
}

window.SetuCommander = SetuCommander;
