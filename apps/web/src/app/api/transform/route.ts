import type { NextRequest } from 'next/server';
import {
  ALL_MODES,
  cacheKey,
  createMemoryCache,
  defaultContext,
  deterministicFallback,
  isSetuError,
  normaliseDNA,
  redactPII,
  rehydrate,
  toSetuError,
  type ComputeTier,
  type Mode,
  type Result,
  type TTransformArtifact,
} from '@setu/core';
import { countWords, runTransform } from '@/server/transform';
import { checkConsent, identify, rateLimit, validateSize } from '@/server/guards';
import { preflight, withCors } from '@/server/cors';

/**
 * /api/transform — THE ONE DOOR (§36.1).
 *
 * Every arrow that leaves a user device converges here. That is what gives us
 * exactly one place to enforce authentication, rate limits, consent checks,
 * PII scrubbing, schema validation, caching and cost accounting.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const cache = createMemoryCache<Result<TTransformArtifact>>(300);

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  try {
    /* 1. Who is calling, and are they allowed to right now? */
    const identity = await identify(request);
    const rl = rateLimit(identity);
    if (!rl.ok)
      return withCors(
        request,
        { ok: false, error: { code: 'RATE_LIMIT', message: 'Too many requests just now.', nextAction: 'Wait a moment and try again.' } },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
      );

    const body = (await request.json()) as {
      mode?: string;
      input?: string;
      imageDataUrl?: string;
      dna?: unknown;
      surface?: 'lens' | 'sanctuary' | 'go';
      consent?: boolean;
      tier?: ComputeTier;
    };

    const mode = body.mode as Mode;
    if (!mode || !ALL_MODES.includes(mode))
      return withCors(
        request,
        { ok: false, error: { code: 'UNSUPPORTED_MODE', message: `Unknown mode: ${body.mode}`, nextAction: 'Update the extension.' } },
        { status: 400 },
      );

    const input = (body.input ?? '').trim();
    if (!input && !body.imageDataUrl)
      return withCors(
        request,
        { ok: false, error: { code: 'NO_CONTENT', message: 'There was nothing to work on.', nextAction: 'Select some text first.' } },
        { status: 400 },
      );

    validateSize(input, body.imageDataUrl);

    const dna = normaliseDNA(body.dna);

    /* 2. Consent. The client already gated this and showed the user the
          redacted payload; this is the independent second check. */
    if (!checkConsent(dna, body.consent === true))
      return withCors(
        request,
        { ok: false, error: { code: 'CONSENT_REQUIRED', message: 'Cloud AI needs your OK for this one.', nextAction: 'Review what would be sent, then choose Allow.' } },
        { status: 428 },
      );

    /* 3. Redact BEFORE anything leaves this process.
          The extension already redacted; doing it again here means a request
          from any other client is held to the same standard. Defence in depth
          costs nothing and removes an entire class of "but what if the client
          forgot" question from the privacy conversation. */
    const { text: safe, spans } = redactPII(input);

    /* 4. Cache. §25.2 — pre-warm this for every demo input the night before.
          A 200ms cached response reads as competence, and gives you a free
          proof point: same input, same output, every time. */
    const key = await cacheKey(mode, dna, safe + (body.imageDataUrl ? ':img' : ''));
    const hit = await cache.get(key);
    if (hit?.value.ok) {
      return withCors(request, {
        ...hit.value,
        meta: { ...hit.value.meta, cached: true, latencyMs: 0 },
      });
    }

    /* 5. Run. */
    const words = countWords(safe);
    const tier: ComputeTier = body.tier ?? (mode === 'LEARN' && words > 8000 ? 'L3' : 'L2');
    const ctx = { ...defaultContext(body.surface ?? 'lens', tier), locale: dna.language };

    const result = await runTransform({
      mode,
      input: safe,
      dna,
      ctx,
      imageDataUrl: body.imageDataUrl,
      words,
    });

    /* 6. Rehydrate the redacted values into the output, then cache.
          The model never saw the real values; the user always does. */
    if (result.ok) {
      result.data = rehydrate(result.data, spans);
      result.meta = { ...result.meta, redactions: spans.length };
      await cache.set(key, { value: result, at: Date.now() });
    } else if (result.fallback) {
      result.fallback = rehydrate(result.fallback, spans);
    }

    return withCors(request, result);
  } catch (e) {
    // Never leak a stack trace to a client. Never return a bare 500 with no
    // artifact — Axiom 2 says the user always gets something.
    const error = isSetuError(e) ? { code: e.code, message: e.message, nextAction: e.nextAction } : toSetuError(e);
    return withCors(
      request,
      { ok: false, error, fallback: safeFallback(e) },
      { status: error.code === 'AUTH_REQUIRED' ? 401 : 500 },
    );
  }
}

function safeFallback(_e: unknown): TTransformArtifact | undefined {
  try {
    return deterministicFallback('START', '');
  } catch {
    return undefined;
  }
}
