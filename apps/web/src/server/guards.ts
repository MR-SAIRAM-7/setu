import { SetuError, type DNAProfile } from '@setu/core';
import { env } from './env';

/**
 * The guards that run before ANY model is touched (§11.1).
 *
 * One door means exactly one place enforces authentication, rate limits,
 * consent checks and cost accounting. In a 15-day build that is the difference
 * between a system you can reason about and a system that surprises you on
 * stage.
 */

export interface Identity {
  id: string;
  kind: 'user' | 'device';
}

/**
 * Auth is deliberately pluggable.
 *
 *   'open'     — no account required; the caller's per-install device id is the
 *                rate-limit bucket. This is the mode the extension ships in
 *                today, and it is what makes SETU usable before Sanctuary auth
 *                exists. §38: being signed out must never break the product.
 *   'supabase' — a real bearer token is required. Flip to this once the web app
 *                lands, without touching a single route handler.
 */
export async function identify(request: Request): Promise<Identity> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (env.authMode === 'supabase') {
    if (!bearer) throw new SetuError('AUTH_REQUIRED', 'This SETU server requires a signed-in user.');
    const user = await verifySupabaseToken(bearer);
    if (!user) throw new SetuError('AUTH_REQUIRED', 'That session is no longer valid.');
    return { id: user, kind: 'user' };
  }

  if (bearer) {
    const user = await verifySupabaseToken(bearer).catch(() => null);
    if (user) return { id: user, kind: 'user' };
  }

  const device = request.headers.get('x-setu-client');
  return { id: device || anonymousBucket(request), kind: 'device' };
}

async function verifySupabaseToken(token: string): Promise<string | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: env.supabaseAnonKey },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    return body.id ?? null;
  } catch {
    return null;
  }
}

/**
 * A coarse fallback bucket when there is no device header at all. Deliberately
 * NOT a fingerprint — it is only precise enough to stop one caller exhausting
 * the free tier, and it is not stored.
 */
function anonymousBucket(request: Request): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  return `anon:${ip}`;
}

/* ── rate limiting ────────────────────────────────────────────────────────────
   In-memory token buckets. This is correct for a single instance and for the
   hackathon; on a multi-instance deploy, swap the Map for Upstash Redis. The
   interface is designed so that is a ten-line change.
   ─────────────────────────────────────────────────────────────────────────── */

interface Bucket {
  minute: { count: number; resetAt: number };
  day: { count: number; resetAt: number };
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  ok: boolean;
  retryAfter?: number;
  remaining: number;
}

export function rateLimit(identity: Identity): RateResult {
  const now = Date.now();
  let b = buckets.get(identity.id);

  if (!b) {
    b = { minute: { count: 0, resetAt: now + 60_000 }, day: { count: 0, resetAt: now + 86_400_000 } };
    buckets.set(identity.id, b);
  }
  if (now > b.minute.resetAt) b.minute = { count: 0, resetAt: now + 60_000 };
  if (now > b.day.resetAt) b.day = { count: 0, resetAt: now + 86_400_000 };

  if (b.minute.count >= env.ratePerMin)
    return { ok: false, retryAfter: Math.ceil((b.minute.resetAt - now) / 1000), remaining: 0 };
  if (b.day.count >= env.ratePerDay)
    return { ok: false, retryAfter: Math.ceil((b.day.resetAt - now) / 1000), remaining: 0 };

  b.minute.count++;
  b.day.count++;

  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.day.resetAt) buckets.delete(k);
  }

  return { ok: true, remaining: env.ratePerMin - b.minute.count };
}

/* ── consent ──────────────────────────────────────────────────────────────────
   The client is the primary consent gate (it is what shows the user the
   redacted payload). This is the second one: a request that reaches the server
   without consent, for a profile that requires it, is refused here regardless
   of what the client believed.
   ─────────────────────────────────────────────────────────────────────────── */

export function checkConsent(dna: DNAProfile, consent: boolean): boolean {
  if (dna.privacy.cloudAI === 'never') return false;
  if (dna.privacy.cloudAI === 'allow') return true;
  return consent === true;
}

/* ── input limits ─────────────────────────────────────────────────────────── */

export const MAX_INPUT_CHARS = 200_000;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export function validateSize(input: string, imageDataUrl?: string): void {
  if (input.length > MAX_INPUT_CHARS)
    throw new SetuError(
      'NO_CONTENT',
      'That is larger than SETU can process in one go.',
      'Select a section of it, or upload it to the Sanctuary instead.',
    );
  if (imageDataUrl && imageDataUrl.length * 0.75 > MAX_IMAGE_BYTES)
    throw new SetuError('NO_CONTENT', 'That image is too large.', 'Try a smaller screenshot.');
}
