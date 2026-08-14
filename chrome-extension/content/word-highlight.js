/**
 * Reading Ruler — a highlight that follows the line you are reading.
 *
 * Rewritten in v3. Two bugs made the old version invisible in practice:
 *   1. It positioned an absolutely-placed child of a `position: fixed` host
 *      using `rect.top + window.scrollY`, so the ruler jumped a full scroll
 *      offset off-screen the moment the page moved.
 *   2. It measured with `caretRangeFromPoint().getBoundingClientRect()`. That
 *      range is collapsed, so the rect was zero-width — a highlight with no
 *      width is nothing at all.
 *
 * Both are fixed by measuring real line boxes (SETU.Text.lineBoxAt) and
 * positioning in pure viewport coordinates.
 */

(() => {
  const { Feature, UI, Store, Text } = window.SETU;

  const MODES = {
    line: { label: 'Line', pad: 3 },
    word: { label: 'Word', pad: 1 },
    block: { label: 'Block', pad: 3 }
  };

  class ReadingRuler extends Feature {
    static key = 'highlight';

    constructor() {
      super();
      this.mode = 'line';
      this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
      this.target = null;
      this.hasPointer = false;
    }

    onEnable() {
      this.build();
      this.bind();
      this.loop(() => this.tick());
      UI.toast('Reading Ruler on', { tone: 'success' });
    }

    onDisable() {
      UI.destroyHost('ruler');
    }

    onSettings() {
      this.scope?.style.setProperty('--ruler', Store.getSetting('highlightColor') || '#7c8cff');
    }

    build() {
      const root = UI.host('ruler', { layer: 'reading', interactive: false });

      const style = document.createElement('style');
      style.textContent = `
        .ruler {
          position: fixed;
          background: color-mix(in srgb, var(--ruler) 22%, transparent);
          border-left: 3px solid var(--ruler);
          border-radius: 5px;
          pointer-events: none;
          opacity: 0;
          transition: opacity .15s ease, top .07s linear, left .07s linear,
                      width .07s linear, height .07s linear;
        }
        .ruler[data-visible="true"] { opacity: 1; }
        .ruler[data-mode="word"]  { border-radius: 3px; }
        .ruler[data-mode="block"] { border-radius: 9px; background: color-mix(in srgb, var(--ruler) 15%, transparent); }

        .dock {
          position: fixed; right: 18px; bottom: 96px;
          display: flex; flex-direction: column; gap: 5px;
          padding: 7px; background: var(--bg-soft);
          border: 1px solid var(--border); border-radius: 13px;
          box-shadow: var(--shadow); pointer-events: auto;
        }
        .dock button {
          width: 40px; height: 32px; border-radius: 8px;
          background: transparent; border: 1px solid transparent;
          color: var(--text-dim); font-size: 11px; font-weight: 700; cursor: pointer;
        }
        .dock button:hover { background: rgba(255,255,255,.09); color: var(--text); }
        .dock button[aria-pressed="true"] { background: var(--ruler); color: #0b1020; }
        .dock button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.style.setProperty('--ruler', Store.getSetting('highlightColor') || '#7c8cff');
      scope.innerHTML = `
        <div class="ruler" data-mode="line" data-visible="false"></div>
        <div class="dock" role="group" aria-label="Reading ruler mode">
          ${Object.entries(MODES)
            .map(
              ([key, cfg]) =>
                `<button data-mode="${key}" aria-pressed="${key === 'line'}" title="${cfg.label} mode">${cfg.label}</button>`
            )
            .join('')}
        </div>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.ruler = scope.querySelector('.ruler');

      scope.querySelectorAll('.dock button').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.mode = btn.dataset.mode;
          this.ruler.dataset.mode = this.mode;
          scope
            .querySelectorAll('.dock button')
            .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          this.measure();
        });
      });
    }

    bind() {
      this.listen(
        window,
        'mousemove',
        (event) => {
          this.pointer = { x: event.clientX, y: event.clientY };
          this.hasPointer = true;
          this.measure();
        },
        { passive: true }
      );

      this.listen(window, 'scroll', () => this.measure(), { passive: true });
      this.listen(window, 'resize', () => this.measure(), { passive: true });

      this.listen(window, 'keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const active = document.activeElement;
        if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const delta = (this.target?.height || 24) * (event.key === 'ArrowDown' ? 1 : -1);
          this.pointer.y = Math.max(8, Math.min(window.innerHeight - 8, this.pointer.y + delta));
          this.hasPointer = true;
          this.measure();
        }
      });
    }

    /** Resolve the rect the ruler should occupy, in viewport coordinates. */
    measure() {
      if (!this.enabled || !this.hasPointer) return;

      const { x, y } = this.pointer;

      if (this.mode === 'word') {
        this.target = this.wordRectAt(x, y) || Text.lineBoxAt(x, y);
      } else if (this.mode === 'block') {
        this.target = this.blockRectAt(x, y);
      } else {
        this.target = Text.lineBoxAt(x, y) || Text.findLineBoxNear(y);
      }
    }

    /** Rect of the single word under the cursor. */
    wordRectAt(x, y) {
      const node = Text.caretNodeAt(x, y);
      if (!node) return null;

      const offset = this.caretOffsetAt(x, y);
      if (offset === null) return null;

      const content = node.textContent;
      let start = offset;
      let end = offset;
      while (start > 0 && /\S/.test(content[start - 1])) start -= 1;
      while (end < content.length && /\S/.test(content[end])) end += 1;
      if (start === end) return null;

      const range = document.createRange();
      try {
        range.setStart(node, start);
        range.setEnd(node, end);
      } catch (_) {
        return null;
      }

      const rect = range.getBoundingClientRect();
      return rect.width > 0 ? rect : null;
    }

    caretOffsetAt(x, y) {
      if (document.caretPositionFromPoint) {
        const position = document.caretPositionFromPoint(x, y);
        return position ? position.offset : null;
      }
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(x, y);
        return range ? range.startOffset : null;
      }
      return null;
    }

    /** Rect of the whole paragraph/block under the cursor. */
    blockRectAt(x, y) {
      const node = Text.caretNodeAt(x, y);
      const block = node?.parentElement?.closest('p, li, blockquote, h1, h2, h3, h4, td, dd, div');
      if (!block || Text.isOurs(block)) return Text.lineBoxAt(x, y);

      const rect = block.getBoundingClientRect();
      return rect.height > 0 && rect.height < window.innerHeight * 0.9 ? rect : Text.lineBoxAt(x, y);
    }

    /**
     * Paint. Everything here is viewport-relative because the host is
     * `position: fixed` — adding scrollY (the old bug) would double-count it.
     */
    tick() {
      if (!this.ruler) return;

      if (!this.target) {
        this.ruler.dataset.visible = 'false';
        return;
      }

      const pad = MODES[this.mode].pad;
      const top = this.target.top - pad;
      const height = this.target.height + pad * 2;

      // Off-screen after a scroll: hide rather than pin to the edge.
      if (top + height < 0 || top > window.innerHeight) {
        this.ruler.dataset.visible = 'false';
        return;
      }

      this.ruler.style.top = `${top}px`;
      this.ruler.style.left = `${this.target.left - pad}px`;
      this.ruler.style.width = `${this.target.width + pad * 2}px`;
      this.ruler.style.height = `${height}px`;
      this.ruler.dataset.visible = 'true';
    }
  }

  window.SETU.features.set('highlight', ReadingRuler);
})();
