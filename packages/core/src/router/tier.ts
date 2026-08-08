import { SetuError } from '../errors';
import type { ComputeTier, DNAProfile, Extracted, Mode } from '../types';

/**
 * THE COMPUTE LADDER (§13).
 *
 *  L0 DETERMINISTIC   0ms network · ₹0 · offline · private by construction
 *  L1 ON-DEVICE       ~300-900ms · ₹0 · offline after download · private
 *  L2 CLOUD FLASH     ~1-3s · free tier · needs consent
 *  L3 CLOUD PRO       ~4-12s · use sparingly · needs consent
 *
 * The honest version of the "zero-compute" claim: it is TRUE for L0 and false
 * for everything above it. L0 is what a user touches every second of every
 * session, which is why the claim is still the strongest thing in the deck —
 * stated precisely.
 */

/** Modes that pure code can satisfy completely. Never call a model for these. */
export const DETERMINISTIC: Mode[] = ['FOCUS'];

/** Modes small enough that Gemini Nano can hold the whole job. */
export const NANO_CAPABLE: Mode[] = ['EXPLAIN', 'WRITE', 'START'];

/** Above this word count, on-device is not a realistic option. */
export const NANO_WORD_CEILING = 1200;

/** Above this, a long-document synthesis model earns its latency. */
export const PRO_WORD_FLOOR = 8000;

export interface TierInputs {
  mode: Mode;
  dna: DNAProfile;
  ex?: Extracted;
  nanoAvailable: boolean;
  online: boolean;
  consentGranted: boolean;
  /** multimodal input cannot run on-device */
  hasImage?: boolean;
}

export interface TierDecision {
  tier: ComputeTier;
  reason: string;
}

export function chooseTier(i: TierInputs): TierDecision {
  // Rung 0: can pure code satisfy the contract?
  if (DETERMINISTIC.includes(i.mode)) return { tier: 'L0', reason: 'deterministic transform' };

  // Hard privacy wall: the user said never. This branch is above every other
  // consideration on purpose — no amount of "but it would work better" wins here.
  if (i.dna.privacy.cloudAI === 'never') {
    if (i.nanoAvailable && !i.hasImage) return { tier: 'L1', reason: 'user: on-device only' };
    throw new SetuError(
      'ON_DEVICE_UNAVAILABLE',
      'You chose on-device only, and this device has no local model available.',
    );
  }

  if (!i.online) {
    if (i.nanoAvailable && !i.hasImage) return { tier: 'L1', reason: 'offline' };
    throw new SetuError('OFFLINE', 'Offline — Focus Mode and saved items still work.');
  }

  const words = i.ex?.wordCount ?? 0;
  const small = words <= NANO_WORD_CEILING;

  if (i.nanoAvailable && small && !i.hasImage && NANO_CAPABLE.includes(i.mode))
    return { tier: 'L1', reason: 'fits on-device' };

  if (!i.consentGranted && i.dna.privacy.cloudAI === 'ask')
    throw new SetuError('CONSENT_REQUIRED', 'Cloud AI needs your OK for this one.');

  if (i.mode === 'LEARN' && words > PRO_WORD_FLOOR)
    return { tier: 'L3', reason: 'long document synthesis' };

  return { tier: 'L2', reason: 'default cloud flash' };
}

/**
 * The ladder as a UI string. Used by the consent dialog and the Trust Ledger,
 * so the user can see *why* a given rung was chosen — not just that it was.
 */
export function describeTier(t: ComputeTier): { label: string; detail: string; leftDevice: boolean } {
  switch (t) {
    case 'L0':
      return {
        label: 'On this device',
        detail: 'Pure code. No model, no network, no cost.',
        leftDevice: false,
      };
    case 'L1':
      return {
        label: 'On this device',
        detail: "Chrome's built-in model. Nothing left your computer.",
        leftDevice: false,
      };
    case 'L2':
      return { label: 'Cloud (fast)', detail: 'Redacted text sent to Gemini Flash.', leftDevice: true };
    case 'L3':
      return {
        label: 'Cloud (deep)',
        detail: 'Redacted text sent to a larger model for long-document work.',
        leftDevice: true,
      };
  }
}
