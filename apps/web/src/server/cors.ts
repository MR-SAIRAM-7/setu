import { NextResponse } from 'next/server';
import { env } from './env';

/**
 * CORS against an allowlist, never '*'.
 *
 * §43.1: "Do not use * for the CORS origin. Judges who look will notice, and it
 * is a genuine hole — your API would be usable by any page on the internet."
 *
 * In development we permit any chrome-extension:// origin, because the
 * extension ID changes every time you reload unpacked and hard-coding it would
 * mean editing an env var twenty times a day. In production the allowlist is
 * required and an unlisted origin gets no CORS header at all.
 */
export function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  if (origin.startsWith('chrome-extension://')) {
    const id = origin.slice('chrome-extension://'.length);
    if (env.allowedExtensionIds.includes(id)) return origin;
    // Dev convenience only. This branch must never be reachable in production.
    if (env.isDev) return origin;
    return null;
  }

  // Same-origin requests from Sanctuary itself carry an Origin header too.
  if (env.supabaseUrl && origin === env.supabaseUrl) return origin;

  return null;
}

export function withCors<T>(request: Request, body: T, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(body, init);
  const origin = resolveOrigin(request);
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  res.headers.set('Vary', 'Origin');
  return res;
}

/** Every route that the extension calls needs this. */
export function preflight(request: Request): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  const origin = resolveOrigin(request);
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  res.headers.set(
    'Access-Control-Allow-Headers',
    'authorization,content-type,idempotency-key,x-setu-surface,x-setu-client',
  );
  res.headers.set('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.headers.set('Vary', 'Origin');
  return res;
}
