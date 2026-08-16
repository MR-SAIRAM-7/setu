/**
 * SETU Accessible Text-To-Speech (TTS) & Audio Feedback Engine
 * -----------------------------------------------------------
 * Provides real-time speech synthesis for ADHD & Dyslexia learners,
 * word-by-word tracking, audio cues, and gentle completion chimes.
 */

class TTSEngine {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.listeners = new Set();
    this.rate = 1.0;
    this.pitch = 1.0;
    this.voice = null;
    this.currentWordIndex = -1;
    this.currentCharIndex = -1;

    if (this.synth && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.stop());
    }
  }

  isAvailable() {
    return Boolean(this.synth);
  }

  getVoices() {
    if (!this.synth) return [];
    return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.5, rate));
  }

  setVoice(voice) {
    this.voice = voice;
  }

  speak(text, { onBoundary = null, onEnd = null, onStart = null } = {}) {
    if (!this.synth || !text) return;

    this.stop();

    // Clean text of markdown characters before speaking
    const cleanText = text
      .replace(/[#*_`~>[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    if (this.voice) {
      utterance.voice = this.voice;
    } else {
      // Pick best natural voice if available
      const voices = this.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel')
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.currentUtterance = utterance;
      this._emitChange();
      onStart?.();
    };

    utterance.onboundary = (event) => {
      this.currentCharIndex = event.charIndex;
      onBoundary?.(event);
      this._emitChange();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this._emitChange();
      onEnd?.();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('[SETU TTS] Speech synthesis error:', e.error);
      }
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this._emitChange();
    };

    this.synth.speak(utterance);
  }

  pause() {
    if (this.synth && this.isPlaying && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      this._emitChange();
    }
  }

  resume() {
    if (this.synth && this.isPlaying && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      this._emitChange();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this._emitChange();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emitChange() {
    for (const listener of this.listeners) {
      try {
        listener({
          isPlaying: this.isPlaying,
          isPaused: this.isPaused,
          currentCharIndex: this.currentCharIndex
        });
      } catch (_) {}
    }
  }

  /**
   * Generates a warm, rewarding dopamine chime for ADHD task completion
   * using Web Audio API without needing external MP3 assets.
   */
  playCelebrationChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Chord frequencies: C5, E5, G5, C6 (Major triad celebration)
      const freqs = [523.25, 659.25, 783.99, 1046.5];

      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.65);
      });
    } catch (_) {}
  }
}

export const tts = new TTSEngine();
