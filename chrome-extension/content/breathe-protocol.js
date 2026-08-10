// SETU Breathe Protocol
// Detects only short-lived, local interaction patterns. No cursor data leaves
// the page; the protocol is opt-in and can be stopped in the popup at any time.
class BreatheProtocol {
  constructor() {
    this.isEnabled = false;
    this.pointerSamples = [];
    this.scrollSamples = [];
    this.clicks = [];
    this.lastPromptAt = 0;
    this.overlay = null;
    this.boundPointer = this.recordPointer.bind(this);
    this.boundScroll = this.recordScroll.bind(this);
    this.boundClick = this.recordClick.bind(this);
    this.boundKey = this.recordKey.bind(this);
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    document.addEventListener('pointermove', this.boundPointer, { passive: true });
    document.addEventListener('click', this.boundClick, { passive: true });
    window.addEventListener('scroll', this.boundScroll, { passive: true });
    document.addEventListener('keydown', this.boundKey, { passive: true });
  }

  disable() {
    this.isEnabled = false;
    document.removeEventListener('pointermove', this.boundPointer);
    document.removeEventListener('click', this.boundClick);
    window.removeEventListener('scroll', this.boundScroll);
    document.removeEventListener('keydown', this.boundKey);
    this.removeOverlay();
    this.pointerSamples = [];
    this.scrollSamples = [];
    this.clicks = [];
  }

  recordPointer(event) {
    const now = Date.now();
    this.pointerSamples.push({ x: event.clientX, y: event.clientY, at: now });
    this.pointerSamples = this.pointerSamples.filter((point) => now - point.at < 3000);
    this.checkForOverload();
  }

  recordScroll() {
    const now = Date.now();
    this.scrollSamples.push({ y: window.scrollY, at: now });
    this.scrollSamples = this.scrollSamples.filter((point) => now - point.at < 3000);
    this.checkForOverload();
  }

  recordClick(event) {
    if (event.target.closest('#setu-breathe-overlay, #setu-commander, #setu-task-path')) return;
    const now = Date.now();
    this.clicks.push({ x: event.clientX, y: event.clientY, at: now });
    this.clicks = this.clicks.filter((click) => now - click.at < 1400);
    this.checkForOverload();
  }

  recordKey(event) {
    if (event.key === 'Escape') this.removeOverlay();
  }

  hasErraticPointer() {
    if (this.pointerSamples.length < 14) return false;
    let reversals = 0;
    let previousDirection = null;
    for (let index = 1; index < this.pointerSamples.length; index += 1) {
      const previous = this.pointerSamples[index - 1];
      const current = this.pointerSamples[index];
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      if (Math.abs(dx) + Math.abs(dy) < 12) continue;
      const direction = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * 2;
      if (previousDirection && direction !== previousDirection) reversals += 1;
      previousDirection = direction;
    }
    return reversals >= 8;
  }

  hasChaoticScroll() {
    if (this.scrollSamples.length < 5) return false;
    let reversals = 0;
    let previousDirection = 0;
    for (let index = 1; index < this.scrollSamples.length; index += 1) {
      const delta = this.scrollSamples[index].y - this.scrollSamples[index - 1].y;
      if (Math.abs(delta) < 35) continue;
      const direction = Math.sign(delta);
      if (previousDirection && direction !== previousDirection) reversals += 1;
      previousDirection = direction;
    }
    return reversals >= 3;
  }

  hasRageClicks() {
    if (this.clicks.length < 3) return false;
    const first = this.clicks[0];
    const last = this.clicks[this.clicks.length - 1];
    const closeTogether = this.clicks.every((click) => Math.hypot(click.x - last.x, click.y - last.y) < 90);
    return closeTogether && last.at - first.at < 1200;
  }

  checkForOverload() {
    if (!this.isEnabled || this.overlay || Date.now() - this.lastPromptAt < 45000) return;
    if (this.hasRageClicks() || this.hasErraticPointer() || this.hasChaoticScroll()) this.showPrompt();
  }

  showPrompt() {
    this.lastPromptAt = Date.now();
    this.overlay = document.createElement('section');
    this.overlay.id = 'setu-breathe-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'setu-breathe-title');
    this.overlay.innerHTML = `
      <div class="setu-breathe-card">
        <button class="setu-dismiss" aria-label="Close">×</button>
        <p class="setu-kicker">SETU noticed a lot of activity</p>
        <h2 id="setu-breathe-title">Let’s take five calm breaths.</h2>
        <div class="setu-breath" aria-label="Follow the box: breathe in, hold, breathe out, hold">
          <span class="setu-breath-dot" aria-hidden="true"></span>
        </div>
        <p class="setu-breath-status" aria-live="polite">Breathe in</p>
        <p class="setu-muted">This page can wait. Nothing was recorded or sent anywhere.</p>
        <div class="setu-breathe-actions">
          <button class="setu-primary" data-action="simplify">Simplify this page</button>
          <button class="setu-secondary" data-action="continue">I’m okay, continue</button>
        </div>
      </div>`;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector('.setu-dismiss').addEventListener('click', () => this.removeOverlay());
    this.overlay.querySelector('[data-action="continue"]').addEventListener('click', () => this.removeOverlay());
    this.overlay.querySelector('[data-action="simplify"]').addEventListener('click', () => {
      this.removeOverlay();
      window.setu?.activateSupportPath();
    });
    this.runBreathingCycle();
    this.overlay.querySelector('.setu-primary').focus();
  }

  runBreathingCycle() {
    const status = this.overlay?.querySelector('.setu-breath-status');
    if (!status) return;
    const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
    let phase = 0;
    status.textContent = phases[phase];
    this.breathInterval = window.setInterval(() => {
      if (!this.overlay) return;
      phase = (phase + 1) % phases.length;
      status.textContent = phases[phase];
    }, 1250);
  }

  removeOverlay() {
    if (this.breathInterval) window.clearInterval(this.breathInterval);
    this.breathInterval = null;
    this.overlay?.remove();
    this.overlay = null;
  }
}

window.BreatheProtocol = BreatheProtocol;
