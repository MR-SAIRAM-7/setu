/**
 * SETU Lens — popup controller.
 *
 * A thin control surface. All feature logic lives in the content script; the
 * popup only reads state, sends intents, and reflects what came back. It asks
 * the page for the truth on open rather than trusting stored flags, so the UI
 * cannot drift out of sync with what is actually running.
 */

const $ = (selector) => document.querySelector(selector);

const FEATURES = ['bionic', 'lineFocus', 'highlight', 'focus', 'tts', 'scroll', 'eye', 'breathe'];

class Popup {
  constructor() {
    this.state = null;
    this.tabId = null;
    this.apiHost = 'http://localhost:3000';
  }

  async init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.tabId = tab?.id ?? null;
    this.tabUrl = tab?.url || '';

    const { setuState, apiHost } = await chrome.storage.sync.get(['setuState', 'apiHost']);
    this.state = setuState || {};
    this.apiHost = apiHost || this.apiHost;

    this.wire();
    await this.syncFromPage();
    this.render();
    this.checkEngine();
  }

  /** Ask the content script what is actually on right now. */
  async syncFromPage() {
    const response = await this.send({ action: 'getState' });

    if (!response?.ok) {
      // Restricted pages (chrome://, Web Store, PDF viewer) have no content script.
      if (!/^https?:/i.test(this.tabUrl)) {
        this.blocked = true;
        this.toast('SETU cannot run on this browser page.', 'error', 4000);
      }
      return;
    }

    this.state = response.state;
    this.active = new Set(response.active || []);
  }

  /* ------------------------------------------------------------------ */

  wire() {
    $('#tools').addEventListener('click', (event) => {
      const button = event.target.closest('.tool');
      if (button) this.toggleFeature(button.dataset.feature, button);
    });

    $('#themes').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-theme]');
      if (button) this.setTheme(button.dataset.theme);
    });

    $('#act-commander').onclick = () => this.dispatch({ action: 'openCommander' }, true);
    $('#act-visual').onclick = () => this.dispatch({ action: 'explainVisual' }, true);
    $('#act-chunk').onclick = () =>
      this.dispatch({ action: 'toggleFeature', feature: 'chunking', enabled: true }, true);
    $('#act-sanctuary').onclick = () => this.dispatch({ action: 'sendToSanctuary' }, true);

    $('#act-reset').onclick = async () => {
      await this.send({ action: 'resetAll' });
      await this.syncFromPage();
      this.render();
      this.toast('Everything turned off', 'success');
    };

    $('#act-open-web').onclick = () => {
      chrome.runtime.sendMessage({ action: 'openSanctuary' });
      window.close();
    };

    $('#engine').onclick = () => this.checkEngine(true);

    this.wireSlider('#s-bionic', '#v-bionic', (raw) => `${raw}%`, (raw) => ({ bionicIntensity: raw / 100 }));
    this.wireSlider('#s-wpm', '#v-wpm', (raw) => `${raw} wpm`, (raw) => ({ scrollWpm: raw }));
    this.wireSlider('#s-rate', '#v-rate', (raw) => `${(raw / 10).toFixed(1)}×`, (raw) => ({ ttsRate: raw / 10 }));

    $('#s-language').addEventListener('change', (event) => {
      this.saveSettings({ language: event.target.value.trim() || 'English' });
    });

    $('#save-api').onclick = async () => {
      const value = $('#s-api').value.trim().replace(/\/+$/, '');
      if (!value) return;
      this.apiHost = value;
      await chrome.storage.sync.set({ apiHost: value });
      this.toast('Engine URL saved', 'success');
      this.checkEngine();
    };
  }

  wireSlider(sliderSel, valueSel, format, toSettings) {
    const slider = $(sliderSel);
    const output = $(valueSel);

    slider.addEventListener('input', () => {
      output.textContent = format(Number(slider.value));
    });
    slider.addEventListener('change', () => {
      this.saveSettings(toSettings(Number(slider.value)));
    });
  }

  /* ------------------------------------------------------------------ */

  async toggleFeature(key, button) {
    if (this.blocked) {
      this.toast('SETU cannot run on this page.', 'error');
      return;
    }

    const next = button.getAttribute('aria-pressed') !== 'true';
    // Optimistic flip, corrected below if the page disagrees.
    button.setAttribute('aria-pressed', String(next));

    const response = await this.send({ action: 'toggleFeature', feature: key, enabled: next });

    if (!response?.ok) {
      button.setAttribute('aria-pressed', String(!next));
      this.toast('Could not reach this page. Try reloading it.', 'error');
      return;
    }

    button.setAttribute('aria-pressed', String(response.enabled));
    this.state[key] = response.enabled;
    this.renderActiveCount();
  }

  async setTheme(theme) {
    this.state.theme = theme;
    document.querySelectorAll('#themes button').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.theme === theme));
    });
    await this.send({ action: 'setTheme', theme });
  }

  async saveSettings(patch) {
    this.state.settings = { ...(this.state.settings || {}), ...patch };
    await chrome.storage.sync.set({ setuState: this.state });
    await this.send({ action: 'setSetting', settings: patch });
  }

  /** Fire an intent at the page and close, the way a launcher should behave. */
  async dispatch(message, closeAfter = false) {
    if (this.blocked) {
      this.toast('SETU cannot run on this page.', 'error');
      return;
    }
    const response = await this.send(message);
    if (!response?.ok) {
      this.toast('Could not reach this page. Try reloading it.', 'error');
      return;
    }
    if (closeAfter) window.close();
  }

  async send(message) {
    if (!this.tabId) return null;
    try {
      return await chrome.tabs.sendMessage(this.tabId, message);
    } catch (_) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */

  render() {
    for (const key of FEATURES) {
      const button = document.querySelector(`.tool[data-feature="${key}"]`);
      if (button) button.setAttribute('aria-pressed', String(Boolean(this.state[key])));
    }

    const theme = this.state.theme || 'default';
    document.querySelectorAll('#themes button').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.theme === theme));
    });

    const settings = this.state.settings || {};
    const set = (selector, value) => {
      const el = $(selector);
      if (el) el.value = value;
    };

    set('#s-bionic', Math.round((settings.bionicIntensity ?? 0.45) * 100));
    set('#s-wpm', settings.scrollWpm ?? 220);
    set('#s-rate', Math.round((settings.ttsRate ?? 1) * 10));
    set('#s-language', settings.language ?? 'English');
    set('#s-api', this.apiHost);

    $('#v-bionic').textContent = `${Math.round((settings.bionicIntensity ?? 0.45) * 100)}%`;
    $('#v-wpm').textContent = `${settings.scrollWpm ?? 220} wpm`;
    $('#v-rate').textContent = `${(settings.ttsRate ?? 1).toFixed(1)}×`;

    this.renderActiveCount();
  }

  renderActiveCount() {
    const count = FEATURES.filter((key) => this.state[key]).length;
    $('#active-count').textContent = count ? `${count} on` : '';
  }

  /** Probe the engine so a dead backend is visible before the user hits it. */
  async checkEngine(verbose = false) {
    const engine = $('#engine');
    const label = $('#engine-label');

    engine.dataset.state = '';
    label.textContent = 'checking';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${this.apiHost}/api/health`, { signal: controller.signal });
      clearTimeout(timer);

      const health = await response.json();
      engine.dataset.state = 'ok';
      label.textContent = health.aiConfigured ? 'AI ready' : 'no API key';
      if (!health.aiConfigured && verbose) {
        this.toast('Engine is up but has no API key — set GEMINI_API_KEY.', 'error', 5000);
      }
    } catch (_) {
      engine.dataset.state = 'down';
      label.textContent = 'offline';
      if (verbose) {
        this.toast(`No engine at ${this.apiHost}. Run "npm start" in /backend.`, 'error', 5000);
      }
    }
  }

  toast(message, tone = 'info', duration = 2600) {
    const el = $('#toast');
    el.textContent = message;
    el.dataset.tone = tone;
    el.dataset.show = 'true';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.dataset.show = 'false';
    }, duration);
  }
}

document.addEventListener('DOMContentLoaded', () => new Popup().init());
