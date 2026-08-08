import type { ComputeTier, Mode, Surface } from './types';

/**
 * ⭐ THE TRUST LEDGER (§42.3)
 *
 * "Most products put privacy in a policy. We put it in a log the user can read.
 *  Here is every byte that has ever left this device."
 *
 * Append-only. Every transform writes one row, including L0/L1 rows, which
 * carry `leftDevice: false` and render with a green "never left your device"
 * badge. Logging only the cloud calls would make the ledger a list of
 * accusations; logging everything makes it a proof.
 */

export interface LedgerEntry {
  id: string;
  at: string; // ISO
  surface: Surface;
  mode: Mode;
  tier: ComputeTier;
  /** 'google' | 'groq' | 'none' */
  provider: string;
  bytesSent: number;
  /** how many PII spans were scrubbed before sending */
  redactions: number;
  purpose: string;
  leftDevice: boolean;
  consentId?: string;
  /** domain only, never the full URL */
  domain?: string;
}

export function newLedgerEntry(e: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), ...e };
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export interface LedgerSummary {
  total: number;
  onDevice: number;
  cloud: number;
  bytesSent: number;
  redactions: number;
}

export function summariseLedger(entries: LedgerEntry[]): LedgerSummary {
  return entries.reduce<LedgerSummary>(
    (a, e) => ({
      total: a.total + 1,
      onDevice: a.onDevice + (e.leftDevice ? 0 : 1),
      cloud: a.cloud + (e.leftDevice ? 1 : 0),
      bytesSent: a.bytesSent + e.bytesSent,
      redactions: a.redactions + e.redactions,
    }),
    { total: 0, onDevice: 0, cloud: 0, bytesSent: 0, redactions: 0 },
  );
}

/** The sentence for the top of the Trust page. */
export function describeLedger(s: LedgerSummary): string {
  if (!s.total) return 'Nothing has left this device yet.';
  const pct = Math.round((s.onDevice / s.total) * 100);
  return `${s.total} actions. ${s.onDevice} ran entirely on this device (${pct}%). ${
    s.cloud
  } sent ${formatBytes(s.bytesSent)} of redacted text to a model, with ${s.redactions} personal detail${
    s.redactions === 1 ? '' : 's'
  } removed first.`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
