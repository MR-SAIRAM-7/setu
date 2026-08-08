import {
  SCHEMA_BY_MODE,
  toSetuError,
  type Result,
  type TCommanderPlan,
  type TTransformArtifact,
  type DNAProfile,
  type DomSummary,
  type Mode,
} from '@setu/core';
import { DEMO_LATENCY_MS, fixtureFor } from './fixtures';
import { getApiBase, getDemoMode, getToken } from './storage';
import type { TransformRequest } from './messages';

/**
 * The client for SETU EDGE.
 *
 * §8, non-negotiable: THE EXTENSION NEVER TALKS TO GEMINI DIRECTLY.
 * It talks to our API. One key, one place to rate-limit, one place to write
 * the Trust Ledger, and no API key sitting inside a Chrome extension bundle
 * where anyone can unzip it and read it. This is a security requirement, not
 * a preference.
 */

const TIMEOUT_MS = 20_000;

export interface CallOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function post<T>(path: string, body: unknown, opts: CallOptions = {}): Promise<T> {
  const base = await getApiBase();
  const token = await getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-setu-surface': 'lens',
        'x-setu-client': await deviceId(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(
        `${res.status} ${(detail as { error?: string }).error ?? res.statusText}`,
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ── transform ────────────────────────────────────────────────────────────── */

export async function callTransform(
  req: TransformRequest,
  dna: DNAProfile,
): Promise<Result<TTransformArtifact>> {
  // Demo mode: never touch the network. §45 rule 1.
  if (await getDemoMode()) {
    const fixture = fixtureFor(req.mode);
    await sleep(DEMO_LATENCY_MS);
    if (fixture)
      return {
        ok: true,
        data: fixture,
        meta: {
          tier: 'L2',
          model: 'demo-fixture',
          latencyMs: DEMO_LATENCY_MS,
          cached: true,
          leftDevice: false,
          bytesSent: 0,
          redactions: 0,
        },
      };
  }

  try {
    const raw = await post<Result<unknown>>('/api/transform', {
      mode: req.mode,
      input: req.input,
      imageDataUrl: req.imageDataUrl,
      dna,
      surface: 'lens',
      consent: req.consent === true,
      url: req.url,
    });

    if (!raw.ok) return raw as Result<TTransformArtifact>;

    // THE CONTRACT RULE, enforced a second time on the client. The server
    // already validated, but the client must never render anything it did not
    // itself verify — a compromised or stale edge is not a reason to put
    // unvalidated data in front of a user who is already overwhelmed.
    const parsed = SCHEMA_BY_MODE[req.mode].safeParse(raw.data);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'SCHEMA_INVALID',
          message: 'The result did not match what this panel can render.',
          nextAction: 'Try again — we will use a simpler engine.',
        },
      };
    }

    return { ok: true, data: parsed.data as TTransformArtifact, meta: raw.meta };
  } catch (e) {
    return { ok: false, error: toSetuError(e) };
  }
}

/* ── commander ────────────────────────────────────────────────────────────── */

export async function callCommander(
  utterance: string,
  dom: DomSummary,
  dna: DNAProfile,
): Promise<Result<TCommanderPlan>> {
  if (await getDemoMode()) {
    const fixture = fixtureFor('COMMANDER');
    await sleep(DEMO_LATENCY_MS);
    if (fixture)
      return {
        ok: true,
        data: fixture as TCommanderPlan,
        meta: {
          tier: 'L2',
          model: 'demo-fixture',
          latencyMs: DEMO_LATENCY_MS,
          cached: true,
          leftDevice: false,
        },
      };
  }

  try {
    const raw = await post<Result<unknown>>('/api/commander', {
      utterance,
      dom,
      dna,
      surface: 'lens',
    });
    if (!raw.ok) return raw as Result<TCommanderPlan>;

    const parsed = SCHEMA_BY_MODE.COMMANDER.safeParse(raw.data);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'PLAN_REJECTED',
          message: 'The plan did not match what we can safely execute.',
          nextAction: 'Nothing was changed on the page. Try rephrasing.',
        },
      };
    }
    return { ok: true, data: parsed.data, meta: raw.meta };
  } catch (e) {
    return { ok: false, error: toSetuError(e) };
  }
}

/* ── health ───────────────────────────────────────────────────────────────── */

export async function checkHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, detail: `Edge responded ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; providers?: string[] };
    return {
      ok: !!body.ok,
      detail: body.providers?.length
        ? `Connected. Engines available: ${body.providers.join(', ')}.`
        : 'Connected, but no AI engine is configured on the server.',
    };
  } catch (e) {
    return {
      ok: false,
      detail:
        e instanceof Error && /abort/i.test(e.message)
          ? 'No response from the SETU server.'
          : 'Could not reach the SETU server. Focus Mode still works.',
    };
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/**
 * A random per-install id. Used ONLY as a rate-limit bucket when the edge runs
 * in open mode. It is not tied to a person and is regenerated on reinstall.
 */
async function deviceId(): Promise<string> {
  const k = 'setu.deviceId';
  const stored = (await chrome.storage.local.get(k))[k] as string | undefined;
  if (stored) return stored;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [k]: id });
  return id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function modeIsAllowedOffline(mode: Mode): Promise<boolean> {
  return mode === 'FOCUS';
}
