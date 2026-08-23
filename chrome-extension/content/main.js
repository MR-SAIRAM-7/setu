/**
 * SETU Lens — content script orchestrator.
 *
 * Owns the feature registry, message routing, keyboard shortcuts, navigation
 * detection, and state sync.
 *
 * Every feature is independent and isolated, and that is enforced rather than
 * hoped for. Four rules make any combination safe to run at once:
 *
 *  1. No feature touches another's DOM. Each owns exactly one shadow root, and
 *     the ones that read the page (bionic, read-aloud) never write to it.
 *  2. Floating panels are placed by the shared Dock, not pinned to a corner, so
 *     six open tools stack instead of burying each other.
 *  3. Anything that scrolls goes through the shared Scroll arbiter, so Auto
 *     Scroll, Gaze Scroll, and read-aloud's follow-along cooperate — and all
 *     three keep working inside Focus Mode's own scroller.
 *  4. Anything that addresses page controls goes through the shared Page
 *     snapshot, which hands out handles instead of writing attributes, so the
 *     agent and the 3-step path can both be live at once.
 *
 * Loaded last, after setu-core.js and every feature module.
 */

(() => {
  if (window.setuLens) return;

  const { Store, UI, Text, API, Page, Dock, features: registry } = window.SETU;

  /**
   * Features driven by a persisted on/off flag.
   *
   * Deliberately excludes anything that costs a model call to start. Task
   * chunking used to live here, which meant a user who tried it once fired an
   * AI request on every page load they made afterwards — an invisible, unasked
   * drain on a metered quota.
   */
  const TOGGLES = ['bionic', 'focus', 'lineFocus', 'highlight', 'scroll', 'tts', 'eye', 'breathe'];

  /**
   * On-demand tools that should restart when invoked while already open —
   * picking a second chart, regenerating the 3-step path. Deliberately does
   * not include the Commander: re-opening it from the popup mid-plan must not
   * throw away the conversation.
   */
  const RESTARTABLE = ['visual', 'chunking'];

  /**
   * Features that re-read the page after a single-page-app navigation.
   *
   * Bionic Reading is deliberately absent: its MutationObserver already sees
   * the swapped-in content and re-anchors it, so calling onNavigate as well
   * would re-walk the whole document for nothing. Line Focus and the ruler
   * track the cursor and have no stored view of the page to go stale.
   */
  const NAVIGATION_AWARE = ['focus', 'chunking'];

  /**
   * Shortcuts handled here.
   *
   * Alt+B / Alt+F / Alt+L / Alt+Shift+C are deliberately absent: those are
   * declared as `commands` in the manifest, and binding them in both places
   * fired the toggle twice per press, which read to the user as the shortcut
   * being broken.
   */
  const LOCAL_SHORTCUTS = {
    t: 'tts',
    h: 'highlight',
    s: 'scroll',
    e: 'eye'
  };

  /** Documents we should not touch at all. */
  function isSupportedDocument() {
    const type = (document.contentType || '').toLowerCase();
    if (type && !/^(text\/html|application\/xhtml\+xml)$/.test(type)) return false;
    // Chrome's PDF and image viewers are HTML shells with no readable content.
    if (document.querySelector('embed[type="application/pdf"]')) return false;
    return true;
  }

  class SetuLens {
    constructor() {
      this.features = new Map();
      this.booted = false;
      /** Last time each feature was toggled, to de-duplicate double sources. */
      this.lastToggleAt = new Map();
      this.lastUrl = location.href;
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
      // Narrow the agent's storage key to this tab before anything reads it.
      await window.SETU.Session.resolve();

      this.bindMessages();
      this.bindShortcuts();
      this.watchStorage();
      this.watchNavigation();
      await this.applyState();
      await this.resumeAgentSession();

      console.log(
        `[SETU ${window.SETU.VERSION}] ready — ${this.features.size} features, ` +
          `${[...this.features].filter(([, f]) => f.enabled).length} active`
      );
    }

    /** Sessions older than this are treated as abandoned rather than resumed. */
    static SESSION_TTL_MS = 2 * 60 * 60 * 1000;

    /**
     * Reopen the agent if it was open when the page navigated or refreshed.
     *
     * Reads sessionStorage first, then the per-tab mirror in chrome.storage.local
     * for sites that block sessionStorage. The mirror's key is scoped to this
     * tab — an unscoped key would reopen one page's plan on every other tab in
     * the browser.
     */
    async resumeAgentSession() {
      let pending = false;
      try {
        pending = Boolean(sessionStorage.getItem('setu_agent_session'));
      } catch (_) {
        /* storage blocked */
      }

      if (!pending && chrome.storage?.local) {
        try {
          const key = window.SETU.Session.key;
          const res = await new Promise((resolve) => chrome.storage.local.get(key, resolve));
          const stored = res?.[key];
          const session = typeof stored === 'string' ? JSON.parse(stored) : stored;

          if (session?.open && Date.now() - (session.savedAt || 0) < SetuLens.SESSION_TTL_MS) {
            pending = true;
          }
        } catch (_) {
          /* ignore */
        }
      }

      if (pending) {
        try {
          await this.toggle('commander', true);
        } catch (err) {
          console.warn('[SETU] could not resume commander:', err);
        }
      }
    }

    /** Turn on whatever the stored state says should be on. */
    async applyState() {
      const state = Store.get();

      for (const key of TOGGLES) {
        const feature = this.features.get(key);
        if (!feature) continue;

        const shouldRun = Boolean(state[key]);
        if (shouldRun === feature.enabled) continue;

        try {
          if (shouldRun) await feature.enable();
          else feature.disable();
        } catch (error) {
          // A feature that cannot start (no readable article, camera denied)
          // must not block the others or leave a lie in stored state.
          console.warn(`[SETU] "${key}" could not start:`, error.message);
          Store.set({ [key]: false });
        }
      }

      this.applyTheme(state.theme);
    }

    /**
     * Themes are driven purely by `state.theme`.
     *
     * They used to *also* be a persisted boolean toggle, and the two disagreed:
     * saving a theme echoed back through storage as "the theme feature is off",
     * so the reconciler stripped the theme a frame after it was applied and no
     * theme could ever stay on screen.
     */
    applyTheme(theme) {
      const feature = this.features.get('theme');
      if (!feature) return;

      if (!theme || theme === 'default') {
        feature.disable();
        return;
      }
      feature.applyTheme(theme);
    }

    /**
     * Toggle one feature and persist the result.
     *
     * `source` lets us drop a duplicate that arrived from both a manifest
     * command and a page keydown in the same press. `options` is handed to the
     * feature's onEnable, so a caller can start it *about something*.
     */
    async toggle(key, next, { source = 'local', ...options } = {}) {
      const feature = this.features.get(key);
      if (!feature) {
        console.warn(`[SETU] unknown feature "${key}"`);
        return false;
      }

      const now = Date.now();
      const previous = this.lastToggleAt.get(key);
      if (previous && previous.source !== source && now - previous.at < 150) {
        // Same press, two delivery paths. Honour the first, ignore the echo.
        return feature.enabled;
      }
      this.lastToggleAt.set(key, { at: now, source });

      const target = typeof next === 'boolean' ? next : !feature.enabled;

      // Re-invoking an already-open picker should restart it rather than
      // silently doing nothing (picking a second chart, for example).
      if (target && feature.enabled && RESTARTABLE.includes(key)) {
        feature.disable();
      }

      try {
        if (target) await feature.enable(options);
        else feature.disable();
      } catch (error) {
        UI.toast(error.message || `Could not start ${key}.`, { tone: 'error', duration: 4200 });
        if (TOGGLES.includes(key)) Store.set({ [key]: false });
        return false;
      }

      if (TOGGLES.includes(key)) {
        Store.set({ [key]: feature.enabled });
      }

      // A panel appeared or vanished; re-flow whatever else is on screen.
      Dock.layout();
      return feature.enabled;
    }

    setTheme(theme) {
      this.applyTheme(theme);
      Store.set({ theme });
      UI.toast(theme === 'default' ? 'Reading theme off' : `Reading theme: ${theme}`, {
        tone: 'success'
      });
    }

    /**
     * Speak some text.
     *
     * Goes straight to the shared voice rather than forcing the Read Aloud
     * transport bar open. A mind-map node speaking itself on hover, or the
     * agent reading back an answer, should not put a control bar on screen the
     * reader did not ask for.
     */
    async speak(text) {
      const words = String(text || '').trim() || Text.selection();
      if (!words) {
        UI.toast('Nothing to read there.', { tone: 'warn' });
        return;
      }
      await window.SETU.Voice?.say(words);
    }

    /** Snapshot used by the chunker, the agent, and anything needing context. */
    pageContext(options) {
      return Page.snapshot(options);
    }

    resetAll() {
      window.SETU.Voice?.stop();

      for (const [key, feature] of this.features) {
        try {
          feature.disable();
        } catch (_) {
          /* keep going — one bad teardown must not strand the rest */
        }
        if (TOGGLES.includes(key)) Store.set({ [key]: false }, { persist: false });
      }
      Store.set({ theme: 'default' });
      try {
        sessionStorage.removeItem('setu_agent_session');
      } catch (_) {
        /* ignore */
      }
      UI.toast('All SETU features turned off', { tone: 'success' });
    }

    /** Everything the popup needs to render an accurate control surface. */
    describe() {
      return {
        version: window.SETU.VERSION,
        state: Store.get(),
        active: [...this.features].filter(([, f]) => f.enabled).map(([k]) => k),
        available: [...this.features.keys()]
      };
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
                  enabled: await this.toggle(request.feature || request.mode, request.enabled, {
                    source: request.source || 'message'
                  })
                });

              case 'setTheme':
                this.setTheme(request.theme);
                return sendResponse({ ok: true });

              case 'setSetting':
                await Store.set({ settings: request.settings });
                UI.applyAppearance();
                for (const feature of this.features.values()) {
                  if (feature.enabled) feature.onSettings();
                }
                return sendResponse({ ok: true });

              case 'getState':
                return sendResponse({ ok: true, ...this.describe() });

              case 'openCommander':
                await this.toggle('commander', true, { source: request.source || 'message' });
                this.features.get('commander')?.open(request.task || '');
                return sendResponse({ ok: true });

              case 'explainVisual':
                await this.toggle('visual', true, {
                  source: 'message',
                  selection: request.selection || ''
                });
                return sendResponse({ ok: true });

              case 'getPageContent':
                return sendResponse({
                  ok: true,
                  title: document.title,
                  url: location.href,
                  selection: Text.selection(),
                  text: Text.pageText(request.limit || 12000)
                });

              case 'speakText':
                await this.speak(request.text || Text.selection());
                return sendResponse({ ok: true });

              case 'sendToSanctuary': {
                const result = await this.features.get('sanctuary')?.send();
                return sendResponse({ ok: Boolean(result?.ok), error: result?.error });
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
          if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) {
            return;
          }

          const key = (event.key || '').toLowerCase();

          if (LOCAL_SHORTCUTS[key]) {
            event.preventDefault();
            this.toggle(LOCAL_SHORTCUTS[key], undefined, { source: 'keydown' });
          } else if (key === 'm') {
            event.preventDefault();
            this.toggle('visual', true, { source: 'keydown' });
          } else if (key === '3') {
            event.preventDefault();
            this.toggle('chunking', true, { source: 'keydown' });
          } else if (key === 'c' && !event.shiftKey) {
            // Alt+Shift+C is the manifest command; Alt+C is ours.
            event.preventDefault();
            this.toggle('commander', true, { source: 'keydown' }).then(() =>
              this.features.get('commander')?.open()
            );
          } else if (key === 'x') {
            event.preventDefault();
            this.resetAll();
          }
        },
        true
      );
    }

    /**
     * Notice a single-page-app navigation.
     *
     * A great many sites — every React or Vue router, most news sites, all of
     * YouTube and GitHub — replace the entire article without ever loading a
     * document. Nothing fires that a content script can hear by default, so
     * Bionic Reading stayed applied to text that no longer existed and the
     * 3-step path kept describing the previous page. Patching the History API
     * is the only way to hear about it, and is what every extension that has
     * to survive an SPA ends up doing.
     */
    watchNavigation() {
      const announce = () => {
        if (location.href === this.lastUrl) return;
        this.lastUrl = location.href;

        // Let the new view render before anything re-reads it.
        setTimeout(() => this.onNavigated(), 350);
      };

      for (const method of ['pushState', 'replaceState']) {
        const original = history[method];
        if (typeof original !== 'function') continue;
        history[method] = function patched(...args) {
          const result = original.apply(this, args);
          try {
            window.dispatchEvent(new Event('setu:navigation'));
          } catch (_) {
            /* ignore */
          }
          return result;
        };
      }

      window.addEventListener('setu:navigation', announce);
      window.addEventListener('popstate', announce);
      window.addEventListener('hashchange', announce);
    }

    onNavigated() {
      for (const key of NAVIGATION_AWARE) {
        const feature = this.features.get(key);
        if (!feature?.enabled) continue;
        try {
          feature.onNavigate();
        } catch (error) {
          console.warn(`[SETU] "${key}" could not follow the navigation:`, error.message);
        }
      }
      Dock.layout();
    }

    /** Keep this tab in step with changes made in the popup or another tab. */
    watchStorage() {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'sync' && changes.apiHost) {
          await API.init();
        }

        if (area !== 'sync' || !changes.setuState) return;

        const incoming = changes.setuState.newValue;
        if (!incoming) return;

        // Our own write, bouncing back. Reconciling against it would undo the
        // change we just made — this is what used to strip themes instantly.
        if (Store.isOwnEcho(incoming)) return;

        Store.adopt(incoming);
        await this.applyState();
        // Repaint open overlays when the palette was changed elsewhere —
        // the options page, or another tab.
        UI.applyAppearance();

        for (const feature of this.features.values()) {
          if (feature.enabled) feature.onSettings();
        }
      });
    }
  }

  if (!isSupportedDocument()) {
    console.debug('[SETU] skipping unsupported document type:', document.contentType);
    return;
  }

  const setu = new SetuLens();
  window.setu = setu;
  window.setuExtension = setu;
  window.setuLens = setu;

  const start = () => setu.boot().catch((error) => console.error('[SETU] boot failed:', error));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
