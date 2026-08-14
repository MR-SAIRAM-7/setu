/**
 * SETU Lens — Shared Content-Script Runtime
 * ========================================
 * Loaded before every feature module. Provides the four things that make the
 * Lens work identically on every site on the internet:
 *
 *  1. UI.host()   — every overlay lives in its own Shadow DOM root, so hostile
 *                   page CSS cannot restyle us and our CSS cannot leak out.
 *                   This is what makes the extension site-agnostic.
 *  2. Store       — one state object, persisted and broadcast, so the popup,
 *                   side panel, and page never disagree about what is on.
 *  3. Feature     — a base class with idempotent enable/disable, so running six
 *                   features at once is well-defined rather than accidental.
 *  4. Layers      — a single z-index ladder, so composed overlays stack in a
 *                   predictable order instead of fighting.
 */

(() => {
  if (window.SETU?.ready) return;

  /* ---------------------------------------------------------------------- */
  /* Layer ladder                                                           */
  /* ---------------------------------------------------------------------- */

  const LAYERS = {
    dim: 2147483600,      // page dimmers and masks
    reading: 2147483610,  // line band, word highlight, ruler
    reader: 2147483620,   // full-page focus reader
    panel: 2147483635,    // agent panel, commander, breakdowns
    control: 2147483645,  // floating control pills
    toast: 2147483647     // transient messages, always on top
  };

  /* ---------------------------------------------------------------------- */
  /* Shadow-root host manager                                               */
  /* ---------------------------------------------------------------------- */

  const hosts = new Map();

  /**
   * Return (creating if needed) an isolated shadow root for `id`.
   * Mounted on documentElement rather than body: some sites replace <body>
   * wholesale during hydration, which would silently destroy our overlays.
   */
  function host(id, { layer = 'panel', interactive = false } = {}) {
    if (hosts.has(id)) return hosts.get(id).root;

    const el = document.createElement('div');
    el.id = `setu-host-${id}`;
    el.setAttribute('data-setu', 'host');
    // `all: initial` stops inherited page styles at the boundary.
    el.style.cssText = `all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: ${LAYERS[layer]}; pointer-events: ${interactive ? 'auto' : 'none'};`;

    (document.documentElement || document.body).appendChild(el);

    const root = el.attachShadow({ mode: 'open' });
    root.appendChild(baseStyle());
    hosts.set(id, { el, root });
    return root;
  }

  function destroyHost(id) {
    const entry = hosts.get(id);
    if (entry) {
      entry.el.remove();
      hosts.delete(id);
    }
  }

  /** Design tokens + reset, injected into every shadow root. */
  function baseStyle() {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      :where(button, input, select, textarea) { font: inherit; color: inherit; }

      .setu-scope {
        --bg:        #0b1020;
        --bg-soft:   #151b32;
        --surface:   #1c2340;
        --border:    rgba(255,255,255,.14);
        --text:      #f2f5ff;
        --text-dim:  #a8b2d1;
        --accent:    #7c8cff;
        --accent-2:  #4ade80;
        --warn:      #fbbf24;
        --danger:    #fb7185;
        --radius:    14px;
        --shadow:    0 18px 48px -12px rgba(0,0,0,.65);
        --font:      system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

        font-family: var(--font);
        font-size: 14px;
        line-height: 1.55;
        color: var(--text);
        pointer-events: auto;
        -webkit-font-smoothing: antialiased;
      }

      .setu-scope[data-contrast="high"] {
        --bg: #000; --bg-soft: #000; --surface: #0a0a0a;
        --text: #fff; --text-dim: #e8e8e8;
        --border: #fff; --accent: #ffe600; --accent-2: #00ff9d;
      }

      .setu-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        min-height: 36px; padding: 8px 14px;
        background: var(--surface); color: var(--text);
        border: 1px solid var(--border); border-radius: 10px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: background .16s ease, border-color .16s ease, transform .16s ease;
      }
      .setu-btn:hover  { background: #26304f; border-color: var(--accent); }
      .setu-btn:active { transform: translateY(1px); }
      .setu-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
      .setu-btn[data-variant="primary"] { background: var(--accent); border-color: var(--accent); color: #0b1020; }
      .setu-btn[data-variant="danger"]  { background: transparent; border-color: var(--danger); color: var(--danger); }
      .setu-btn[disabled] { opacity: .45; cursor: not-allowed; }

      .setu-card {
        background: var(--bg-soft); border: 1px solid var(--border);
        border-radius: var(--radius); box-shadow: var(--shadow);
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
      }
    `;
    return style;
  }

  /* ---------------------------------------------------------------------- */
  /* State store                                                            */
  /* ---------------------------------------------------------------------- */

  const DEFAULT_STATE = {
    bionic: false,
    focus: false,
    lineFocus: false,
    highlight: false,
    scroll: false,
    tts: false,
    eye: false,
    dyslexia: false,
    breathe: false,
    chunking: false,
    theme: 'default',
    settings: {
      bionicIntensity: 0.45,
      lineFocusHeight: 1,
      highlightColor: '#7c8cff',
      scrollWpm: 220,
      ttsRate: 1,
      ttsPitch: 1,
      ttsVoice: '',
      fontScale: 1,
      language: 'English'
    }
  };

  const listeners = new Set();
  let state = structuredClone(DEFAULT_STATE);

  const Store = {
    get: () => state,
    getSetting: (key) => state.settings[key],

    /** Shallow-merge a patch, persist it, and notify every subscriber. */
    async set(patch, { persist = true } = {}) {
      const settings = patch.settings ? { ...state.settings, ...patch.settings } : state.settings;
      state = { ...state, ...patch, settings };
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch (error) {
          console.warn('[SETU] store listener failed:', error);
        }
      });
      if (persist) {
        try {
          await chrome.storage.sync.set({ setuState: state });
        } catch (_) {
          /* storage unavailable (private mode / quota) — stay in-memory */
        }
      }
    },

    async load() {
      try {
        const { setuState } = await chrome.storage.sync.get('setuState');
        if (setuState) {
          state = {
            ...DEFAULT_STATE,
            ...setuState,
            settings: { ...DEFAULT_STATE.settings, ...(setuState.settings || {}) }
          };
        }
      } catch (_) {
        /* keep defaults */
      }
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    DEFAULT_STATE
  };

  /* ---------------------------------------------------------------------- */
  /* Feature base class                                                     */
  /* ---------------------------------------------------------------------- */

  /**
   * Base for every Lens feature.
   *
   * enable()/disable() are idempotent and safe to call in any order, which is
   * what lets several features run simultaneously without corrupting each
   * other's DOM. Subclasses implement onEnable/onDisable only.
   */
  class Feature {
    static key = 'feature';

    constructor() {
      this.enabled = false;
      this._cleanups = [];
    }

    get key() {
      return this.constructor.key;
    }

    enable() {
      if (this.enabled) return;
      this.enabled = true;
      try {
        this.onEnable();
      } catch (error) {
        this.enabled = false;
        console.error(`[SETU:${this.key}] failed to enable:`, error);
        throw error;
      }
    }

    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      try {
        this.onDisable();
      } catch (error) {
        console.error(`[SETU:${this.key}] failed to disable cleanly:`, error);
      }
      this.runCleanups();
    }

    toggle(next) {
      const target = typeof next === 'boolean' ? next : !this.enabled;
      if (target) this.enable();
      else this.disable();
      return this.enabled;
    }

    /** Called when a setting this feature cares about changes. */
    onSettings() {}

    onEnable() {}
    onDisable() {}

    /* -- helpers that guarantee teardown -- */

    /** addEventListener that is automatically removed on disable(). */
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this._cleanups.push(() => target.removeEventListener(type, handler, options));
      return handler;
    }

    /** requestAnimationFrame loop that stops itself on disable(). */
    loop(fn) {
      let id = null;
      const tick = () => {
        if (!this.enabled) return;
        fn();
        id = requestAnimationFrame(tick);
      };
      id = requestAnimationFrame(tick);
      this._cleanups.push(() => id && cancelAnimationFrame(id));
    }

    /** Register arbitrary teardown. */
    cleanup(fn) {
      this._cleanups.push(fn);
    }

    runCleanups() {
      const pending = this._cleanups.splice(0);
      for (const fn of pending) {
        try {
          fn();
        } catch (error) {
          console.warn(`[SETU:${this.key}] cleanup error:`, error);
        }
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Text-node utilities (shared by bionic, highlight, TTS, reader)         */
  /* ---------------------------------------------------------------------- */

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'SVG', 'MATH',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'
  ]);

  const Text = {
    /** True when a node belongs to SETU's own UI and must never be processed. */
    isOurs(node) {
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return Boolean(el?.closest?.('[data-setu]'));
    },

    /**
     * Collect visible, meaningful text nodes under `root`.
     * Skips code, form controls, hidden elements, and SETU's own UI.
     */
    collect(root = document.body, { minLength = 2 } = {}) {
      if (!root) return [];

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (Text.isOurs(node)) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length < minLength) return NodeFilter.FILTER_REJECT;

          // getClientRects() is the cheapest reliable "is it actually rendered"
          // check — it covers display:none, visibility:hidden, and zero-size.
          if (!parent.getClientRects().length) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      return nodes;
    },

    /** Best-effort main article text, for summarise / simplify / send-to-Sanctuary. */
    pageText(limit = 12000) {
      const candidates = [
        document.querySelector('article'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('#content, .content, .post-content, .entry-content')
      ].filter(Boolean);

      let best = candidates.find((el) => el.innerText?.trim().length > 400);

      if (!best) {
        // Fall back to whichever block element holds the most paragraph text.
        let bestScore = 0;
        for (const el of document.querySelectorAll('div, section, td')) {
          if (Text.isOurs(el)) continue;
          const paragraphs = el.querySelectorAll(':scope > p');
          if (paragraphs.length < 2) continue;
          const score = [...paragraphs].reduce((sum, p) => sum + p.innerText.length, 0);
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        }
      }

      const text = (best || document.body)?.innerText || '';
      return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, limit);
    },

    /**
     * Viewport rect of the actual rendered text line under (x, y), or null.
     *
     * This is the primitive the line-focus band and reading ruler both need.
     * The obvious approach — caretRangeFromPoint().getBoundingClientRect() —
     * returns a *collapsed* range, whose rect is zero-width, which is why the
     * previous ruler was invisible. Instead we select the whole text node and
     * read getClientRects(), which returns one rect per wrapped line box, then
     * pick the box that vertically contains y.
     */
    lineBoxAt(x, y) {
      const node = Text.caretNodeAt(x, y);
      if (!node) return null;

      const range = document.createRange();
      try {
        range.selectNodeContents(node);
      } catch (_) {
        return null;
      }

      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      if (!rects.length) return null;

      // The line box containing y, else the vertically nearest one.
      const containing = rects.find((r) => y >= r.top && y <= r.bottom);
      if (containing) return containing;

      return rects.reduce((best, r) =>
        Math.abs((r.top + r.bottom) / 2 - y) < Math.abs((best.top + best.bottom) / 2 - y) ? r : best
      );
    },

    /** The text node under a viewport point, across browser caret APIs. */
    caretNodeAt(x, y) {
      let node = null;

      if (document.caretPositionFromPoint) {
        node = document.caretPositionFromPoint(x, y)?.offsetNode || null;
      } else if (document.caretRangeFromPoint) {
        node = document.caretRangeFromPoint(x, y)?.startContainer || null;
      }

      if (node?.nodeType !== Node.TEXT_NODE) return null;
      if (Text.isOurs(node)) return null;
      if (!node.textContent.trim()) return null;
      return node;
    },

    /**
     * Scan horizontally for a line box when the exact point sits in a gutter,
     * margin, or image. Returns the first hit, or null.
     */
    findLineBoxNear(y, { samples = 9 } = {}) {
      const width = window.innerWidth;
      for (let i = 1; i <= samples; i += 1) {
        // Sweep out from the centre: 50%, 35%, 65%, 20%, 80% ...
        const ratio = 0.5 + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.15;
        if (ratio <= 0.02 || ratio >= 0.98) continue;
        const box = Text.lineBoxAt(width * ratio, y);
        if (box) return box;
      }
      return null;
    },

    escape(value) {
      return String(value).replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
      );
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Toast                                                                  */
  /* ---------------------------------------------------------------------- */

  let toastTimer = null;

  function toast(message, { tone = 'info', duration = 2400 } = {}) {
    const root = host('toast', { layer: 'toast', interactive: false });

    let box = root.querySelector('.setu-toast');
    if (!box) {
      const style = document.createElement('style');
      style.textContent = `
        .setu-toast {
          position: fixed; bottom: 24px; left: 50%;
          transform: translateX(-50%) translateY(8px);
          display: flex; align-items: center; gap: 10px;
          max-width: min(420px, 90vw); padding: 12px 18px;
          background: var(--bg-soft); border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: 12px; box-shadow: var(--shadow);
          font-size: 13.5px; font-weight: 500;
          opacity: 0; transition: opacity .2s ease, transform .2s ease;
        }
        .setu-toast[data-show="true"] { opacity: 1; transform: translateX(-50%) translateY(0); }
        .setu-toast[data-tone="success"] { border-left-color: var(--accent-2); }
        .setu-toast[data-tone="warn"]    { border-left-color: var(--warn); }
        .setu-toast[data-tone="error"]   { border-left-color: var(--danger); }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      box = document.createElement('div');
      box.className = 'setu-toast';
      // Announce politely so screen readers pick up feature changes.
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      scope.appendChild(box);
      root.appendChild(scope);
    }

    box.textContent = message;
    box.dataset.tone = tone;
    box.dataset.show = 'true';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      box.dataset.show = 'false';
    }, duration);
  }

  /* ---------------------------------------------------------------------- */
  /* API client                                                             */
  /* ---------------------------------------------------------------------- */

  const API = {
    base: 'http://localhost:3000',

    async init() {
      try {
        const { apiHost } = await chrome.storage.sync.get('apiHost');
        if (apiHost) API.base = apiHost.replace(/\/+$/, '');
      } catch (_) {
        /* default stays */
      }
    },

    /**
     * POST JSON to the SETU backend.
     * Routed through the service worker: content scripts inherit the page's
     * CORS context, and many sites' CSP blocks direct fetches to localhost.
     */
    async post(path, body, { timeoutMs = 60000 } = {}) {
      const response = await chrome.runtime.sendMessage({
        action: 'apiFetch',
        path,
        body,
        timeoutMs
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Could not reach the SETU engine.');
      }
      return response.data;
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Export                                                                 */
  /* ---------------------------------------------------------------------- */

  window.SETU = {
    ready: true,
    VERSION: '3.0.0',
    LAYERS,
    UI: { host, destroyHost, toast },
    Store,
    Feature,
    Text,
    API,
    features: new Map()
  };

  API.init();
})();
