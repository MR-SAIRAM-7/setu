/**
 * Text to Speech — reads the page aloud and highlights each spoken word.
 *
 * The word highlight is drawn as an overlay positioned over a live Range,
 * rather than by wrapping words in <span>s. That matters for composability:
 * wrapping would fight Bionic Reading for the same text nodes and corrupt both.
 * Here TTS never touches the page DOM at all.
 */

(() => {
  const { Feature, UI, Store, Text } = window.SETU;

  class TextToSpeech extends Feature {
    static key = 'tts';

    constructor() {
      super();
      this.synth = window.speechSynthesis;
      this.voices = [];
      this.utterance = null;
      this.speaking = false;
      this.paused = false;
      this.rate = 1;
      this.pitch = 1;
      this.segments = []; // { node, start, end, charIndex } over the spoken text
      this.spokenText = '';
    }

    onEnable() {
      this.rate = Store.getSetting('ttsRate') || 1;
      this.pitch = Store.getSetting('ttsPitch') || 1;
      this.loadVoices();
      this.build();
      UI.toast('Read Aloud ready — press play', { tone: 'success' });
    }

    onDisable() {
      this.stop();
      UI.destroyHost('tts');
      UI.destroyHost('tts-mark');
    }

    onSettings() {
      this.rate = Store.getSetting('ttsRate') || 1;
      this.pitch = Store.getSetting('ttsPitch') || 1;
      this.renderRate();
    }

    /* ------------------------------------------------------------------ */

    loadVoices() {
      const read = () => {
        this.voices = this.synth.getVoices();
        this.populateVoiceList();
      };
      read();
      // Chrome populates voices asynchronously on first call.
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = read;
        this.cleanup(() => {
          this.synth.onvoiceschanged = null;
        });
      }
    }

    pickVoice() {
      const preferred = Store.getSetting('ttsVoice');
      if (preferred) {
        const match = this.voices.find((v) => v.name === preferred);
        if (match) return match;
      }
      const lang = document.documentElement.lang || navigator.language || 'en';
      return (
        this.voices.find((v) => v.lang.startsWith(lang.slice(0, 2)) && v.localService) ||
        this.voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
        this.voices[0] ||
        null
      );
    }

    /* ------------------------------------------------------------------ */
    /* Controls                                                           */
    /* ------------------------------------------------------------------ */

    build() {
      const root = UI.host('tts', { layer: 'control', interactive: true });

      const style = document.createElement('style');
      style.textContent = `
        .bar {
          position: fixed; bottom: 24px; left: 24px;
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 999px;
          box-shadow: var(--shadow); pointer-events: auto; font-family: var(--font);
        }
        .icon {
          width: 34px; height: 34px; border-radius: 50%;
          display: grid; place-items: center;
          background: transparent; border: 1px solid var(--border);
          color: var(--text); cursor: pointer; font-size: 13px; font-weight: 700;
        }
        .icon:hover { background: var(--accent-100); border-color: var(--accent); color: var(--accent-700); }
        .icon:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .icon[data-primary] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
        .sep { width:1px; height:20px; background:var(--border); }
        .rate { font-size:12px; font-weight:700; min-width:38px; text-align:center; color:var(--text); }
        select {
          max-width: 140px; padding: 4px 7px; font-size: 12px;
          background: var(--bg); color: var(--text);
          border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;
        }
        .progress { position:absolute; left:14px; right:14px; bottom:4px; height:2px; background:var(--border); border-radius:2px; }
        .progress-fill { height:100%; width:0; background:var(--accent); border-radius:2px; transition:width .2s linear; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="bar" role="group" aria-label="Read aloud controls">
          <button class="icon" data-primary data-act="play" aria-label="Play" title="Play / Pause">▶</button>
          <button class="icon" data-act="stop" aria-label="Stop" title="Stop">■</button>
          <div class="sep"></div>
          <button class="icon" data-act="slower" aria-label="Slower" title="Slower">−</button>
          <span class="rate">1.0×</span>
          <button class="icon" data-act="faster" aria-label="Faster" title="Faster">+</button>
          <div class="sep"></div>
          <select data-act="voice" aria-label="Voice"></select>
          <button class="icon" data-act="close" aria-label="Close read aloud" title="Close">×</button>
          <div class="progress"><div class="progress-fill"></div></div>
        </div>
      `;
      root.appendChild(scope);
      this.scope = scope;

      const on = (act, fn) => scope.querySelector(`[data-act="${act}"]`).addEventListener('click', fn);
      on('play', () => this.togglePlay());
      on('stop', () => this.stop());
      on('slower', () => this.changeRate(-0.1));
      on('faster', () => this.changeRate(0.1));
      on('close', () => window.setuLens?.toggle('tts', false));

      scope.querySelector('[data-act="voice"]').addEventListener('change', (event) => {
        Store.set({ settings: { ttsVoice: event.target.value } });
        if (this.speaking) this.restart();
      });

      this.populateVoiceList();
      this.renderRate();
    }

    populateVoiceList() {
      const select = this.scope?.querySelector('[data-act="voice"]');
      if (!select) return;

      const current = Store.getSetting('ttsVoice');
      select.innerHTML = this.voices
        .map(
          (v) =>
            `<option value="${Text.escape(v.name)}"${v.name === current ? ' selected' : ''}>${Text.escape(
              v.name
            )}</option>`
        )
        .join('');
    }

    renderRate() {
      const el = this.scope?.querySelector('.rate');
      if (el) el.textContent = `${this.rate.toFixed(1)}×`;
    }

    changeRate(delta) {
      this.rate = Math.max(0.5, Math.min(2.5, Number((this.rate + delta).toFixed(1))));
      this.renderRate();
      Store.set({ settings: { ttsRate: this.rate } });
      if (this.speaking) this.restart();
    }

    /* ------------------------------------------------------------------ */
    /* Speech                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Build the spoken string and a char-offset index back into live text
     * nodes, so a boundary event can be mapped to an exact on-screen Range.
     */
    prepare(text) {
      this.segments = [];

      if (text) {
        this.spokenText = text;
        return;
      }

      const nodes = Text.collect(document.body, { minLength: 2 });
      let buffer = '';

      for (const node of nodes) {
        const content = node.textContent.replace(/\s+/g, ' ');
        if (!content.trim()) continue;
        this.segments.push({ node, charIndex: buffer.length, length: content.length });
        buffer += content;
        if (!/\s$/.test(buffer)) buffer += ' ';
      }

      this.spokenText = buffer.trim();
    }

    speak(text = null) {
      this.stop();
      this.prepare(text);

      if (!this.spokenText) {
        UI.toast('No readable text found on this page.', { tone: 'warn' });
        return;
      }

      // Chrome truncates very long utterances; chunk on sentence boundaries.
      this.queue = this.chunk(this.spokenText);
      this.queueIndex = 0;
      this.speakNext();
    }

    chunk(text, size = 3000) {
      const parts = [];
      let offset = 0;

      while (offset < text.length) {
        let end = Math.min(offset + size, text.length);
        if (end < text.length) {
          const boundary = text.lastIndexOf('. ', end);
          if (boundary > offset + size * 0.5) end = boundary + 1;
        }
        parts.push({ text: text.slice(offset, end), offset });
        offset = end;
      }
      return parts;
    }

    speakNext() {
      if (this.queueIndex >= this.queue.length) {
        this.finish();
        return;
      }

      const part = this.queue[this.queueIndex];
      const utterance = new SpeechSynthesisUtterance(part.text);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = 1;

      const voice = this.pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onboundary = (event) => {
        if (event.name && event.name !== 'word') return;
        this.markWord(part.offset + event.charIndex);
        this.renderProgress(part.offset + event.charIndex);
      };

      utterance.onend = () => {
        if (!this.speaking) return;
        this.queueIndex += 1;
        this.speakNext();
      };

      utterance.onerror = (event) => {
        // 'interrupted'/'canceled' are our own stop() — not real failures.
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        console.warn('[SETU:tts]', event.error);
        UI.toast('Speech failed on this page.', { tone: 'error' });
        this.finish();
      };

      this.utterance = utterance;
      this.speaking = true;
      this.paused = false;
      this.setPlayIcon('❚❚');
      this.synth.speak(utterance);
    }

    /** Draw the highlight over the word at `charIndex` of the spoken text. */
    markWord(charIndex) {
      if (!this.segments.length) return;

      const segment = [...this.segments].reverse().find((s) => charIndex >= s.charIndex);
      if (!segment || !segment.node.isConnected) return;

      const local = charIndex - segment.charIndex;
      const content = segment.node.textContent;
      if (local < 0 || local >= content.length) return;

      let start = local;
      let end = local;
      while (start > 0 && /\S/.test(content[start - 1])) start -= 1;
      while (end < content.length && /\S/.test(content[end])) end += 1;
      if (start === end) return;

      const range = document.createRange();
      try {
        range.setStart(segment.node, start);
        range.setEnd(segment.node, end);
      } catch (_) {
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect.width) return;

      this.paintMark(rect);

      // Keep the spoken word comfortably in view.
      if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
        segment.node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    paintMark(rect) {
      const root = UI.host('tts-mark', { layer: 'reading', interactive: false });

      if (!this.mark) {
        const style = document.createElement('style');
        style.textContent = `
          .mark {
            position: fixed; border-radius: 2px;
            background: rgba(0, 136, 176, 0.22);
            box-shadow: 0 0 0 2px rgba(0, 136, 176, 0.45);
            pointer-events: none;
            transition: top .1s ease, left .1s ease, width .1s ease, height .1s ease;
          }
        `;
        root.appendChild(style);

        const scope = document.createElement('div');
        scope.className = 'setu-scope';
        this.mark = document.createElement('div');
        this.mark.className = 'mark';
        scope.appendChild(this.mark);
        root.appendChild(scope);
      }

      Object.assign(this.mark.style, {
        top: `${rect.top - 2}px`,
        left: `${rect.left - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`,
        display: 'block'
      });
    }

    renderProgress(charIndex) {
      const fill = this.scope?.querySelector('.progress-fill');
      if (fill && this.spokenText.length) {
        fill.style.width = `${Math.min(100, (charIndex / this.spokenText.length) * 100)}%`;
      }
    }

    togglePlay() {
      if (!this.speaking) {
        this.speak();
      } else if (this.paused) {
        this.synth.resume();
        this.paused = false;
        this.setPlayIcon('❚❚');
      } else {
        this.synth.pause();
        this.paused = true;
        this.setPlayIcon('▶');
      }
    }

    restart() {
      const wasSpeaking = this.speaking;
      this.stop();
      if (wasSpeaking) this.speak();
    }

    stop() {
      this.speaking = false;
      this.paused = false;
      try {
        this.synth.cancel();
      } catch (_) {
        /* already idle */
      }
      this.utterance = null;
      this.finish();
    }

    finish() {
      this.speaking = false;
      this.setPlayIcon('▶');
      if (this.mark) this.mark.style.display = 'none';
      const fill = this.scope?.querySelector('.progress-fill');
      if (fill) fill.style.width = '0%';
    }

    setPlayIcon(glyph) {
      const btn = this.scope?.querySelector('[data-act="play"]');
      if (btn) {
        btn.textContent = glyph;
        btn.setAttribute('aria-label', glyph === '▶' ? 'Play' : 'Pause');
      }
    }
  }

  window.SETU.features.set('tts', TextToSpeech);
})();
