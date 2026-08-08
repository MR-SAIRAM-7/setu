import type {
  CLSBreakdown,
  ComputeTier,
  DNAProfile,
  DomSummary,
  Extracted,
  LedgerEntry,
  Mode,
  Result,
  TCommanderPlan,
  TTransformArtifact,
} from '@setu/core';

/**
 * The message bus. Every cross-context call in the extension is one of these.
 *
 * Typing this exhaustively is worth the twenty minutes: `chrome.runtime`
 * messaging is stringly-typed by default, and a typo in a message name is a
 * silent no-op that costs an hour to find at 2am.
 */

export type ToContent =
  | { type: 'PING' }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'PANIC' }
  | { type: 'VOICE_START' }
  | { type: 'FORCE_BREATHE' }
  | { type: 'APPLY_DNA'; dna: DNAProfile }
  | { type: 'GET_PAGE' }
  | { type: 'GET_SELECTION' }
  | { type: 'GET_DOM_SUMMARY' }
  | { type: 'APPLY_PLAN'; plan: TCommanderPlan }
  | { type: 'HIGHLIGHT'; elementId: string }
  | { type: 'SPOTLIGHT'; hint: string | null; label: string }
  | { type: 'CLEAR_OVERLAYS' };

export type ToBackground =
  | { type: 'TRANSFORM'; req: TransformRequest }
  | { type: 'COMMAND'; utterance: string; dom: DomSummary }
  | { type: 'CLS_REPORT'; cls: CLSBreakdown; url: string }
  | { type: 'CLS_DELTA'; before: number; after: number; url: string; removed: RemovedSummary }
  | { type: 'BREATHE_FIRED'; url: string }
  | { type: 'BREATHE_OUTCOME'; outcome: 'accepted' | 'dismissed' | 'disabled' }
  | { type: 'GET_STATE' }
  | { type: 'GET_DNA' }
  | { type: 'SET_DNA'; dna: DNAProfile }
  | { type: 'GET_LEDGER' }
  | { type: 'CLEAR_LEDGER' }
  | { type: 'OPEN_PANEL' }
  | { type: 'SET_DEMO_MODE'; on: boolean }
  | { type: 'REQUEST_SITE_ACCESS'; origin: string };

export type ToPanel =
  | { type: 'RUN_MODE'; mode: Mode; payload: JobPayload }
  | { type: 'CLS_UPDATE'; cls: CLSBreakdown; url: string }
  | { type: 'LEDGER_UPDATE' }
  | { type: 'DEMO_MODE'; on: boolean };

export interface RemovedSummary {
  ads: number;
  motion: number;
  scripts: number;
  nodes: number;
}

export interface JobPayload {
  text?: string;
  imageUrl?: string;
  url?: string;
  title?: string;
  contextBefore?: string;
}

export interface TransformRequest {
  mode: Mode;
  input: string;
  /** raw base64 data URL for multimodal EXPLAIN */
  imageDataUrl?: string;
  extracted?: Pick<Extracted, 'wordCount' | 'readingGrade'>;
  /** the user answered the consent dialog for this specific call */
  consent?: boolean;
  url?: string;
}

export type TransformResponse = Result<TTransformArtifact>;

export interface ExtensionState {
  dna: DNAProfile;
  demoMode: boolean;
  apiBase: string;
  signedIn: boolean;
  nanoAvailable: boolean;
  online: boolean;
  lastCLS?: { cls: CLSBreakdown; url: string };
  ledger: LedgerEntry[];
}

export interface PendingJob {
  mode: Mode;
  payload: JobPayload;
  at: number;
}

export interface PageCapture {
  url: string;
  title: string;
  text: string;
  wordCount: number;
  readingGrade: number;
  cls: CLSBreakdown;
  tier?: ComputeTier;
}

/* ── typed senders ────────────────────────────────────────────────────────── */

export function sendToBackground<T = unknown>(msg: ToBackground): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

export function sendToTab<T = unknown>(tabId: number, msg: ToContent): Promise<T> {
  return chrome.tabs.sendMessage(tabId, msg) as Promise<T>;
}

/** Fire-and-forget to the panel. The panel may not be open; that is not an error. */
export function notifyPanel(msg: ToPanel): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* no listener — the panel is closed */
  });
}

export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
