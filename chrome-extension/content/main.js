/**
 * SETU Lens — content script orchestrator.
 *
 * Owns the feature registry, message routing, keyboard shortcuts, and state
 * sync. Every feature is independent and isolated, so any combination can run
 * at once: Bionic + Line Focus + Read Aloud + Auto Scroll compose without
 * touching each other's DOM.
 *
 * Loaded last, after setu-core.js and every feature module.
 */

(() => {
  if (window.setuLens) return;

  const { Store, UI, Text, API, features: registry } = window.SETU;

  /** Features driven by a persisted on/off flag. */
  const TOGGLES = ['bionic', 'focus', 'lineFocus', 'highlight', 'scroll', 'tts', 'eye', 'dyslexia', 'breathe', 'chunking'];

  /** Features opened on demand rather than toggled from stored state. */
  const ON_DEMAND = ['commander', 'visual'];

  class SetuLens {
    constructor() {
      this.features = new Map();
      this.booted = false;
    }

    async boot() {
      if (this.booted) return;
      this.booted = true;

      for (const [key, FeatureClass] of registry) {
        try {
          this.features.set(key, new FeatureClass());
        } catch (error) {
          console.error(`[SETU] could not construct "${key}":`, error);
        }
      }

      await Store.load();
      await API.init();

      this.bindMessages();
      this.bindShortcuts();
      this.watchStorage();
      this.applyState();

      console.log(`[SETU Lens ${window.SETU.VERSION}] ready — ${this.features.size} features`);
    }

    /** Turn on whatever the stored state says should be on. */
    applyState() {
      const state = Store.get();

      for (const key of TOGGLES) {
        const feature = this.features.get(key);
        if (!feature) continue;

        const shouldRun = Boolean(state[key]);
        if (shouldRun === feature.enabled) continue;

        try {
          if (shouldRun) feature.enable();
          else feature.disable();
        } catch (error) {
          // A feature that cannot start (e.g. no readable article, camera
          // denied) must not block the others or corrupt stored state.
          console.warn(`[SETU] "${key}" could not start:`, error.message);
          Store.set({ [key]: false });
        }
      }

      if (state.theme && state.theme !== 'default') {
        this.features.get('dyslexia')?.setTheme(state.theme);
      }
    }

    /** Toggle one feature and persist the result. */
    toggle(key, next) {
      const feature = this.features.get(key);
      if (!feature) {
        console.warn(`[SETU] unknown feature "${key}"`);
        return false;
      }

      const target = typeof next === 'boolean' ? next : !feature.enabled;

      try {
        if (target) feature.enable();
        else feature.disable();
      } catch (error) {
        UI.toast(`Could not start ${key}.`, { tone: 'error' });
        Store.set({ [key]: false });
        return false;
      }

      if (TOGGLES.includes(key)) {
        Store.set({ [key]: feature.enabled });
      }
      return feature.enabled;
    }

    setTheme(theme) {
      Store.set({ theme });
      this.features.get('dyslexia')?.setTheme(theme);
      UI.toast(theme === 'default' ? 'Theme cleared' : `Theme: ${theme}`);
    }

    speak(text) {
      const tts = this.features.get('tts');
      if (!tts) return;
      if (!tts.enabled) this.toggle('tts', true);
      tts.speak(text);
    }

    /** Snapshot used by the chunker and anything else needing page context. */
    pageContext(options) {
      return this.features.get('commander')?.snapshot(options) || {
        url: location.href,
        title: document.title,
        headings: [],
        controls: [],
        text: Text.pageText(3000)
      };
    }

    resetAll() {
      for (const [key, feature] of this.features) {
        try {
          feature.disable();
        } catch (_) {
          /* keep going — one bad teardown must not strand the rest */
        }
        if (TOGGLES.includes(key)) Store.set({ [key]: false }, { persist: false });
      }
      Store.set({ theme: 'default' });
      UI.toast('All SETU features turned off', { tone: 'success' });
    }

    /* ------------------------------------------------------------------ */

    bindMessages() {
      chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        // Returning true keeps the channel open for async replies.
        (async () => {
          try {
            switch (request.action) {
              case 'ping':
                return sendResponse({ ok: true, version: window.SETU.VERSION });

              case 'toggleFeature':
              case 'toggleMode':
                return sendResponse({
                  ok: true,
                  enabled: this.toggle(request.feature || request.mode, request.enabled)
                });

              case 'setTheme':
                this.setTheme(request.theme);
                return sendResponse({ ok: true });

              case 'setSetting':
                await Store.set({ settings: request.settings });
                for (const feature of this.features.values()) {
                  if (feature.enabled) feature.onSettings();
                }
                return sendResponse({ ok: true });

              case 'getState':
                return sendResponse({
                  ok: true,
                  state: Store.get(),
                  active: [...this.features].filter(([, f]) => f.enabled).map(([k]) => k)
                });

              case 'openCommander':
                this.features.get('commander')?.open(request.task || '');
                return sendResponse({ ok: true });

              case 'explainVisual':
                this.toggle('visual', true);
                return sendResponse({ ok: true });

              case 'getPageContent':
                return sendResponse({
                  ok: true,
                  title: document.title,
                  url: location.href,
                  text: Text.pageText(request.limit || 12000)
                });

              case 'speakText':
                this.speak(request.text);
                return sendResponse({ ok: true });

              case 'sendToSanctuary': {
                const result = await this.features.get('sanctuary')?.send();
                return sendResponse({ ok: Boolean(result?.ok) });
              }

              case 'resetAll':
                this.resetAll();
                return sendResponse({ ok: true });

              default:
                return sendResponse({ ok: false, error: `Unknown action "${request.action}"` });
            }
          } catch (error) {
            console.error('[SETU] message handler failed:', error);
            sendResponse({ ok: false, error: error.message });
          }
        })();

        return true;
      });
    }

    bindShortcuts() {
      // Alt+key shortcuts, ignored while the user is typing.
      document.addEventListener(
        'keydown',
        (event) => {
          if (!event.altKey || event.ctrlKey || event.metaKey) return;

          const active = document.activeElement;
          if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;

          const map = {
            b: 'bionic',
            f: 'focus',
            l: 'lineFocus',
            h: 'highlight',
            s: 'scroll',
            t: 'tts',
            e: 'eye'
          };

          const key = event.key.toLowerCase();

          if (map[key]) {
            event.preventDefault();
            this.toggle(map[key]);
          } else if (key === 'c') {
            event.preventDefault();
            this.features.get('commander')?.open();
          } else if (key === 'x') {
            event.preventDefault();
            this.resetAll();
          }
        },
        true
      );
    }

    /** Keep this tab in step with changes made in the popup or another tab. */
    watchStorage() {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' || !changes.setuState) return;

        const incoming = changes.setuState.newValue;
        if (!incoming) return;

        Store.set(incoming, { persist: false });
        this.applyState();

        for (const feature of this.features.values()) {
          if (feature.enabled) feature.onSettings();
        }
      });
    }
  }

  const lens = new SetuLens();
  window.setuLens = lens;

  const start = () => lens.boot().catch((error) => console.error('[SETU] boot failed:', error));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
