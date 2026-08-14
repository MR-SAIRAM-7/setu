/**
 * Complex UI & Image Breakdown.
 *
 * Point at any chart, diagram, table, or dense block and get a plain-language
 * description. Text-bearing elements are explained from their text; images and
 * canvases are captured and described by the vision model.
 */

(() => {
  const { Feature, UI, API, Text, Store } = window.SETU;

  class VisualBreakdown extends Feature {
    static key = 'visual';

    constructor() {
      super();
      this.picking = false;
      this.hovered = null;
    }

    /** Entry point — invoked from the popup / context menu, not a toggle. */
    onEnable() {
      this.startPicking();
    }

    onDisable() {
      this.stopPicking();
      this.panelBody = null;
      UI.destroyHost('breakdown');
      UI.destroyHost('picker');
    }

    /* ------------------------------------------------------------------ */
    /* Element picker                                                     */
    /* ------------------------------------------------------------------ */

    startPicking() {
      if (this.picking) return;
      this.picking = true;

      const root = UI.host('picker', { layer: 'panel', interactive: false });
      const style = document.createElement('style');
      style.textContent = `
        .outline {
          position: fixed; pointer-events: none; border-radius: 6px;
          border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
          box-shadow: 0 0 0 9999px rgba(6,10,24,.34);
          transition: all .07s ease-out; display: none;
        }
        .hint {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
          padding: 10px 18px; background: var(--bg-soft); border: 1px solid var(--border);
          border-radius: 999px; box-shadow: var(--shadow);
          font-size: 13px; font-weight: 600; white-space: nowrap;
        }
        .hint kbd {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 5px; padding: 1px 6px; font-size: 11px; margin: 0 2px;
        }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="outline"></div>
        <div class="hint">Click any chart, image, or section to explain it &nbsp;<kbd>Esc</kbd> to cancel</div>
      `;
      root.appendChild(scope);
      this.outline = scope.querySelector('.outline');

      // Capture phase so we intercept the click before the page handles it.
      this.onMove = (event) => this.highlight(event);
      this.onClick = (event) => {
        if (!this.hovered) return;
        event.preventDefault();
        event.stopPropagation();
        const target = this.hovered;
        this.stopPicking();
        this.explain(target);
      };
      this.onKey = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          // Full teardown, so hosts and listeners are released properly.
          window.setuLens?.toggle('visual', false);
        }
      };

      window.addEventListener('mousemove', this.onMove, true);
      window.addEventListener('click', this.onClick, true);
      window.addEventListener('keydown', this.onKey, true);
    }

    stopPicking() {
      if (!this.picking) return;
      this.picking = false;
      window.removeEventListener('mousemove', this.onMove, true);
      window.removeEventListener('click', this.onClick, true);
      window.removeEventListener('keydown', this.onKey, true);
      UI.destroyHost('picker');
      this.hovered = null;
    }

    highlight(event) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el || Text.isOurs(el)) return;

      // Prefer a meaningful ancestor over a bare <span> of text.
      const target =
        el.closest('figure, table, img, canvas, svg, picture, video, section, article, form, [role="img"]') ||
        el.closest('div, p, li') ||
        el;

      this.hovered = target;
      const rect = target.getBoundingClientRect();
      Object.assign(this.outline.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    }

    /* ------------------------------------------------------------------ */
    /* Explanation                                                        */
    /* ------------------------------------------------------------------ */

    async explain(el) {
      this.renderPanel();
      this.setBody(`<div class="state">Looking at this closely…</div>`);

      try {
        const visual = /^(IMG|CANVAS|SVG|PICTURE|VIDEO)$/.test(el.tagName) || el.getAttribute('role') === 'img';
        const text = this.extractText(el);

        // Prefer text when there is enough of it — it is exact, and free.
        if (!visual && text.length > 60) {
          const { explanation } = await API.post('/api/agent/explain', {
            text: `Explain this page section clearly, including what any structure or numbers mean:\n\n${text}`,
            language: Store.getSetting('language') || 'English'
          });
          this.setBody(this.format(explanation));
          return;
        }

        const image = await this.capture(el);
        if (!image) {
          if (text.length > 10) {
            const { explanation } = await API.post('/api/agent/explain', {
              text,
              language: Store.getSetting('language') || 'English'
            });
            this.setBody(this.format(explanation));
          } else {
            this.setBody(`<div class="state" data-tone="error">There isn't enough here to describe.</div>`);
          }
          return;
        }

        const { description } = await API.post('/api/agent/describe-image', {
          image,
          context: `${document.title} — ${el.getAttribute('alt') || el.getAttribute('aria-label') || text.slice(0, 200)}`,
          language: Store.getSetting('language') || 'English'
        });
        this.setBody(this.format(description));
      } catch (error) {
        this.setBody(`<div class="state" data-tone="error">${Text.escape(error.message)}</div>`);
      }
    }

    extractText(el) {
      if (el.tagName === 'TABLE') {
        // Preserve row structure — a flattened table is unreadable.
        return [...el.rows]
          .slice(0, 40)
          .map((row) => [...row.cells].map((cell) => cell.innerText.trim()).join(' | '))
          .join('\n');
      }
      return (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim().slice(0, 6000);
    }

    /**
     * Crop the element out of a visible-tab screenshot.
     * The service worker owns captureVisibleTab; content scripts cannot call it.
     */
    async capture(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) return null;

      // Only what is on screen can be captured.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
        await new Promise((resolve) => setTimeout(resolve, 320));
      }

      const shot = await chrome.runtime.sendMessage({ action: 'captureTab' });
      if (!shot?.success) return null;

      const box = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const bitmap = await createImageBitmap(await (await fetch(shot.dataUrl)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1400, Math.round(box.width * dpr));
      canvas.height = Math.round(box.height * dpr * (canvas.width / (box.width * dpr)));

      canvas
        .getContext('2d')
        .drawImage(
          bitmap,
          box.left * dpr,
          box.top * dpr,
          box.width * dpr,
          box.height * dpr,
          0,
          0,
          canvas.width,
          canvas.height
        );

      return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    }

    format(markdownish) {
      return String(markdownish || '')
        .split(/\n{2,}/)
        .map((block) => {
          const trimmed = block.trim();
          if (!trimmed) return '';
          if (/^[-*•]\s/m.test(trimmed)) {
            return `<ul>${trimmed
              .split('\n')
              .filter((line) => line.trim())
              .map((line) => `<li>${Text.escape(line.replace(/^[-*•]\s*/, ''))}</li>`)
              .join('')}</ul>`;
          }
          return `<p>${Text.escape(trimmed)}</p>`;
        })
        .join('');
    }

    /* ------------------------------------------------------------------ */

    renderPanel() {
      const root = UI.host('breakdown', { layer: 'panel', interactive: true });
      if (this.panelBody) return;

      const style = document.createElement('style');
      style.textContent = `
        .panel {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          width: min(560px, calc(100vw - 40px)); max-height: 58vh;
          display: flex; flex-direction: column; pointer-events: auto;
        }
        .head {
          display:flex; align-items:center; justify-content:space-between;
          padding:13px 16px; border-bottom:1px solid var(--border);
        }
        .badge { font-size:10.5px; font-weight:800; letter-spacing:.09em; color:var(--accent); }
        .acts { display:flex; gap:4px; }
        .acts button { background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:15px; padding:3px 7px; border-radius:6px; }
        .acts button:hover { color:var(--text); background:rgba(255,255,255,.09); }
        .content { padding:16px; overflow-y:auto; font-size:14px; line-height:1.68; }
        .content p { margin-bottom:11px; }
        .content ul { margin:0 0 11px 19px; }
        .content li { margin-bottom:6px; }
        .state { padding:20px; text-align:center; color:var(--text-dim); font-size:13px; }
        .state[data-tone="error"] { color:var(--danger); }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="setu-card panel" role="dialog" aria-label="Visual breakdown">
          <div class="head">
            <span class="badge">VISUAL BREAKDOWN</span>
            <div class="acts">
              <button data-act="speak" aria-label="Read aloud" title="Read aloud">🔊</button>
              <button data-act="again" aria-label="Pick another" title="Pick another element">⌖</button>
              <button data-act="close" aria-label="Close" title="Close">×</button>
            </div>
          </div>
          <div class="content"></div>
        </div>
      `;
      root.appendChild(scope);

      this.panelBody = scope.querySelector('.content');
      scope.querySelector('[data-act="close"]').onclick = () => {
        this.panelBody = null;
        window.setuLens?.toggle('visual', false);
      };
      scope.querySelector('[data-act="again"]').onclick = () => this.startPicking();
      scope.querySelector('[data-act="speak"]').onclick = () =>
        window.setuLens?.speak(this.panelBody.innerText);
    }

    setBody(html) {
      if (this.panelBody) this.panelBody.innerHTML = html;
    }
  }

  window.SETU.features.set('visual', VisualBreakdown);
})();
