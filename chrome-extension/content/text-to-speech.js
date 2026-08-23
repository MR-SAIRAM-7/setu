/**
 * Read Aloud — natural-voice reading with a spoken-word highlight.
 *
 * Two engines behind one interface:
 *
 *  1. Sarvam Bulbul, through the SETU engine. A real human voice in eleven
 *     Indian languages plus English. For a reader whose difficulty is decoding
 *     text rather than understanding it, this is the whole accommodation — a
 *     robotic voice reading English at someone who thinks in Tamil is not.
 *  2. The browser's SpeechSynthesis, whenever Sarvam is unconfigured,
 *     unreachable, or blocked. Never leaves the reader in silence.
 *
 * Audio is decoded and played through WebAudio rather than an <audio> element.
 * That is not an optimisation: a great many sites ship a `media-src` Content
 * Security Policy that blocks a blob: URL outright, and read-aloud simply died
 * on them. Decoding an ArrayBuffer fetches nothing, so no policy applies —
 * and it hands us the exact clip duration, which is what makes the word
 * highlight track a voice that sends no boundary events.
 *
 * The highlight is drawn as an overlay positioned over a live Range, rather
 * than by wrapping words in <span>s. That matters for composability: wrapping
 * would fight Bionic Reading for the same text nodes and corrupt both. Read
 * Aloud never touches the page DOM at all.
 */

(() => {
  const { Feature, UI, Store, Text, API, Scroll, Dock, icon } = window.SETU;

  /**
   * Clip sizing.
   *
   * The first clip is deliberately short so audio starts almost immediately;
   * later clips are larger because they are fetched under cover of the one
   * already playing, where size costs nothing perceptible. The ceiling is
   * Sarvam's own per-request limit.
   */
  const FIRST_CLIP_CHARS = 220;
  const CLIP_CHARS = 600;
  const MAX_CLIP_CHARS = 1400;

  /* ---------------------------------------------------------------------- */
  /* Speech engine                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Split text into speakable clips on sentence boundaries.
   *
   * Danda (।) and double danda (॥) end a sentence in Devanagari, Bengali,
   * Gujarati, Punjabi, and Odia. Splitting only on full stops turned a Hindi
   * paragraph into one 4000-character clip, which the voice engine rejects.
   */
  function splitForSpeech(text, { first = FIRST_CLIP_CHARS, rest = CLIP_CHARS } = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];

    const sentences = clean.match(/[^.!?।॥]+[.!?।॥]+(\s|$)|[^.!?।॥]+$/g) || [clean];
    const clips = [];
    let current = '';
    let offset = 0;
    let cursor = 0;

    const limit = () => (clips.length === 0 ? first : rest);

    const push = () => {
      const trimmed = current.trim();
      if (trimmed) clips.push({ text: trimmed, offset });
      current = '';
      offset = cursor;
    };

    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;

      if (sentence.length > MAX_CLIP_CHARS) {
        push();
        let buffer = '';
        for (const word of sentence.split(' ')) {
          if (buffer && `${buffer} ${word}`.length > Math.min(limit(), MAX_CLIP_CHARS)) {
            clips.push({ text: buffer.trim(), offset });
            offset += buffer.length + 1;
            buffer = word;
          } else {
            buffer = buffer ? `${buffer} ${word}` : word;
          }
        }
        if (buffer.trim()) {
          clips.push({ text: buffer.trim(), offset });
          offset += buffer.length + 1;
        }
        cursor = offset;
        continue;
      }

      if (current && `${current} ${sentence}`.length > limit()) push();
      current = current ? `${current} ${sentence}` : sentence;
      cursor += raw.length;
    }

    push();
    return clips;
  }

  /**
   * The shared voice.
   *
   * Deliberately separate from the Read Aloud feature: the mind-map explainer
   * speaks a node on hover, the agent speaks an answer, and Focus Mode speaks
   * an article, and none of those should have to open a transport bar to do it.
   */
  const Voice = {
    /** null = not yet probed. */
    available: null,
    catalogue: [],
    languages: [],
    defaultSpeaker: '',
    maxCharacters: MAX_CLIP_CHARS,
    probing: null,

    playing: false,
    paused: false,

    _ctx: null,
    _gain: null,
    _source: null,
    _token: 0,
    _clips: new Map(),
    _controller: null,
    _listeners: new Set(),

    /** Ask the engine which natural voices exist. Cached for the page's life. */
    async probe(force = false) {
      if (!force && Voice.available !== null) return Voice.available;
      if (!force && Voice.probing) return Voice.probing;

      Voice.probing = (async () => {
        try {
          const data = await API.get('/api/speech/voices', { timeoutMs: 8000 });
          Voice.available = Boolean(data?.enabled);
          Voice.catalogue = Array.isArray(data?.voices) ? data.voices : [];
          Voice.languages = Array.isArray(data?.languages) ? data.languages : [];
          Voice.defaultSpeaker = data?.defaultSpeaker || '';
          Voice.maxCharacters = Number(data?.maxCharacters) || MAX_CLIP_CHARS;
          return Voice.available;
        } catch (_) {
          Voice.available = false;
          return false;
        } finally {
          Voice.probing = null;
        }
      })();

      return Voice.probing;
    },

    subscribe(fn) {
      Voice._listeners.add(fn);
      return () => Voice._listeners.delete(fn);
    },

    _emit(event) {
      for (const fn of Voice._listeners) {
        try {
          fn(event);
        } catch (_) {
          /* a listener must not break playback */
        }
      }
    },

    context() {
      if (!Voice._ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        Voice._ctx = new Ctor();
        Voice._gain = Voice._ctx.createGain();
        Voice._gain.connect(Voice._ctx.destination);
      }
      return Voice._ctx;
    },

    settings() {
      return {
        speaker: Store.getSetting('ttsSpeaker') || Voice.defaultSpeaker || undefined,
        language: Store.getSetting('ttsLanguage') || 'en-IN',
        pace: Math.max(0.5, Math.min(2, Store.getSetting('ttsRate') || 1))
      };
    },

    /** Fetch and decode one clip, memoised so a replay costs nothing. */
    async clip(text, signal) {
      const { speaker, language, pace } = Voice.settings();
      const key = `${speaker || 'default'}|${language}|${pace}|${text}`;

      const cached = Voice._clips.get(key);
      if (cached) return cached;

      const response = await API.post(
        '/api/speech',
        { text, speaker, language, pace },
        { signal, timeoutMs: 45000 }
      );

      if (!response?.audio) throw new Error('The voice engine returned no audio.');

      const ctx = Voice.context();
      if (!ctx) throw new Error('This browser has no audio output available.');

      const bytes = base64ToBytes(response.audio);
      // decodeAudioData detaches the buffer it is given, so decode a copy —
      // otherwise a cached clip cannot be played a second time.
      const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

      if (Voice._clips.size > 80) Voice._clips.delete(Voice._clips.keys().next().value);
      Voice._clips.set(key, buffer);
      return buffer;
    },

    /**
     * Speak `text`.
     *
     * @param {string} text
     * @param {object} options
     * @param {(progress: {clip: number, charIndex: number, total: number}) => void} options.onProgress
     * @param {boolean} options.allowBrowserFallback
     * @returns {Promise<void>} resolves when the last word has been spoken.
     */
    async say(text, { onProgress = null, allowBrowserFallback = true } = {}) {
      Voice.stop();

      const clean = String(text || '')
        .replace(/[#*_`~>[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;

      const token = (Voice._token += 1);
      Voice.playing = true;
      Voice.paused = false;
      Voice._emit({ type: 'start' });

      const natural = await Voice.probe();
      if (token !== Voice._token) return;

      if (natural) {
        try {
          await Voice._sayNatural(clean, token, onProgress);
          return;
        } catch (error) {
          if (token !== Voice._token) return;
          if (error.name === 'AbortError') return;
          console.warn('[SETU:voice] natural voice failed, falling back:', error.message);
          if (!allowBrowserFallback) throw error;
        }
      }

      if (token !== Voice._token) return;
      await Voice._sayBrowser(clean, token, onProgress);
    },

    async _sayNatural(text, token, onProgress) {
      const clips = splitForSpeech(text);
      if (!clips.length) return;

      Voice._controller = new AbortController();
      const { signal } = Voice._controller;

      // Fetch the next clip while the current one plays, so the reader hears
      // the first sentence in about a second rather than after the whole
      // passage has been synthesised.
      let pending = Voice.clip(clips[0].text, signal);

      for (let index = 0; index < clips.length; index += 1) {
        const buffer = await pending;
        if (token !== Voice._token) return;

        pending =
          index + 1 < clips.length
            ? Voice.clip(clips[index + 1].text, signal).catch((error) => {
                // Surface it at await time, not as an unhandled rejection.
                if (error.name !== 'AbortError') console.warn('[SETU:voice]', error.message);
                throw error;
              })
            : Promise.resolve(null);

        await Voice._playBuffer(buffer, token, (fraction) => {
          onProgress?.({
            clip: index,
            charIndex: clips[index].offset + Math.floor(fraction * clips[index].text.length),
            total: text.length
          });
        });

        if (token !== Voice._token) return;
      }

      Voice._finish(token);
    },

    _playBuffer(buffer, token, onFraction) {
      return new Promise((resolve, reject) => {
        const ctx = Voice.context();
        if (!ctx) return reject(new Error('No audio output.'));

        // A page can start suspended when nothing has played yet.
        ctx.resume?.().catch(() => {});

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(Voice._gain);
        Voice._source = source;

        const startedAt = ctx.currentTime;
        const duration = buffer.duration || 0.001;

        // currentTime freezes while the context is suspended, so this doubles
        // as the pause-aware clock.
        const ticker = setInterval(() => {
          if (token !== Voice._token) return;
          const elapsed = Math.min(duration, ctx.currentTime - startedAt);
          onFraction?.(elapsed / duration);
        }, 120);

        source.onended = () => {
          clearInterval(ticker);
          Voice._source = null;
          resolve();
        };

        try {
          source.start();
        } catch (error) {
          clearInterval(ticker);
          reject(error);
        }
      });
    },

    _sayBrowser(text, token, onProgress) {
      return new Promise((resolve) => {
        const synth = window.speechSynthesis;
        if (!synth) {
          Voice._finish(token);
          return resolve();
        }

        const language = Store.getSetting('ttsLanguage') || 'en-IN';
        const preferred = Store.getSetting('ttsVoice');
        const voices = synth.getVoices();

        // The browser truncates very long utterances; chunk on sentences.
        const clips = splitForSpeech(text, { first: 2200, rest: 2200 });
        let index = 0;

        const speakNext = () => {
          if (token !== Voice._token || index >= clips.length) {
            Voice._finish(token);
            return resolve();
          }

          const clip = clips[index];
          const utterance = new SpeechSynthesisUtterance(clip.text);
          utterance.rate = Math.max(0.5, Math.min(2.5, Store.getSetting('ttsRate') || 1));
          utterance.pitch = Store.getSetting('ttsPitch') || 1;
          utterance.lang = language;

          const short = language.split('-')[0];
          const match =
            voices.find((v) => v.name === preferred) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith(short) && v.localService) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith(short)) ||
            voices.find((v) => /Natural|Google/i.test(v.name)) ||
            voices[0];
          if (match) {
            utterance.voice = match;
            utterance.lang = match.lang;
          }

          utterance.onboundary = (event) => {
            if (event.name && event.name !== 'word') return;
            onProgress?.({
              clip: index,
              charIndex: clip.offset + event.charIndex,
              total: text.length
            });
          };

          utterance.onend = () => {
            index += 1;
            speakNext();
          };

          utterance.onerror = (event) => {
            // 'interrupted' and 'canceled' are our own stop() — not failures.
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
              console.warn('[SETU:voice] browser speech:', event.error);
            }
            Voice._finish(token);
            resolve();
          };

          synth.speak(utterance);
        };

        speakNext();
      });
    },

    _finish(token) {
      if (token !== Voice._token) return;
      Voice.playing = false;
      Voice.paused = false;
      Voice._emit({ type: 'end' });
    },

    pause() {
      if (!Voice.playing || Voice.paused) return;
      Voice.paused = true;
      Voice._ctx?.suspend?.().catch(() => {});
      window.speechSynthesis?.pause();
      Voice._emit({ type: 'pause' });
    },

    resume() {
      if (!Voice.playing || !Voice.paused) return;
      Voice.paused = false;
      Voice._ctx?.resume?.().catch(() => {});
      window.speechSynthesis?.resume();
      Voice._emit({ type: 'resume' });
    },

    stop() {
      Voice._token += 1;
      Voice.playing = false;
      Voice.paused = false;

      Voice._controller?.abort();
      Voice._controller = null;

      if (Voice._source) {
        try {
          Voice._source.onended = null;
          Voice._source.stop();
        } catch (_) {
          /* already finished */
        }
        Voice._source = null;
      }

      Voice._ctx?.resume?.().catch(() => {});

      try {
        window.speechSynthesis?.cancel();
      } catch (_) {
        /* already idle */
      }

      Voice._emit({ type: 'stop' });
    },

    /** Voice settings changed — cached clips were synthesised with the old ones. */
    invalidate() {
      Voice._clips.clear();
    }
  };

  function base64ToBytes(base64) {
    const cleaned = String(base64).replace(/^data:[^;]+;base64,/, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  window.addEventListener('pagehide', () => Voice.stop());

  /* ---------------------------------------------------------------------- */
  /* The Read Aloud feature                                                 */
  /* ---------------------------------------------------------------------- */

  class TextToSpeech extends Feature {
    static key = 'tts';

    constructor() {
      super();
      /** Spoken string plus a char-offset index back into live text nodes. */
      this.segments = [];
      this.spokenText = '';
      this.speaking = false;
      this.explainController = null;
    }

    async onEnable() {
      this.build();

      // Probe and warm in parallel with the user reaching for Play.
      API.warm();
      Voice.probe().then(() => this.populateVoices());

      this.cleanup(
        Voice.subscribe((event) => {
          if (event.type === 'end' || event.type === 'stop') {
            this.speaking = false;
            this.paintTransport();
            this.hideMark();
          } else {
            this.paintTransport();
          }
        })
      );

      UI.toast('Read Aloud ready — press play, or select text first', { tone: 'success' });
    }

    onDisable() {
      this.explainController?.abort();
      this.explainController = null;
      Voice.stop();
      this.releaseDock?.();
      this.releaseDock = null;
      UI.destroyHost('tts');
      UI.destroyHost('tts-mark');
      this.scope = null;
      this.mark = null;
    }

    onSettings() {
      Voice.invalidate();
      this.paintRate();
      this.syncSelects();
    }

    /* ------------------------------------------------------------------ */
    /* Controls                                                           */
    /* ------------------------------------------------------------------ */

    build() {
      const root = UI.host('tts', { layer: 'control' });

      const style = document.createElement('style');
      style.textContent = `
        .bar {
          position: fixed; display: flex; flex-direction: column; gap: 8px;
          padding: 10px 14px 12px; background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          box-shadow: var(--shadow); font-family: var(--font); color: var(--text);
          max-width: min(560px, calc(100vw - 40px));
        }
        .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .icon {
          width: 34px; height: 34px; border-radius: var(--radius); flex-shrink: 0;
          display: grid; place-items: center;
          background: transparent; border: 1px solid var(--border);
          color: var(--text); cursor: pointer;
          transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .icon:hover { background: var(--accent-100); border-color: var(--accent); color: var(--accent-900); }
        .icon:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .icon[data-primary] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .icon[data-primary]:hover { background: var(--accent-600); border-color: var(--accent-600); color: var(--on-accent); }
        .sep { width:1px; height:20px; background:var(--border); flex-shrink:0; }
        .rate { font-size:13px; font-weight:600; min-width:40px; text-align:center; color:var(--text); font-variant-numeric: tabular-nums; }
        select {
          max-width: 148px; padding: 6px 9px; font-size: 12.5px; font-family: var(--font);
          background: var(--bg); color: var(--text);
          border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;
        }
        select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .toggle {
          display:inline-flex; align-items:center; gap:6px;
          border:1px solid var(--border); border-radius:999px; padding:4px 11px;
          background:transparent; color:var(--text-dim); cursor:pointer;
          font-family:var(--font); font-size:12px; font-weight:700;
        }
        .toggle[aria-pressed="true"] { background:var(--accent-100); border-color:var(--accent); color:var(--accent-900); }
        .toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .engine { font-size:11px; color:var(--text-dim); }
        .engine b { color: var(--accent-700); font-weight: 700; }
        .progress { height:3px; background:var(--border); border-radius:2px; overflow:hidden; }
        .progress-fill { height:100%; width:0; background:var(--accent); border-radius:2px; transition:width .25s linear; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="bar" role="group" aria-label="Read aloud controls">
          <div class="row">
            <button class="icon" data-primary data-act="play" aria-label="Play" title="Play / Pause">${icon('play')}</button>
            <button class="icon" data-act="stop" aria-label="Stop" title="Stop">${icon('stop')}</button>
            <div class="sep"></div>
            <button class="icon" data-act="slower" aria-label="Slower" title="Slower">${icon('minus')}</button>
            <span class="rate">1.0×</span>
            <button class="icon" data-act="faster" aria-label="Faster" title="Faster">${icon('plus')}</button>
            <div class="sep"></div>
            <select data-act="voice" aria-label="Voice"></select>
            <select data-act="language" aria-label="Language"></select>
            <button class="icon" data-act="close" aria-label="Close read aloud" title="Close">${icon('x')}</button>
          </div>
          <div class="row">
            <button class="toggle" data-act="explain" aria-pressed="false"
                    title="Explain the selection in your language, then read the explanation">
              ${icon('book-open', { size: 14 })}Explain, don't just read
            </button>
            <span class="engine" data-role="engine"></span>
          </div>
          <div class="progress"><div class="progress-fill"></div></div>
        </div>
      `;
      root.appendChild(scope);
      this.scope = scope;

      const bar = scope.querySelector('.bar');
      this.releaseDock = Dock.register('tts', 'bottom-left', bar);
      Dock.observe(bar);

      const on = (act, fn) => scope.querySelector(`[data-act="${act}"]`).addEventListener('click', fn);
      on('play', () => this.togglePlay());
      on('stop', () => this.stop());
      on('slower', () => this.changeRate(-0.1));
      on('faster', () => this.changeRate(0.1));
      on('close', () => window.setuLens?.toggle('tts', false));
      on('explain', (event) => {
        const next = event.currentTarget.getAttribute('aria-pressed') !== 'true';
        event.currentTarget.setAttribute('aria-pressed', String(next));
        Store.set({ settings: { ttsExplain: next } });
      });

      scope.querySelector('[data-act="voice"]').addEventListener('change', (event) => {
        Store.set({ settings: { ttsSpeaker: event.target.value, ttsVoice: event.target.value } });
        Voice.invalidate();
        if (this.speaking) this.restart();
      });

      scope.querySelector('[data-act="language"]').addEventListener('change', (event) => {
        Store.set({ settings: { ttsLanguage: event.target.value } });
        Voice.invalidate();
        if (this.speaking) this.restart();
      });

      this.populateVoices();
      this.paintRate();
      this.paintTransport();
    }

    /**
     * Fill the voice and language pickers.
     *
     * Sarvam speakers when the engine has them, the browser's own voices when
     * it does not. Showing an empty <select> reads as a broken control, so the
     * unprobed state says what is happening instead.
     */
    populateVoices() {
      const voiceSelect = this.scope?.querySelector('[data-act="voice"]');
      const languageSelect = this.scope?.querySelector('[data-act="language"]');
      const engineLabel = this.scope?.querySelector('[data-role="engine"]');
      if (!voiceSelect || !languageSelect) return;

      const chosenVoice = Store.getSetting('ttsSpeaker') || Store.getSetting('ttsVoice') || '';
      const chosenLanguage = Store.getSetting('ttsLanguage') || 'en-IN';

      if (Voice.available === null) {
        voiceSelect.innerHTML = '<option value="">Finding voices…</option>';
      } else if (Voice.available && Voice.catalogue.length) {
        voiceSelect.innerHTML = Voice.catalogue
          .map(
            (voice) =>
              `<option value="${Text.escape(voice.id)}"${voice.id === chosenVoice ? ' selected' : ''}>${Text.escape(
                voice.label || voice.id
              )}${voice.note ? ` — ${Text.escape(voice.note)}` : ''}</option>`
          )
          .join('');
        if (!chosenVoice && Voice.defaultSpeaker) voiceSelect.value = Voice.defaultSpeaker;
      } else {
        const browserVoices = window.speechSynthesis?.getVoices?.() || [];
        voiceSelect.innerHTML = browserVoices.length
          ? browserVoices
              .map(
                (voice) =>
                  `<option value="${Text.escape(voice.name)}"${voice.name === chosenVoice ? ' selected' : ''}>${Text.escape(
                    voice.name
                  )}</option>`
              )
              .join('')
          : '<option value="">Default voice</option>';
      }

      const languages = Voice.languages.length
        ? Voice.languages
        : [{ code: 'en-IN', name: 'English', native: 'English' }];

      languageSelect.innerHTML = languages
        .map(
          (language) =>
            `<option value="${Text.escape(language.code)}"${
              language.code === chosenLanguage ? ' selected' : ''
            }>${Text.escape(language.native || language.name)}</option>`
        )
        .join('');

      if (engineLabel) {
        engineLabel.innerHTML =
          Voice.available === null
            ? 'checking the voice engine…'
            : Voice.available
              ? 'natural voice: <b>Sarvam Bulbul</b>'
              : "natural voice unavailable — using this browser's voice";
      }

      const explainToggle = this.scope?.querySelector('[data-act="explain"]');
      if (explainToggle) {
        explainToggle.setAttribute('aria-pressed', String(Boolean(Store.getSetting('ttsExplain'))));
      }

      Dock.layout();
    }

    syncSelects() {
      const voiceSelect = this.scope?.querySelector('[data-act="voice"]');
      const languageSelect = this.scope?.querySelector('[data-act="language"]');
      if (voiceSelect) voiceSelect.value = Store.getSetting('ttsSpeaker') || voiceSelect.value;
      if (languageSelect) languageSelect.value = Store.getSetting('ttsLanguage') || languageSelect.value;
    }

    paintRate() {
      const el = this.scope?.querySelector('.rate');
      if (el) el.textContent = `${(Store.getSetting('ttsRate') || 1).toFixed(1)}×`;
    }

    paintTransport() {
      const button = this.scope?.querySelector('[data-act="play"]');
      if (!button) return;
      const showPause = Voice.playing && !Voice.paused;
      button.innerHTML = icon(showPause ? 'pause' : 'play');
      button.setAttribute('aria-label', showPause ? 'Pause' : 'Play');
    }

    changeRate(delta) {
      const next = Math.max(0.5, Math.min(2.5, Number(((Store.getSetting('ttsRate') || 1) + delta).toFixed(1))));
      Store.set({ settings: { ttsRate: next } });
      Voice.invalidate();
      this.paintRate();
      if (this.speaking) this.restart();
    }

    /* ------------------------------------------------------------------ */
    /* Reading                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Build the spoken string and a char-offset index back into live text
     * nodes, so a progress tick can be mapped to an exact on-screen Range.
     */
    prepare(text) {
      this.segments = [];

      if (text) {
        this.spokenText = String(text).replace(/\s+/g, ' ').trim();
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

    /** Read the page, or the selection, or an explanation of the selection. */
    async togglePlay() {
      if (Voice.playing) {
        if (Voice.paused) Voice.resume();
        else Voice.pause();
        this.paintTransport();
        return;
      }

      const selected = Text.selection();

      if (Store.getSetting('ttsExplain')) {
        if (!selected) {
          UI.toast('Select some text first — that is what I will explain.', {
            tone: 'warn',
            duration: 3600
          });
          return;
        }
        await this.speakExplanation(selected);
        return;
      }

      if (selected) {
        UI.toast('Reading your selection', { tone: 'success' });
        await this.speak(selected);
      } else {
        await this.speak();
      }
    }

    async speak(text = null) {
      this.prepare(text);

      if (!this.spokenText) {
        UI.toast('No readable text found on this page.', { tone: 'warn' });
        return;
      }

      this.speaking = true;
      this.paintTransport();

      await Voice.say(this.spokenText, {
        onProgress: (progress) => {
          this.markWord(progress.charIndex);
          this.paintProgress(progress.charIndex);
        }
      });

      this.speaking = false;
      this.paintProgress(0);
    }

    /**
     * Explain the selection in the reader's own language, then read the
     * explanation aloud in that language.
     *
     * The explanation is streamed and spoken sentence by sentence rather than
     * waited for in full. On the free models SETU runs on that is the
     * difference between hearing the first sentence in about two seconds and
     * hearing nothing for forty.
     */
    async speakExplanation(selection) {
      this.explainController?.abort();
      this.explainController = new AbortController();
      const controller = this.explainController;

      const languageCode = Store.getSetting('ttsLanguage') || 'en-IN';
      const languageName =
        Voice.languages.find((entry) => entry.code === languageCode)?.name ||
        Store.getSetting('language') ||
        'English';

      UI.toast(`Explaining in ${languageName}…`, { tone: 'success', duration: 3000 });

      this.speaking = true;
      this.paintTransport();
      this.segments = [];

      // Producer: sentences arrive from the engine. Consumer: the voice speaks
      // each one as soon as it is whole.
      const queue = [];
      let finished = false;
      let wake = null;

      const push = (sentence) => {
        queue.push(sentence);
        wake?.();
      };

      const producer = API.stream(
        '/api/agent/explain/stream',
        {
          text: selection,
          language: languageName,
          style: 'spoken'
        },
        {
          signal: controller.signal,
          onChunk: (_chunk, whole) => {
            // Emit complete sentences only; half a sentence read aloud is
            // worse than a beat of silence.
            let pending = whole.slice(producer.consumed || 0);
            producer.consumed = producer.consumed || 0;

            const boundary = pending.lastIndexOf('. ') >= 0
              ? pending.lastIndexOf('. ') + 1
              : Math.max(pending.lastIndexOf('। '), pending.lastIndexOf('? '), pending.lastIndexOf('! '));

            if (boundary > 40) {
              push(pending.slice(0, boundary + 1).trim());
              producer.consumed += boundary + 1;
            }
          }
        }
      );

      producer.consumed = 0;

      let full = '';
      producer
        .then((text) => {
          full = text;
          const tail = text.slice(producer.consumed).trim();
          if (tail) push(tail);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            UI.toast(`Could not explain that: ${error.message}`, { tone: 'error', duration: 4600 });
          }
        })
        .finally(() => {
          finished = true;
          wake?.();
        });

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (controller.signal.aborted) return;

          if (!queue.length) {
            if (finished) break;
            await new Promise((resolve) => {
              wake = resolve;
              setTimeout(resolve, 400);
            });
            wake = null;
            continue;
          }

          const sentence = queue.shift();
          if (!sentence) continue;
          await Voice.say(sentence, { allowBrowserFallback: true });
          if (controller.signal.aborted) return;
        }

        if (!full && !queue.length) {
          UI.toast('The engine had nothing to say about that selection.', { tone: 'warn' });
        }
      } finally {
        this.speaking = false;
        this.paintTransport();
        if (this.explainController === controller) this.explainController = null;
      }
    }

    restart() {
      const wasSpeaking = this.speaking;
      const text = this.spokenText;
      this.stop();
      if (wasSpeaking && text) this.speak(this.segments.length ? null : text);
    }

    stop() {
      this.explainController?.abort();
      this.explainController = null;
      this.speaking = false;
      Voice.stop();
      this.hideMark();
      this.paintProgress(0);
      this.paintTransport();
    }

    /* ------------------------------------------------------------------ */
    /* Spoken-word highlight                                              */
    /* ------------------------------------------------------------------ */

    /** Draw the highlight over the word at `charIndex` of the spoken text. */
    markWord(charIndex) {
      if (!this.segments.length) return;

      // The segments are ordered by charIndex, so a binary search keeps this
      // O(log n) on pages with tens of thousands of text nodes. The previous
      // linear reverse scan ran on every progress tick.
      let low = 0;
      let high = this.segments.length - 1;
      let found = -1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (this.segments[mid].charIndex <= charIndex) {
          found = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      if (found === -1) return;

      const segment = this.segments[found];
      if (!segment.node.isConnected) return;

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

      // Keep the spoken word comfortably in view — through the arbiter, so it
      // still works inside the Focus Mode reader and does not fight Auto
      // Scroll for the document scroller.
      if (rect.top < 90 || rect.bottom > window.innerHeight - 90) {
        Scroll.into(segment.node.parentElement, { block: 'center' });
      }
    }

    paintMark(rect) {
      const root = UI.host('tts-mark', { layer: 'reading' });

      if (!this.mark || !this.mark.isConnected) {
        const style = document.createElement('style');
        style.textContent = `
          .mark {
            position: fixed; border-radius: 2px; pointer-events: none;
            background: color-mix(in srgb, var(--accent) 22%, transparent);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
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

    hideMark() {
      if (this.mark) this.mark.style.display = 'none';
    }

    paintProgress(charIndex) {
      const fill = this.scope?.querySelector('.progress-fill');
      if (fill && this.spokenText.length) {
        fill.style.width = `${Math.min(100, (charIndex / this.spokenText.length) * 100)}%`;
      }
    }
  }

  // Exposed before the feature is registered so every later module — the mind
  // map's hover audio, the agent's "read this answer" — can speak without
  // opening a transport bar.
  window.SETU.Voice = Voice;
  window.SETU.features.set('tts', TextToSpeech);
})();
