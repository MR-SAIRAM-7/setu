/**
 * Voice capture for COMMANDER (§7.9). Web Speech API, on-device where the
 * platform allows it.
 *
 * Voice is an *input* affordance here, never an always-listening one: capture
 * starts on an explicit keypress and stops on the first result or on Esc.
 * A microphone that listens without being asked is exactly the surveillance
 * posture SETU exists to avoid.
 */

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechCtor | null {
  const g = window as unknown as Record<string, SpeechCtor | undefined>;
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  return ctor() !== null;
}

export interface ListenResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

let active: SpeechRecognitionLike | null = null;

export function listenOnce(lang = 'en-IN', timeoutMs = 8000): Promise<ListenResult> {
  const C = ctor();
  if (!C)
    return Promise.resolve({
      ok: false,
      error: 'This browser cannot capture speech. Type the command instead.',
    });

  stopListening();

  return new Promise((resolve) => {
    const rec = new C();
    active = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let settled = false;
    const finish = (r: ListenResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onEsc, true);
      active = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      resolve(r);
    };

    const timer = setTimeout(
      () => finish({ ok: false, error: 'I did not catch that. Try again, or type it.' }),
      timeoutMs,
    );

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish({ ok: false, error: 'Cancelled.' });
    };
    document.addEventListener('keydown', onEsc, true);

    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript?.trim();
      finish(transcript ? { ok: true, transcript } : { ok: false, error: 'Nothing was said.' });
    };

    rec.onerror = (e) => {
      const message =
        e.error === 'not-allowed'
          ? 'Microphone access was refused. You can type the command instead.'
          : e.error === 'no-speech'
            ? 'I did not hear anything.'
            : 'Speech capture did not work. Type the command instead.';
      finish({ ok: false, error: message });
    };

    rec.onend = () => finish({ ok: false, error: 'Stopped listening.' });

    try {
      rec.start();
    } catch {
      finish({ ok: false, error: 'Could not start the microphone.' });
    }
  });
}

export function stopListening(): void {
  try {
    active?.abort();
  } catch {
    /* nothing was running */
  }
  active = null;
}
