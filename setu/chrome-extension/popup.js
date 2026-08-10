// SETU Lens popup controller. The page stays local unless the user explicitly
// asks for an optional AI summary.
class SetuPopup {
  constructor() {
    this.state = this.defaultState();
    this.init();
  }

  defaultState() {
    return {
      bionic: false,
      focus: false,
      eye: false,
      scroll: false,
      tts: false,
      highlight: false,
      dyslexia: false,
      breathe: false,
      chunking: false,
      theme: 'default'
    };
  }

  async init() {
    await this.loadState();
    this.setupEventListeners();
    this.updateUI();
    this.loadStats();
  }

  async loadState() {
    const { neuroreadState } = await chrome.storage.sync.get('neuroreadState');
    this.state = { ...this.state, ...(neuroreadState || {}) };
  }

  saveState() {
    return chrome.storage.sync.set({ neuroreadState: this.state });
  }

  setupEventListeners() {
    document.querySelectorAll('.mode-btn, #btn-chunking').forEach((button) => {
      button.addEventListener('click', () => this.toggleMode(button.dataset.mode));
    });

    ['tts', 'highlight', 'dyslexia'].forEach((feature) => {
      document.getElementById(`toggle-${feature}`).addEventListener('change', (event) => {
        this.toggleFeature(feature, event.target.checked);
      });
    });
    document.getElementById('toggle-breathe').addEventListener('change', (event) => {
      this.toggleFeature('breathe', event.target.checked);
    });

    document.getElementById('btn-commander').addEventListener('click', () => this.sendAction('openCommander'));
    document.getElementById('btn-visual').addEventListener('click', () => this.sendAction('explainVisual'));
    document.getElementById('btn-summarize').addEventListener('click', () => this.summarizePage());
    document.getElementById('btn-sanctuary').addEventListener('click', () => this.sendToSanctuary());

    document.querySelectorAll('.theme-btn').forEach((button) => {
      button.addEventListener('click', () => this.setTheme(button.dataset.theme));
    });
    document.getElementById('btn-reset').addEventListener('click', () => this.resetAll());
    document.getElementById('btn-settings').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
  }

  updateUI() {
    document.querySelectorAll('.mode-btn, #btn-chunking').forEach((button) => {
      button.classList.toggle('active', Boolean(this.state[button.dataset.mode]));
    });
    ['tts', 'highlight', 'dyslexia', 'breathe'].forEach((feature) => {
      document.getElementById(`toggle-${feature}`).checked = Boolean(this.state[feature]);
    });
    document.querySelectorAll('.theme-btn').forEach((button) => {
      button.classList.toggle('active', this.state.theme === button.dataset.theme);
    });
  }

  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Open a normal website first. SETU cannot change browser internal pages.');
    return tab;
  }

  async sendAction(action, payload = {}) {
    try {
      const tab = await this.getActiveTab();
      return await chrome.tabs.sendMessage(tab.id, { action, ...payload });
    } catch (error) {
      this.showInlineMessage(error.message, true);
      return null;
    }
  }

  async toggleMode(mode) {
    this.state[mode] = !this.state[mode];
    await this.saveState();
    this.updateUI();
    await this.sendAction('toggleMode', { mode, enabled: this.state[mode] });
  }

  async toggleFeature(feature, enabled) {
    this.state[feature] = enabled;
    await this.saveState();
    await this.sendAction('toggleFeature', { feature, enabled });
  }

  async setTheme(theme) {
    this.state.theme = theme;
    await this.saveState();
    this.updateUI();
    await this.sendAction('setTheme', { theme });
  }

  renderSummary(summary) {
    const output = document.getElementById('summary-output');
    const container = output.querySelector('.summary-content');
    container.replaceChildren();
    const points = Array.isArray(summary) ? summary : [summary];
    const list = document.createElement('ul');
    points.filter(Boolean).forEach((point) => {
      const item = document.createElement('li');
      item.textContent = point;
      list.appendChild(item);
    });
    container.appendChild(list);
    output.style.display = 'block';
  }

  async summarizePage() {
    const button = document.getElementById('btn-summarize');
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Making this clearer…';
    try {
      const response = await this.sendAction('getPageContent');
      if (!response?.text) throw new Error('There is no readable text on this page.');
      let data;
      try {
        const request = await fetch('http://localhost:3000/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: response.text, maxPoints: 5 })
        });
        if (!request.ok) throw new Error('The optional SETU service is unavailable.');
        data = await request.json();
      } catch (_) {
        data = { points: response.localSummary || [] };
      }
      this.renderSummary(data.points || data.summary || response.localSummary);
    } catch (error) {
      this.showInlineMessage(error.message, true);
    } finally {
      button.disabled = false;
      button.innerHTML = '<span>✨ Get a simple summary</span>';
    }
  }

  async sendToSanctuary() {
    const button = document.getElementById('btn-sanctuary');
    button.disabled = true;
    button.textContent = 'Preparing your learning space…';
    try {
      const response = await this.sendAction('saveToSanctuary');
      if (!response?.success) throw new Error(response?.error || 'SETU could not save this page.');
      await chrome.runtime.sendMessage({ action: 'openSanctuary' });
    } catch (error) {
      this.showInlineMessage(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Save this page as a map & flashcards';
    }
  }

  async loadStats() {
    const { readingStats } = await chrome.storage.local.get('readingStats');
    const stats = readingStats || {};
    document.getElementById('stat-wpm').textContent = stats.wpm || 0;
    document.getElementById('stat-time').textContent = stats.time ? `${stats.time}m` : '0m';
    document.getElementById('stat-words').textContent = stats.words || 0;
  }

  async resetAll() {
    this.state = this.defaultState();
    await this.saveState();
    this.updateUI();
    await this.sendAction('resetAll');
    document.getElementById('summary-output').style.display = 'none';
  }

  showInlineMessage(message, isError = false) {
    const output = document.getElementById('summary-output');
    const container = output.querySelector('.summary-content');
    container.textContent = message;
    container.style.color = isError ? '#b91c1c' : '';
    output.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => new SetuPopup());
