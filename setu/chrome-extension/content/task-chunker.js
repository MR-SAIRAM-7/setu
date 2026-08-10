// SETU task chunker: turns a form or a dense page into an optional linear path.
// It never submits a form, changes a value, or blocks the original page controls.
class TaskChunker {
  constructor() {
    this.isEnabled = false;
    this.overlay = null;
    this.steps = [];
    this.currentIndex = 0;
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.steps = this.buildSteps();
    this.currentIndex = 0;
    this.render();
  }

  disable() {
    this.isEnabled = false;
    this.overlay?.remove();
    this.overlay = null;
  }

  labelFor(element) {
    const aria = element.getAttribute('aria-label') || element.getAttribute('placeholder');
    if (aria) return aria.trim();
    if (element.labels?.length) return Array.from(element.labels).map((label) => label.innerText.trim()).join(' ');
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label?.innerText.trim()) return label.innerText.trim();
    }
    return element.name || element.type || 'this field';
  }

  buildSteps() {
    const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'))
      .filter((field) => !field.disabled && field.offsetParent !== null)
      .slice(0, 7);
    const submit = Array.from(document.querySelectorAll('button, input[type="submit"]'))
      .find((button) => button.offsetParent !== null && /submit|continue|next|save|apply|checkout|confirm|send/i.test(`${button.innerText || ''} ${button.value || ''}`));

    if (fields.length) {
      const steps = fields.map((field, index) => ({
        title: `Step ${index + 1}: ${this.labelFor(field)}`,
        detail: 'Complete this field, then mark this step done.',
        element: field
      }));
      if (submit) {
        steps.push({
          title: `Final step: ${this.labelFor(submit)}`,
          detail: 'Review your details, then choose this button when you are ready.',
          element: submit
        });
      }
      return steps;
    }

    const headings = Array.from(document.querySelectorAll('main h1, main h2, article h1, article h2, h1, h2'))
      .filter((heading) => heading.offsetParent !== null && heading.innerText.trim())
      .slice(0, 5);
    return (headings.length ? headings : [document.querySelector('main, article, [role="main"]') || document.body]).map((element, index) => ({
      title: element === document.body ? 'Start with the main page' : `Step ${index + 1}: ${element.innerText.trim().split('\n')[0]}`,
      detail: 'Read only this section before moving to the next one.',
      element
    }));
  }

  render() {
    this.overlay?.remove();
    this.overlay = document.createElement('aside');
    this.overlay.id = 'setu-task-path';
    this.overlay.setAttribute('aria-label', 'SETU task path');
    this.overlay.innerHTML = `
      <div class="setu-task-header">
        <div><p class="setu-kicker">SETU task path</p><h2>Just one next step</h2></div>
        <button aria-label="Close task path" class="setu-dismiss">×</button>
      </div>
      <p class="setu-muted">This is a guide only. You stay in control of every field and button.</p>
      <ol class="setu-task-list"></ol>
      <div class="setu-task-footer">
        <button class="setu-secondary" data-action="previous">Back</button>
        <button class="setu-primary" data-action="done">Mark step done</button>
      </div>`;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector('.setu-dismiss').addEventListener('click', () => window.neuroread?.toggleMode('chunking', false));
    this.overlay.querySelector('[data-action="previous"]').addEventListener('click', () => this.move(-1));
    this.overlay.querySelector('[data-action="done"]').addEventListener('click', () => this.move(1));
    this.paintSteps();
    this.focusCurrentStep();
  }

  paintSteps() {
    const list = this.overlay?.querySelector('.setu-task-list');
    if (!list) return;
    list.replaceChildren();
    this.steps.forEach((step, index) => {
      const item = document.createElement('li');
      item.className = index === this.currentIndex ? 'current' : index < this.currentIndex ? 'complete' : '';
      const button = document.createElement('button');
      button.type = 'button';
      const number = document.createElement('span');
      number.className = 'setu-step-number';
      number.textContent = index < this.currentIndex ? '✓' : String(index + 1);
      const content = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = step.title;
      const detail = document.createElement('small');
      detail.textContent = step.detail;
      content.append(title, detail);
      button.append(number, content);
      button.addEventListener('click', () => { this.currentIndex = index; this.paintSteps(); this.focusCurrentStep(); });
      item.appendChild(button);
      list.appendChild(item);
    });
    this.overlay.querySelector('[data-action="previous"]').disabled = this.currentIndex === 0;
    this.overlay.querySelector('[data-action="done"]').textContent = this.currentIndex >= this.steps.length - 1 ? 'Finish path' : 'Mark step done';
  }

  move(amount) {
    if (amount > 0 && this.currentIndex >= this.steps.length - 1) {
      window.neuroread?.showToast('Nice work — task path complete.');
      this.disable();
      if (window.neuroread) window.neuroread.state.chunking = false;
      window.neuroread?.saveState();
      return;
    }
    this.currentIndex = Math.max(0, Math.min(this.steps.length - 1, this.currentIndex + amount));
    this.paintSteps();
    this.focusCurrentStep();
  }

  focusCurrentStep() {
    const step = this.steps[this.currentIndex];
    if (!step?.element?.isConnected) return;
    step.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    step.element.classList.add('setu-next-target');
    window.setTimeout(() => step.element.classList.remove('setu-next-target'), 2200);
  }
}

window.TaskChunker = TaskChunker;
