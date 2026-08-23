/**
 * SETU Mobile — speech-to-text.
 *
 * Records a short utterance and sends it to `/api/speech/transcribe`, which
 * fronts Sarvam Saaras. Dictation matters here for the same reason read-aloud
 * does: for a dyslexic adult, saying a sentence and getting text is often the
 * difference between asking the question and abandoning it. It is also the only
 * comfortable way to enter Devanagari or Tamil on a phone keyboard.
 *
 * There is no on-device recogniser in this build, so when the server has no
 * Sarvam key the button says so plainly rather than pretending. An honest
 * "dictation is unavailable" is recoverable; a silently fabricated transcript
 * is not.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  type RecordingOptions,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { getApiBaseUrl, getApiLanguage } from './api';
import { peekUserId } from './identity';
import { tts } from './tts';

/**
 * Mono, 16 kHz, AAC.
 *
 * Speech recognisers downsample to roughly this anyway, and a short mono clip
 * uploads several times faster than the stereo 44.1 kHz preset — which is the
 * whole latency budget on a phone with two bars of signal.
 */
const SPEECH_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
};

/** Hard stop, so a forgotten open mic cannot record until the battery dies. */
const MAX_RECORDING_MS = 60_000;

export interface TranscriptionResult {
  transcript: string;
  language_code?: string;
}

/** Upload one recorded clip and get text back. */
export async function transcribeAudioFile(
  uri: string,
  language: string = getApiLanguage()
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'audio/m4a',
    name: 'utterance.m4a',
  } as any);
  formData.append('language', language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/speech/transcribe`, {
      method: 'POST',
      headers: { 'x-user-id': peekUserId() },
      body: formData,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data.fallbackToBrowser
          ? 'Dictation is not switched on for this engine.'
          : data.error || 'Could not transcribe that recording.'
      );
    }
    return data as TranscriptionResult;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('The transcription took too long. Try a shorter recording.');
    }
    throw error instanceof Error ? error : new Error('Could not reach the transcription engine.');
  } finally {
    clearTimeout(timer);
  }
}

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';

export interface UseVoiceInputResult {
  status: VoiceInputStatus;
  /** Null until the availability probe answers, so the UI can stay neutral. */
  available: boolean | null;
  error: string | null;
  toggle: () => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * Push-to-talk dictation.
 *
 * Returns a `toggle` because a hold-to-talk gesture is a poor fit for users with
 * motor differences or tremor — one tap to start, one to stop, with a visible
 * state in between and a hard timeout behind it.
 */
export function useVoiceInput(onTranscript: (text: string) => void): UseVoiceInputResult {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    tts.isTranscriptionAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      await recorder.stop();
    } catch (_) {
      /* nothing was recording; fall through to the uri check */
    }

    const uri = recorder.uri;
    if (cancelledRef.current || !uri) {
      if (mountedRef.current) setStatus('idle');
      return;
    }

    if (mountedRef.current) setStatus('transcribing');

    try {
      const result = await transcribeAudioFile(uri);
      const transcript = String(result?.transcript || '').trim();

      if (!transcript) {
        if (mountedRef.current) setError('Nothing was picked up. Try again a little closer.');
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}
        onTranscript(transcript);
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message || 'Could not transcribe that recording.');
    } finally {
      if (mountedRef.current) setStatus('idle');
    }
  }, [onTranscript, recorder]);

  const start = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access is off. Turn it on in your phone settings to dictate.');
      return;
    }

    // Read-aloud and the microphone cannot share the moment — the mic would
    // otherwise record the app talking to itself.
    await tts.stop();

    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (_) {
      setError('Could not start recording on this device.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    setStatus('recording');
    timeoutRef.current = setTimeout(() => {
      stopAndTranscribe();
    }, MAX_RECORDING_MS);
  }, [recorder, stopAndTranscribe]);

  const toggle = useCallback(async () => {
    if (status === 'transcribing') return;
    if (status === 'recording') {
      await stopAndTranscribe();
      return;
    }
    if (available === false) {
      setError('Dictation needs the speech engine, which is not switched on right now.');
      return;
    }
    await start();
  }, [available, start, status, stopAndTranscribe]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try {
      await recorder.stop();
    } catch (_) {}
    setStatus('idle');
  }, [recorder]);

  return { status, available, error, toggle, cancel };
}
