/**
 * SETU Mobile — Accessible Text-To-Speech (TTS) Service
 * ------------------------------------------------------
 * Wraps expo-speech to provide clear speech synthesis, customizable playback rates,
 * voice selection, and gentle completion feedback for dyslexic and ADHD learners.
 */

import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: any) => void;
}

class TTSService {
  private isSpeakingState = false;
  private currentRate = 1.0;
  private currentPitch = 1.0;

  public setRate(rate: number) {
    this.currentRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setPitch(pitch: number) {
    this.currentPitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  public async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!text || !text.trim()) return;

    // Clean text of markdown characters before speaking
    const cleanText = text
      .replace(/[#*_`~>[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    try {
      await this.stop();

      this.isSpeakingState = true;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}

      Speech.speak(cleanText, {
        rate: options.rate || this.currentRate,
        pitch: options.pitch || this.currentPitch,
        voice: options.voice,
        onStart: () => {
          this.isSpeakingState = true;
          options.onStart?.();
        },
        onDone: () => {
          this.isSpeakingState = false;
          options.onDone?.();
        },
        onStopped: () => {
          this.isSpeakingState = false;
        },
        onError: (err) => {
          this.isSpeakingState = false;
          options.onError?.(err);
        },
      });
    } catch (err) {
      this.isSpeakingState = false;
      options.onError?.(err);
    }
  }

  public async stop(): Promise<void> {
    try {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        await Speech.stop();
      }
    } catch (_) {}
    this.isSpeakingState = false;
  }

  public async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch (_) {
      return this.isSpeakingState;
    }
  }

  public async getAvailableVoices() {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (_) {
      return [];
    }
  }
}

export const tts = new TTSService();
