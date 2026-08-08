import type { NextRequest } from 'next/server';
import { toSetuError, type LedgerEntry } from '@setu/core';
import { identify, rateLimit } from '@/server/guards';
import { preflight, withCors } from '@/server/cors';

/**
 * /api/ledger — server-side mirror of the Trust Ledger.
 *
 * The extension's ledger is authoritative and lives on the device; this
 * endpoint exists so the same log is visible from Sanctuary and Go once those
 * surfaces land.
 *
 * Until the Supabase tables are wired, entries are accepted and acknowledged
 * but not persisted. That is stated here rather than silently pretended:
 * a ledger that quietly drops rows would undermine the exact property it
 * exists to demonstrate.
 */

export const runtime = 'nodejs';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  try {
    const identity = await identify(request);
    const rl = rateLimit(identity);
    if (!rl.ok) return withCors(request, { ok: false, error: { code: 'RATE_LIMIT' } }, { status: 429 });

    const body = (await request.json()) as { entries?: LedgerEntry[] };
    const count = body.entries?.length ?? 0;

    // TODO(sanctuary): insert into public.ledger with the user's RLS context.
    return withCors(request, {
      ok: true,
      accepted: count,
      persisted: 0,
      note: 'Server-side ledger storage lands with Sanctuary. Your device copy is complete and authoritative.',
    });
  } catch (e) {
    return withCors(request, { ok: false, error: toSetuError(e) }, { status: 500 });
  }
}
