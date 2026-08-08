import {
  DEFAULT_DNA,
  normaliseDNA,
  type DNAProfile,
  type LedgerEntry,
} from '@setu/core';
import type { PendingJob } from './messages';

/**
 * Extension-local persistence.
 *
 * Hard requirement from §38: BEING SIGNED OUT MUST NEVER BREAK FOCUS MODE.
 * The person who most needs the calm page is the person least able to complete
 * a login flow. So the DNA profile lives in chrome.storage.local first and
 * syncs to the server opportunistically — never the other way round.
 */

const K = {
  dna: 'setu.dna',
  dnaUpdatedAt: 'setu.dna.updatedAt',
  ledger: 'setu.ledger',
  demoMode: 'setu.demoMode',
  apiBase: 'setu.apiBase',
  token: 'setu.token',
  pendingJob: 'setu.pendingJob',
  consentAlways: 'setu.consent.always',
  onboarded: 'setu.onboarded',
} as const;

declare const __SETU_API_BASE__: string;

export const DEFAULT_API_BASE =
  typeof __SETU_API_BASE__ === 'string' ? __SETU_API_BASE__ : 'http://localhost:3000';

/** Keep the ledger bounded. It is a user-facing log, not an audit archive. */
const LEDGER_MAX = 500;

async function get<T>(key: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(key);
  return (r[key] as T | undefined) ?? fallback;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/* ── DNA ──────────────────────────────────────────────────────────────────── */

export async function getDNA(): Promise<DNAProfile> {
  return normaliseDNA(await get<Partial<DNAProfile>>(K.dna, DEFAULT_DNA));
}

export async function setDNA(dna: DNAProfile): Promise<void> {
  await chrome.storage.local.set({ [K.dna]: dna, [K.dnaUpdatedAt]: Date.now() });
}

export async function getDNAUpdatedAt(): Promise<number> {
  return get<number>(K.dnaUpdatedAt, 0);
}

export async function isOnboarded(): Promise<boolean> {
  return get<boolean>(K.onboarded, false);
}

export async function setOnboarded(v: boolean): Promise<void> {
  await set(K.onboarded, v);
}

/* ── Trust Ledger ─────────────────────────────────────────────────────────────
   Written locally FIRST, always, including for L0/L1 rows that never touch the
   network. A ledger that only records cloud calls is a list of accusations; a
   ledger that records everything is a proof.
   ─────────────────────────────────────────────────────────────────────────── */

export async function getLedger(): Promise<LedgerEntry[]> {
  return get<LedgerEntry[]>(K.ledger, []);
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  const all = await getLedger();
  all.unshift(entry);
  await set(K.ledger, all.slice(0, LEDGER_MAX));
}

export async function clearLedger(): Promise<void> {
  await set(K.ledger, []);
}

/* ── settings ─────────────────────────────────────────────────────────────── */

export async function getApiBase(): Promise<string> {
  return get<string>(K.apiBase, DEFAULT_API_BASE);
}

export async function setApiBase(v: string): Promise<void> {
  await set(K.apiBase, v.replace(/\/+$/, ''));
}

export async function getToken(): Promise<string | null> {
  const r = await chrome.storage.session?.get(K.token).catch(() => ({}));
  const sessionToken = (r as Record<string, string | undefined>)?.[K.token];
  if (sessionToken) return sessionToken;
  return get<string | null>(K.token, null);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await chrome.storage.session?.set({ [K.token]: token });
  else await chrome.storage.session?.remove(K.token);
}

/* ── demo mode (§45) ──────────────────────────────────────────────────────────
   Ctrl/Alt+Shift+D. Every panel renders from local fixtures, network fully
   bypassed. Build it before you need it, not on the morning of the pitch.
   ─────────────────────────────────────────────────────────────────────────── */

export async function getDemoMode(): Promise<boolean> {
  return get<boolean>(K.demoMode, false);
}

export async function setDemoMode(on: boolean): Promise<void> {
  await set(K.demoMode, on);
}

/* ── consent ──────────────────────────────────────────────────────────────────
   'ask' is the default. "Always" is per-mode and revocable, never global and
   never implicit.
   ─────────────────────────────────────────────────────────────────────────── */

export async function getAlwaysAllow(): Promise<string[]> {
  return get<string[]>(K.consentAlways, []);
}

export async function addAlwaysAllow(mode: string): Promise<void> {
  const list = await getAlwaysAllow();
  if (!list.includes(mode)) await set(K.consentAlways, [...list, mode]);
}

export async function clearAlwaysAllow(): Promise<void> {
  await set(K.consentAlways, []);
}

/* ── panel handoff ────────────────────────────────────────────────────────────
   A context-menu click opens the side panel, but the panel takes a moment to
   mount and will miss a message sent immediately. Park the job; the panel
   collects it on mount AND listens for live messages.
   ─────────────────────────────────────────────────────────────────────────── */

export async function setPendingJob(job: PendingJob): Promise<void> {
  await set(K.pendingJob, job);
}

export async function takePendingJob(): Promise<PendingJob | null> {
  const job = await get<PendingJob | null>(K.pendingJob, null);
  if (job) await chrome.storage.local.remove(K.pendingJob);
  // Ignore anything stale — a job from ten minutes ago is not what the user
  // just clicked, and replaying it would be baffling.
  if (job && Date.now() - job.at > 60_000) return null;
  return job;
}
