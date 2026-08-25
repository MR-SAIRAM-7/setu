/**
 * SETU — Options Page Controller (Broadsheet Design System).
 *
 * Exists so the engine URL, Sanctuary workspace, and cognitive reading
 * preferences are first-class, testable settings.
 * Everything saves dynamically with debounce; live preview reflects
 * chosen typography, letter spacing, and line height in real time.
 */

const $ = (selector) => document.querySelector(selector);

const IS_MAC = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const ALT = IS_MAC ? '⌥' : 'Alt+';
const SHIFT = IS_MAC ? '⇧' : 'Shift+';

const KEY_MAP = [
  [`${ALT}${SHIFT}C`, 'Open SETU Commander (Voice & Text Copilot)'],
  [`${ALT}B`, 'Toggle Bionic Reading Fixations'],
  [`${ALT}F`, 'Toggle Focus Mode (Sensory Reader)'],
  [`${ALT}L`, 'Toggle Line Focus Band'],
  [`${ALT}H`, 'Toggle Reading Ruler (Line/Word/Block)'],
  [`${ALT}T`, 'Toggle Read Aloud with Spoken Word Highlight'],
  [`${ALT}S`, 'Toggle Smooth Hands-Free Auto Scroll'],
  [`${ALT}E`, 'Toggle Gaze Scroll (Head Tracking)'],
  [`${ALT}M`, 'Map a Chart, Image or Section as a Mind Map'],
  [`${ALT}3`, 'Break This Page Into a 3-Step Path'],
  [`${ALT}X`, 'Turn Every Active SETU Tool Off']
];

const DEFAULT_SETTINGS = {
  bionicIntensity: 0.45,
  lineFocusHeight: 1,
  highlightColor: '#0088b0',
  scrollWpm: 220,
  ttsRate: 1,
  ttsPitch: 1,
  ttsVoice: '',
  ttsSpeaker: '',
  ttsLanguage: 'en-IN',
  ttsExplain: false,
  gazeSensitivity: 1,
  gazeInvert: false,
  fontScale: 1,
  appearance: 'light',
  letterSpacing: 0.02,
  lineHeight: 1.8,
  language: 'English'
};

/**
 * One line per language for the voice preview.
 *
 * Written in each language rather than transliterated: a Bulbul voice reading
 * romanised Hindi sounds nothing like the same voice reading Devanagari, and
 * the preview would be misleading about the thing being previewed.
 */
const SAMPLE_LINES = {
  'en-IN': 'This is how I will read your pages aloud.',
  'hi-IN': 'मैं आपके पन्ने इसी आवाज़ में पढ़कर सुनाऊँगी।',
  'bn-IN': 'আমি এই কণ্ঠেই আপনার পাতা পড়ে শোনাব।',
  'gu-IN': 'હું આ અવાજમાં તમારાં પાનાં વાંચી સંભળાવીશ.',
  'kn-IN': 'ನಾನು ಈ ಧ್ವನಿಯಲ್ಲಿ ನಿಮ್ಮ ಪುಟಗಳನ್ನು ಓದುತ್ತೇನೆ.',
  'ml-IN': 'ഈ ശബ്ദത്തിൽ ഞാൻ നിങ്ങളുടെ പേജുകൾ വായിച്ചു കേൾപ്പിക്കും.',
  'mr-IN': 'मी याच आवाजात तुमची पाने वाचून दाखवेन.',
  'od-IN': 'ମୁଁ ଏହି ସ୍ୱରରେ ଆପଣଙ୍କ ପୃଷ୍ଠା ପଢ଼ି ଶୁଣାଇବି।',
  'pa-IN': 'ਮੈਂ ਇਸੇ ਆਵਾਜ਼ ਵਿੱਚ ਤੁਹਾਡੇ ਪੰਨੇ ਪੜ੍ਹ ਕੇ ਸੁਣਾਵਾਂਗੀ।',
  'ta-IN': 'இந்தக் குரலில் உங்கள் பக்கங்களை நான் வாசித்துக் காட்டுவேன்.',
  'te-IN': 'ఈ స్వరంతోనే నేను మీ పేజీలను చదివి వినిపిస్తాను.'
};

const SAMPLE_WORDS = [
  'Attention', 'is', 'the', 'part', 'that', 'changed', 'everything.',
  'Instead', 'of', 'reading', 'a', 'sentence', 'word', 'by', 'word',
  'and', 'hoping', 'to', 'remember', 'the', 'start', 'by', 'the', 'time',
  'it', 'reaches', 'the', 'end,', 'the', 'model', 'looks', 'at', 'every',
  'word', 'at', 'once', 'and', 'decides', 'which', 'actually', 'matter.'
];

class Options {
  constructor() {
    this.state = null;
  }

  async init() {
    this.renderIcons();
    const manifest = chrome.runtime.getManifest();
    if ($('#version')) $('#version').textContent = `v${manifest.version}`;

    this.renderKeys();

    const { setuState, apiHost, sanctuaryUrl } = await chrome.storage.sync.get([
      'setuState',
      'apiHost',
      'sanctuaryUrl'
    ]);

    this.state = setuState || {};
    this.state.settings = { ...DEFAULT_SETTINGS, ...(this.state.settings || {}) };

    // Before the first paint, so the page never flashes the wrong palette.
    self.setuApplyAppearance(this.state.settings.appearance);

    const currentApiHost = apiHost || self.SETU_DEFAULTS?.apiHost || '';
    const currentSanctuaryUrl = sanctuaryUrl || self.SETU_DEFAULTS?.sanctuaryUrl || '';

    if ($('#api-host')) $('#api-host').value = currentApiHost;
    if ($('#sanctuary-url')) $('#sanctuary-url').value = currentSanctuaryUrl;
    if ($('#open-sanctuary-link')) $('#open-sanctuary-link').href = currentSanctuaryUrl;

    this.renderSettings();
    this.wire();
    this.renderDiagnostics();
    this.testEngine();
    this.loadVoices();
  }

  /**
   * Ask the engine which natural voices it can actually speak with.
   *
   * The catalogue is not static: which speakers exist depends on the Bulbul
   * model version the engine is configured for, and a speaker from the wrong
   * version is a hard 400 on every request. Reading the live list is the only
   * way to offer a choice that is guaranteed to work.
   */
  async loadVoices() {
    const speaker = $('#speaker');
    const language = $('#tts-language');
    const label = $('#v-voice');
    if (!speaker || !language) return;

    const response = await chrome.runtime.sendMessage({
      action: 'apiFetch',
      method: 'GET',
      path: '/api/speech/voices',
      timeoutMs: 10000
    });

    const data = response?.ok ? response.data : null;
    const chosenSpeaker = this.state.settings.ttsSpeaker || '';
    const chosenLanguage = this.state.settings.ttsLanguage || 'en-IN';

    if (!data?.enabled) {
      if (label) label.textContent = "this browser's voice";
      speaker.innerHTML = '<option value="">Browser default voice</option>';
      speaker.disabled = true;
      return;
    }

    speaker.disabled = false;
    speaker.innerHTML = [
      '<option value="">Engine default</option>',
      ...(data.voices || []).map(
        (voice) =>
          `<option value="${escapeHtml(voice.id)}"${voice.id === chosenSpeaker ? ' selected' : ''}>${escapeHtml(
            voice.label || voice.id
          )}${voice.note ? ` — ${escapeHtml(voice.note)}` : ''}</option>`
      )
    ].join('');

    language.innerHTML = (data.languages || [{ code: 'en-IN', name: 'English', native: 'English' }])
      .map(
        (entry) =>
          `<option value="${escapeHtml(entry.code)}"${entry.code === chosenLanguage ? ' selected' : ''}>${escapeHtml(
            entry.native || entry.name
          )}</option>`
      )
      .join('');

    if (label) {
      const current = (data.voices || []).find((voice) => voice.id === chosenSpeaker);
      label.textContent = current?.label || data.defaultSpeaker || 'engine default';
    }
  }

  /**
   * Speak one line in the chosen voice.
   *
   * Picking a voice from a list of names is guesswork — "Ritu, bright and
   * clear" tells you almost nothing about whether you want to listen to it for
   * twenty minutes. Playing it does.
   */
  async previewVoice() {
    const button = $('#preview-voice');
    if (!button || button.dataset.busy === 'true') return;

    button.dataset.busy = 'true';
    const original = button.textContent;
    button.textContent = 'Speaking…';

    try {
      const languageCode = this.state.settings.ttsLanguage || 'en-IN';
      const sample = SAMPLE_LINES[languageCode] || SAMPLE_LINES['en-IN'];

      const response = await chrome.runtime.sendMessage({
        action: 'apiFetch',
        method: 'POST',
        path: '/api/speech',
        timeoutMs: 30000,
        body: {
          text: sample,
          speaker: this.state.settings.ttsSpeaker || undefined,
          language: languageCode,
          pace: this.state.settings.ttsRate || 1
        }
      });

      if (!response?.ok || !response.data?.audio) {
        this.toast(response?.error || 'The voice engine did not answer.', 'error');
        return;
      }

      const audio = new Audio(`data:${response.data.mime || 'audio/mpeg'};base64,${response.data.audio}`);
      await audio.play();
    } catch (error) {
      this.toast(`Could not play that voice: ${error.message}`, 'error');
    } finally {
      button.dataset.busy = 'false';
      button.textContent = original;
    }
  }

  /** Mark the selected appearance chip. Anything unrecognised means light. */
  renderAppearance(choice) {
    const selected = choice === 'dark' || choice === 'auto' ? choice : 'light';
    document.querySelectorAll('[data-appearance-choice]').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.appearanceChoice === selected));
    });
  }

  renderIcons() {
    if (!window.SETU_ICONS?.icon) return;
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      const size = el.dataset.iconSize ? parseInt(el.dataset.iconSize, 10) : 18;
      el.innerHTML = window.SETU_ICONS.icon(name, { size });
    });
  }

  renderKeys() {
    const keysList = $('#keys');
    if (!keysList) return;
    keysList.innerHTML = KEY_MAP.map(
      ([key, description]) => `<li><span>${description}</span><kbd>${key}</kbd></li>`
    ).join('');
  }

  renderSettings() {
    const s = this.state.settings;
    if ($('#language')) $('#language').value = s.language || 'English';
    this.renderAppearance(s.appearance);
    this.renderGazeDirection(Boolean(s.gazeInvert));
    if ($('#bionic')) $('#bionic').value = Math.round((s.bionicIntensity ?? 0.45) * 100);
    if ($('#spacing')) $('#spacing').value = Math.round((s.letterSpacing ?? 0.02) * 100);
    if ($('#line')) $('#line').value = Math.round((s.lineHeight ?? 1.8) * 10);
    if ($('#wpm')) $('#wpm').value = s.scrollWpm ?? 220;
    if ($('#rate')) $('#rate').value = Math.round((s.ttsRate ?? 1) * 10);
    if ($('#gaze')) $('#gaze').value = Math.round((s.gazeSensitivity ?? 1) * 10);
    this.paintValues();
  }

  renderGazeDirection(inverted) {
    document.querySelectorAll('[data-gaze-choice]').forEach((button) => {
      const isInverted = button.dataset.gazeChoice === 'inverted';
      button.setAttribute('aria-checked', String(isInverted === inverted));
    });
  }

  paintValues() {
    const s = this.state.settings;
    if ($('#v-language')) $('#v-language').textContent = s.language || 'English';
    if ($('#v-bionic')) $('#v-bionic').textContent = `${Math.round((s.bionicIntensity ?? 0.45) * 100)}%`;
    if ($('#v-spacing')) $('#v-spacing').textContent = `${(s.letterSpacing ?? 0.02).toFixed(2)}em`;
    if ($('#v-line')) $('#v-line').textContent = (s.lineHeight ?? 1.8).toFixed(1);
    if ($('#v-wpm')) $('#v-wpm').textContent = `${s.scrollWpm ?? 220} wpm`;
    if ($('#v-rate')) $('#v-rate').textContent = `${(s.ttsRate ?? 1).toFixed(1)}×`;
    if ($('#v-gaze')) $('#v-gaze').textContent = `${(s.gazeSensitivity ?? 1).toFixed(1)}×`;

    // Dynamic Live Sample Preview
    const preview = $('#preview');
    if (preview) {
      preview.style.letterSpacing = `${s.letterSpacing ?? 0.02}em`;
      preview.style.lineHeight = String(s.lineHeight ?? 1.8);

      const intensity = s.bionicIntensity ?? 0.45;
      const formatted = SAMPLE_WORDS.map((word) => {
        const len = word.length;
        if (len <= 1) return `<b>${word}</b>`;
        const fixLen = Math.max(1, Math.ceil(len * intensity));
        const fix = word.slice(0, fixLen);
        const rest = word.slice(fixLen);
        return `<b style="font-weight: 800; color: var(--text);">${fix}</b>${rest}`;
      }).join(' ');

      const p = preview.querySelector('p') || preview;
      p.innerHTML = formatted;
    }
  }

  wire() {
    $('#api-host')?.addEventListener('change', async (event) => {
      const value = this.cleanUrl(event.target.value);
      if (!value) {
        this.toast('Please enter a valid URL (e.g. https://setu-37hl.onrender.com)', 'error');
        return;
      }
      event.target.value = value;
      await chrome.storage.sync.set({ apiHost: value });
      this.toast('Engine URL saved', 'success');
      this.testEngine();
    });

    $('#sanctuary-url')?.addEventListener('change', async (event) => {
      const value = this.cleanUrl(event.target.value);
      if (!value) {
        this.toast('Please enter a valid URL (e.g. https://setu-amber.vercel.app)', 'error');
        return;
      }
      event.target.value = value;
      await chrome.storage.sync.set({ sanctuaryUrl: value });
      if ($('#open-sanctuary-link')) $('#open-sanctuary-link').href = value;
      this.toast('Sanctuary URL saved', 'success');
    });

    $('#test-engine')?.addEventListener('click', () => this.testEngine());

    $('#language')?.addEventListener('change', (event) => {
      const val = event.target.value.trim() || 'English';
      this.saveSetting({ language: val });
    });

    $('#appearance')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-appearance-choice]');
      if (!button) return;
      const choice = button.dataset.appearanceChoice;
      // Repaint this page immediately; saveSetting propagates it to the popup
      // and to every open panel through storage.
      self.setuApplyAppearance(choice);
      this.renderAppearance(choice);
      this.saveSetting({ appearance: choice });
    });

    $('#speaker')?.addEventListener('change', (event) => {
      this.saveSetting({ ttsSpeaker: event.target.value, ttsVoice: event.target.value });
      this.loadVoices();
    });

    $('#tts-language')?.addEventListener('change', (event) => {
      this.saveSetting({ ttsLanguage: event.target.value });
    });

    $('#preview-voice')?.addEventListener('click', () => this.previewVoice());

    $('#gaze-invert')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-gaze-choice]');
      if (!button) return;
      const inverted = button.dataset.gazeChoice === 'inverted';
      this.renderGazeDirection(inverted);
      this.saveSetting({ gazeInvert: inverted });
    });

    this.slider('#bionic', (raw) => ({ bionicIntensity: raw / 100 }));
    this.slider('#spacing', (raw) => ({ letterSpacing: raw / 100 }));
    this.slider('#line', (raw) => ({ lineHeight: raw / 10 }));
    this.slider('#wpm', (raw) => ({ scrollWpm: raw }));
    this.slider('#rate', (raw) => ({ ttsRate: raw / 10 }));
    this.slider('#gaze', (raw) => ({ gazeSensitivity: raw / 10 }));

    $('#edit-shortcuts')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    $('#reset')?.addEventListener('click', () => this.resetAll());
  }

  slider(selector, toSettings) {
    const el = $(selector);
    if (!el) return;
    el.addEventListener('input', () => {
      Object.assign(this.state.settings, toSettings(Number(el.value)));
      this.paintValues();
    });
    el.addEventListener('change', () => this.saveSetting(toSettings(Number(el.value))));
  }

  cleanUrl(raw) {
    const trimmed = String(raw || '').trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    try {
      const parsed = new URL(withScheme);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch (_) {
      return '';
    }
  }

  async saveSetting(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.paintValues();
    await chrome.storage.sync.set({ setuState: this.state });
  }

  /* ------------------------------------------------------------------ */
  /* Engine Health Probe                                                */
  /* ------------------------------------------------------------------ */

  async testEngine() {
    const status = $('#engine-status');
    const headline = $('#engine-headline');
    const detail = $('#engine-detail');
    if (!status || !headline || !detail) return;

    status.dataset.state = 'busy';
    headline.textContent = 'Contacting the engine…';
    detail.innerHTML = '';

    const probe = (timeoutMs) =>
      chrome.runtime.sendMessage({ action: 'apiFetch', method: 'GET', path: '/api/health', timeoutMs });

    let response = await probe(self.SETU_DEFAULTS?.healthTimeoutMs || 6000);

    if (!response?.ok && (response?.code === 'offline' || response?.code === 'timeout')) {
      headline.textContent = 'Waking the engine…';
      detail.innerHTML =
        '<li>Free-tier cloud hosting puts the engine to sleep when idle. Waking takes ~30-60 seconds.</li>';
      response = await probe(self.SETU_DEFAULTS?.wakeTimeoutMs || 75000);
    }

    if (!response?.ok) {
      status.dataset.state = 'down';
      headline.textContent = 'Cannot reach the engine';
      detail.innerHTML = `
        <li>${escapeHtml(response?.error || 'No response received from host.')}</li>
        <li>Reading tools still function 100% on-device. AI Copilot &amp; Commander remain offline until connected.</li>
      `;
      return;
    }

    const health = response.data || {};
    const speech = health.speech || {};
    const database = health.database || {};

    status.dataset.state = health.aiConfigured ? 'ok' : 'warn';
    headline.textContent = health.aiConfigured
      ? 'Connected — AI features & Copilot ready'
      : 'Connected, but no AI API key is configured';

    detail.innerHTML = [
      `<li>Engine: <b>${escapeHtml(health.version || 'v3.1.0')}</b>${
        health.product ? ` · ${escapeHtml(health.product)}` : ''
      }</li>`,
      `<li>AI Provider: <b>${escapeHtml(health.primaryProvider || 'none')}</b></li>`,
      `<li>Speech Synthesis: <b>${escapeHtml(speech.configured ? speech.provider : "Browser native")}</b></li>`,
      `<li>Database: <b>${database.connected ? 'Connected' : 'Local-only session'}</b></li>`,
      health.aiConfigured
        ? ''
        : '<li>Provide an API key in backend <code>.env</code> and restart the engine.</li>'
    ]
      .filter(Boolean)
      .join('');
  }

  async renderDiagnostics() {
    const diag = $('#diag');
    if (!diag) return;

    let installId = 'not assigned';
    try {
      const res = await chrome.storage.local.get('installId');
      if (res?.installId) installId = res.installId;
    } catch (_) {}

    let bytes = 0;
    try {
      bytes = await chrome.storage.sync.getBytesInUse(null);
    } catch (_) {}

    diag.innerHTML = `
      <div class="diag-item"><dt>Extension</dt><dd>${escapeHtml(chrome.runtime.getManifest().version)}</dd></div>
      <div class="diag-item"><dt>Platform</dt><dd>${IS_MAC ? 'macOS' : 'Windows / Linux'}</dd></div>
      <div class="diag-item"><dt>Synced Storage</dt><dd>${bytes} bytes in use</dd></div>
      <div class="diag-item"><dt>Install Identifier</dt><dd title="${escapeHtml(installId)}">${escapeHtml(installId.slice(0, 16))}…</dd></div>
    `;
  }

  async resetAll() {
    const button = $('#reset');
    if (!button) return;

    if (button.dataset.armed !== 'true') {
      button.dataset.armed = 'true';
      button.textContent = 'Click again to confirm full reset';
      setTimeout(() => {
        button.dataset.armed = 'false';
        button.textContent = 'Reset all settings to defaults';
      }, 5000);
      return;
    }

    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({
      apiHost: self.SETU_DEFAULTS?.apiHost || '',
      sanctuaryUrl: self.SETU_DEFAULTS?.sanctuaryUrl || ''
    });

    this.state = { settings: { ...DEFAULT_SETTINGS } };
    if ($('#api-host')) $('#api-host').value = self.SETU_DEFAULTS?.apiHost || '';
    if ($('#sanctuary-url')) $('#sanctuary-url').value = self.SETU_DEFAULTS?.sanctuaryUrl || '';
    this.renderSettings();

    button.dataset.armed = 'false';
    button.textContent = 'Reset all settings to defaults';
    this.toast('All preferences reset to defaults', 'success');
    this.testEngine();
  }

  toast(message, tone = 'info') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.dataset.tone = tone;
    el.dataset.show = 'true';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.dataset.show = 'false';
    }, 2600);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

document.addEventListener('DOMContentLoaded', () => new Options().init());
