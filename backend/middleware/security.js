/**
 * Security middleware.
 *
 * Deliberately dependency-free: SETU has to be deployable from a clone with no
 * network access to a registry, so the handful of headers and the rate limiter
 * we actually need are implemented here rather than pulling in helmet and
 * express-rate-limit.
 */

const config = require('../config');

/**
 * Baseline response headers.
 *
 * No CSP is set here. The API serves JSON to a separate origin and, in the
 * single-service deploy, the built SPA — a CSP tight enough to matter would
 * have to be authored against the actual bundle, and a loose one is theatre.
 */
function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Only meaningful over TLS; harmless otherwise, and correct once deployed.
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * Scoped per process, which is the right shape for a single-instance deploy.
 * Behind multiple instances this becomes per-instance rather than global —
 * acceptable, because its job is to stop one client burning the AI quota, not
 * to enforce billing.
 */
function createRateLimiter({ windowMs, max, message, keyPrefix = '' }) {
  const hits = new Map();

  // Drop expired buckets periodically so the map cannot grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60000));
  sweep.unref?.();

  return function rateLimit(req, res, next) {
    // Identity first so one shared NAT address cannot lock out every user.
    const identity =
      req.headers['x-user-id'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${keyPrefix}:${identity}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || `Too many requests. Try again in ${retryAfter} seconds.`,
        retryAfterSeconds: retryAfter
      });
    }

    return next();
  };
}

module.exports = { securityHeaders, createRateLimiter };
