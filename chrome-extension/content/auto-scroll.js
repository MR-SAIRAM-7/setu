/**
 * Auto Scroll — hands-free reading at a chosen words-per-minute pace.
 *
 * Scrolls fractional pixels per frame rather than jumping on a timer, so the
 * text glides instead of stuttering — important for readers who lose their
 * place when content jumps.
 */

(() => {
  const { Feature, UI, Store } = window.SETU;

  class AutoScroll extends Feature {
    static key = 'scroll';

    constructor() {
      super();
      this.wpm = 220;
      this.running = true;
      this.remainder = 0; // sub-pixel carry, so slow speeds still move
      this.lastFrame = 0;
    }

    onEnable() {
      this.wpm = Store.getSetting('scrollWpm') || 220;
      this.build();
      this.bind();
      this.lastFrame = performance.now();
      this.loop(() => this.tick());
      UI.toast('Auto Scroll on — Space pauses', { tone: 'success' });
    }

    onDisable() {
      UI.destroyHost('scroll');
    }

    onSettings() {
      const next = Store.getSetting('scrollWpm');
      if (next && next !== this.wpm) {
        this.wpm = next;
        this.render();
      }
    }

    /**
     * Convert reading pace to scroll velocity.
     * Assumes ~11 words per rendered line, so px/sec = (wpm/60) / 11 * lineHeight.
     */
    pixelsPerSecond() {
      const lineHeight = parseFloat(getComputedStyle(document.body).lineHeight) || 24;
      const safeLineHeight = Number.isFinite(lineHeight) ? lineHeight : 24;
      return (this.wpm / 60 / 11) * safeLineHeight;
    }

    tick() {
      const now = performance.now();
      const deltaSeconds = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;

      if (!this.running) return;

      const distance = this.pixelsPerSecond() * deltaSeconds + this.remainder;
      const whole = Math.floor(distance);
      this.remainder = distance - whole;

      if (whole > 0) {
        const before = window.scrollY;
        window.scrollBy(0, whole);
        // Reached the bottom — stop rather than spin against the end.
        if (window.scrollY === before) {
          this.running = false;
          this.render();
          UI.toast('Reached the end of the page.', { tone: 'info' });
        }
      }
    }

    bind() {
      this.listen(window, 'keydown', (event) => {
        const active = document.activeElement;
        if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;

        if (event.code === 'Space') {
          event.preventDefault();
          this.toggleRun();
        } else if (event.key === 'ArrowUp' && event.shiftKey) {
          event.preventDefault();
          this.changeSpeed(20);
        } else if (event.key === 'ArrowDown' && event.shiftKey) {
          event.preventDefault();
          this.changeSpeed(-20);
        }
      });

      // Any manual scroll input pauses, so the user is never fighting the page.
      this.listen(window, 'wheel', () => this.pauseBriefly(), { passive: true });
      this.listen(window, 'touchstart', () => this.pauseBriefly(), { passive: true });
    }

    pauseBriefly() {
      if (!this.running) return;
      this.running = false;
      this.render();
      clearTimeout(this.resumeTimer);
      this.resumeTimer = setTimeout(() => {
        if (this.enabled) {
          this.running = true;
          this.lastFrame = performance.now();
          this.render();
        }
      }, 1800);
      this.cleanup(() => clearTimeout(this.resumeTimer));
    }

    toggleRun() {
      this.running = !this.running;
      this.lastFrame = performance.now();
      this.render();
    }

    changeSpeed(delta) {
      this.wpm = Math.max(60, Math.min(900, this.wpm + delta));
      Store.set({ settings: { scrollWpm: this.wpm } });
      this.render();
    }

    build() {
      const root = UI.host('scroll', { layer: 'control', interactive: true });

      const style = document.createElement('style');
      style.textContent = `
        .bar {
          position: fixed; bottom: 24px; right: 24px;
          display: flex; align-items: center; gap: 9px;
          padding: 8px 14px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 999px;
          box-shadow: var(--shadow); pointer-events: auto; font-family: var(--font);
        }
        button {
          background: transparent; border: 1px solid var(--border);
          color: var(--text); width: 32px; height: 32px; border-radius: 50%;
          cursor: pointer; font-size: 13px; font-weight: 700;
        }
        button:hover { background: var(--accent-100); border-color: var(--accent); color: var(--accent-700); }
        button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        button[data-primary] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
        .wpm { font-size: 12px; font-weight: 700; min-width: 62px; text-align: center; color: var(--text-dim); }
        .wpm b { color: var(--text); font-size: 13.5px; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="bar" role="group" aria-label="Auto scroll controls">
          <button data-act="slower" aria-label="Slower" title="Slower (Shift+↓)">−</button>
          <span class="wpm"><b>220</b> wpm</span>
          <button data-act="faster" aria-label="Faster" title="Faster (Shift+↑)">+</button>
          <button data-primary data-act="run" aria-label="Pause" title="Pause / resume (Space)">❚❚</button>
          <button data-act="close" aria-label="Close auto scroll" title="Close">×</button>
        </div>
      `;
      root.appendChild(scope);
      this.scope = scope;

      scope.querySelector('[data-act="slower"]').onclick = () => this.changeSpeed(-20);
      scope.querySelector('[data-act="faster"]').onclick = () => this.changeSpeed(20);
      scope.querySelector('[data-act="run"]').onclick = () => this.toggleRun();
      scope.querySelector('[data-act="close"]').onclick = () => window.setuLens?.toggle('scroll', false);

      this.render();
    }

    render() {
      if (!this.scope) return;
      this.scope.querySelector('.wpm').innerHTML = `<b>${this.wpm}</b> wpm`;
      const btn = this.scope.querySelector('[data-act="run"]');
      btn.textContent = this.running ? '❚❚' : '▶';
      btn.setAttribute('aria-label', this.running ? 'Pause' : 'Resume');
    }
  }

  window.SETU.features.set('scroll', AutoScroll);
})();
