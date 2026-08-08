import type { NextRequest } from 'next/server';
import { SETU_VERSION } from '@setu/core';
import { availableProviders, env } from '@/server/env';
import { preflight, withCors } from '@/server/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

/**
 * Deliberately reveals capability, never configuration. It says WHICH
 * providers are wired up so the extension's Settings page can tell the user
 * something useful — and says nothing at all about keys, model versions in
 * use, or the auth backend's address.
 */
export async function GET(request: NextRequest) {
  const providers = availableProviders();
  return withCors(request, {
    ok: true,
    service: 'setu-edge',
    version: SETU_VERSION,
    providers,
    authMode: env.authMode,
    degraded: providers.length === 0,
    note:
      providers.length === 0
        ? 'No AI engine configured. Focus Mode, bionic reading, the load score and the pause offer all still work — they never needed one.'
        : undefined,
  });
}
