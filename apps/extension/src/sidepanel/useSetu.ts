import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DNA,
  redactPII,
  type Mode,
  type PIISpan,
  type Result,
  type ResultMeta,
  type TTransformArtifact,
} from '@setu/core';
import {
  activeTab,
  sendToBackground,
  sendToTab,
  type ExtensionState,
  type PageCapture,
  type TransformRequest,
} from '../lib/messages';

/**
 * Panel state + the one hook every mode panel uses to run a transform.
 *
 * The consent gate lives here rather than in each panel, so it is impossible
 * to add a mode that forgets to ask.
 */

export function useExtensionState() {
  const [state, setState] = useState<ExtensionState>({
    dna: DEFAULT_DNA,
    demoMode: false,
    apiBase: '',
    signedIn: false,
    nanoAvailable: false,
    online: true,
    ledger: [],
  });

  const refresh = useCallback(async () => {
    const s = await sendToBackground<ExtensionState>({ type: 'GET_STATE' });
    if (s) setState(s);
  }, []);

  useEffect(() => {
    void refresh();
    const listener = (msg: { type?: string }) => {
      if (msg?.type === 'LEDGER_UPDATE' || msg?.type === 'CLS_UPDATE' || msg?.type === 'DEMO_MODE')
        void refresh();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  return { state, refresh };
}

export interface PendingConsent {
  mode: Mode;
  preview: string;
  spans: PIISpan[];
  proceed: () => void;
  cancel: () => void;
}

export interface RunState {
  busy: boolean;
  data: TTransformArtifact | null;
  meta: ResultMeta | null;
  error: { message: string; nextAction?: string } | null;
  usedFallback: boolean;
}

const IDLE: RunState = { busy: false, data: null, meta: null, error: null, usedFallback: false };

export function useTransform(cloudPolicy: 'ask' | 'allow' | 'never') {
  const [run, setRun] = useState<RunState>(IDLE);
  const [consent, setConsent] = useState<PendingConsent | null>(null);
  const lastRequest = useRef<TransformRequest | null>(null);

  const execute = useCallback(async (req: TransformRequest) => {
    lastRequest.current = req;
    setRun({ ...IDLE, busy: true });

    const res = await sendToBackground<Result<TTransformArtifact>>({ type: 'TRANSFORM', req });

    if (!res) {
      setRun({
        ...IDLE,
        error: {
          message: 'The SETU background process did not answer.',
          nextAction: 'Reload the page and try again.',
        },
      });
      return;
    }

    if (res.ok) {
      setRun({ busy: false, data: res.data, meta: res.meta, error: null, usedFallback: false });
      return;
    }

    // A failure still produces an artifact where one exists (Axiom 2). The user
    // never sees a dead end — the worst case is a less clever result.
    setRun({
      busy: false,
      data: res.fallback ?? null,
      meta: null,
      error: { message: res.error.message, nextAction: res.error.nextAction },
      usedFallback: !!res.fallback,
    });
  }, []);

  /** Modes that always run locally never trigger the consent gate. */
  const start = useCallback(
    async (req: TransformRequest) => {
      if (cloudPolicy === 'allow' || req.mode === 'FOCUS') {
        await execute({ ...req, consent: true });
        return;
      }

      const { text: preview, spans } = redactPII(req.input);
      setConsent({
        mode: req.mode,
        preview,
        spans,
        proceed: () => {
          setConsent(null);
          void execute({ ...req, consent: true });
        },
        cancel: () => setConsent(null),
      });
    },
    [cloudPolicy, execute],
  );

  const retry = useCallback(() => {
    if (lastRequest.current) void execute({ ...lastRequest.current, consent: true });
  }, [execute]);

  const reset = useCallback(() => {
    setRun(IDLE);
    setConsent(null);
  }, []);

  return { run, consent, start, retry, reset, setRun };
}

/* ── talking to the page ──────────────────────────────────────────────────── */

async function withTab<T>(msg: Parameters<typeof sendToTab>[1]): Promise<T | null> {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try {
    return (await sendToTab<T>(tab.id, msg)) ?? null;
  } catch {
    // No content script on this tab — a chrome:// page, the Web Store, or a
    // site the user has not granted. Not an error worth shouting about.
    return null;
  }
}

export const capturePage = () => withTab<PageCapture>({ type: 'GET_PAGE' });

export const captureSelection = () =>
  withTab<{ text: string; url: string; contextBefore: string }>({ type: 'GET_SELECTION' });

export const captureDom = () => withTab<import('@setu/core').DomSummary>({ type: 'GET_DOM_SUMMARY' });

export const toggleFocusOnPage = () => withTab({ type: 'TOGGLE_FOCUS' });

export const forceBreathe = () => withTab({ type: 'FORCE_BREATHE' });

export const panicOnPage = () => withTab({ type: 'PANIC' });
