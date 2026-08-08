import type { NextRequest } from 'next/server';
import { defaultContext, isSetuError, normaliseDNA, toSetuError, type DomSummary } from '@setu/core';
import { planCommand } from '@/server/commander';
import { checkConsent, identify, rateLimit } from '@/server/guards';
import { preflight, withCors } from '@/server/cors';

/**
 * /api/commander — the agent's planning endpoint.
 *
 * It returns a PLAN. It never returns an instruction that has been carried
 * out, because this service cannot carry anything out: the model plans, the
 * human confirms in the page, and the browser executes. Three separate parties,
 * and this endpoint is only the first.
 */

export const runtime = 'nodejs';
export const maxDuration = 20;

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  try {
    const identity = await identify(request);
    const rl = rateLimit(identity);
    if (!rl.ok)
      return withCors(
        request,
        {
          ok: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Too many requests just now.',
            nextAction: 'Wait a moment. Nothing was changed on the page.',
          },
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
      );

    const body = (await request.json()) as {
      utterance?: string;
      dom?: DomSummary;
      dna?: unknown;
      surface?: 'lens' | 'sanctuary' | 'go';
      consent?: boolean;
    };

    const utterance = (body.utterance ?? '').trim();
    if (!utterance)
      return withCors(
        request,
        {
          ok: false,
          error: {
            code: 'NO_CONTENT',
            message: 'Nothing was said.',
            nextAction: 'Describe one thing to do on this page.',
          },
        },
        { status: 400 },
      );

    if (!body.dom?.elements)
      return withCors(
        request,
        {
          ok: false,
          error: {
            code: 'NO_CONTENT',
            message: 'SETU could not see this page.',
            nextAction: 'Open a normal web page and grant SETU access to it.',
          },
        },
        { status: 400 },
      );

    const dna = normaliseDNA(body.dna);

    // COMMANDER always needs cloud consent — there is no on-device planner.
    if (!checkConsent(dna, body.consent !== false))
      return withCors(
        request,
        {
          ok: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message: 'Planning actions needs cloud AI, which you have turned off.',
            nextAction: 'Change this in Settings, or do the steps yourself.',
          },
        },
        { status: 428 },
      );

    const result = await planCommand({
      utterance,
      dom: body.dom,
      dna,
      ctx: { ...defaultContext(body.surface ?? 'lens', 'L2'), locale: dna.language },
    });

    return withCors(request, result);
  } catch (e) {
    const error = isSetuError(e)
      ? { code: e.code, message: e.message, nextAction: e.nextAction }
      : toSetuError(e);
    return withCors(request, { ok: false, error }, { status: 500 });
  }
}
