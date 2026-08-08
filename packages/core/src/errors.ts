import type { SerializedError } from './types';

/**
 * Every error carries a `nextAction`. Appendix B rule: "Every error names a
 * next action." A SetuError with no next action is a bug, not an error.
 */
export type SetuErrorCode =
  | 'ON_DEVICE_UNAVAILABLE'
  | 'OFFLINE'
  | 'CONSENT_REQUIRED'
  | 'RATE_LIMIT'
  | 'SCHEMA_INVALID'
  | 'PROVIDER_FAILED'
  | 'TIMEOUT'
  | 'UNSUPPORTED_MODE'
  | 'NO_CONTENT'
  | 'AUTH_REQUIRED'
  | 'VAULT_LOCKED'
  | 'PLAN_REJECTED'
  | 'UNKNOWN';

const NEXT_ACTION: Record<SetuErrorCode, string> = {
  ON_DEVICE_UNAVAILABLE: 'Turn on cloud AI in Settings, or use Focus Mode which works offline.',
  OFFLINE: 'Focus Mode, bionic reading and saved items still work.',
  CONSENT_REQUIRED: 'Review what will be sent, then choose Allow once or Always.',
  RATE_LIMIT: 'Wait a moment and try again.',
  SCHEMA_INVALID: 'We used a simpler result instead.',
  PROVIDER_FAILED: 'We tried another engine. If this keeps happening, try again later.',
  TIMEOUT: 'The engine took too long. Try again, or use the on-device option.',
  UNSUPPORTED_MODE: 'That mode is not available on this surface yet.',
  NO_CONTENT: 'Select some text or open a page with readable content first.',
  AUTH_REQUIRED: 'Sign in on the SETU website, then reopen this panel.',
  VAULT_LOCKED: 'Enter your vault passphrase to read this.',
  PLAN_REJECTED: 'The plan referenced controls that are not on this page. Try rephrasing.',
  UNKNOWN: 'Try again. If it keeps happening, reload the page.',
};

export class SetuError extends Error {
  readonly code: SetuErrorCode;
  readonly nextAction: string;

  constructor(code: SetuErrorCode, message: string, nextAction?: string) {
    super(message);
    this.name = 'SetuError';
    this.code = code;
    this.nextAction = nextAction ?? NEXT_ACTION[code];
  }

  toJSON(): SerializedError {
    return { code: this.code, message: this.message, nextAction: this.nextAction };
  }
}

export function isSetuError(e: unknown): e is SetuError {
  return e instanceof SetuError || (typeof e === 'object' && e !== null && 'code' in e && 'nextAction' in e);
}

/** Never let a raw provider error reach a user. Always translate. */
export function toSetuError(e: unknown): SerializedError {
  if (isSetuError(e)) return { code: e.code, message: e.message, nextAction: e.nextAction };

  const msg = e instanceof Error ? e.message : String(e);

  if (/abort|timeout|timed out/i.test(msg))
    return new SetuError('TIMEOUT', 'The engine took too long to answer.').toJSON();
  if (/429|rate.?limit|quota|resource_exhausted/i.test(msg))
    return new SetuError('RATE_LIMIT', 'We are sending too many requests right now.').toJSON();
  if (/401|403|unauthor|permission|api key/i.test(msg))
    return new SetuError('AUTH_REQUIRED', 'We could not authenticate that request.').toJSON();
  if (/no object generated|schema|parse|validation/i.test(msg))
    return new SetuError('SCHEMA_INVALID', 'The engine returned something we could not use.').toJSON();

  return new SetuError('PROVIDER_FAILED', 'That did not work.').toJSON();
}
