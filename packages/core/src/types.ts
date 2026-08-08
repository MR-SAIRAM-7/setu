/**
 * The five kernel types (§6.1).
 *
 * Appendix E note, obeyed here: `ComputeTier` is DECLARED in this file and
 * imported by `router/tier.ts`. Declaring it in tier.ts creates a circular
 * import that TypeScript resolves inconsistently across bundlers.
 */

/* ── The compute ladder (§13) ─────────────────────────────────────────────── */

export type ComputeTier = 'L0' | 'L1' | 'L2' | 'L3';

/* ── What we are transforming. Everything becomes one of these. ───────────── */

export type Artifact =
  | { kind: 'page'; url: string; title: string; html: string; text: string }
  | { kind: 'selection'; url: string; text: string; contextBefore?: string }
  | { kind: 'document'; name: string; mime: string; text: string; pages?: number }
  | { kind: 'transcript'; title: string; text: string; speakers?: string[] }
  | { kind: 'task'; text: string; deadline?: string }
  | { kind: 'image'; dataUrl: string; alt?: string; nearbyText?: string }
  | { kind: 'ui'; url: string; domSummary: DomSummary };

export type ArtifactKind = Artifact['kind'];

export type Mode =
  | 'FOCUS'
  | 'START'
  | 'LEARN'
  | 'MEET'
  | 'EXPLAIN'
  | 'WRITE'
  | 'PRACTICE'
  | 'GUIDE'
  | 'COMMANDER';

export const ALL_MODES: readonly Mode[] = [
  'FOCUS',
  'START',
  'LEARN',
  'MEET',
  'EXPLAIN',
  'WRITE',
  'PRACTICE',
  'GUIDE',
  'COMMANDER',
] as const;

/* ── The user's self-authored adaptation profile. Never a diagnosis. ──────── */

export type ReadingLevel = 'simple' | 'plain' | 'standard' | 'technical';
export type Tone = 'warm' | 'neutral' | 'direct';
export type Intensity = 0 | 1 | 2 | 3;

export interface DNAProfile {
  readingLevel: ReadingLevel;
  /** BCP-47, e.g. 'hi-IN', 'ta-IN', 'en-IN' */
  language: string;
  bionic: { enabled: boolean; intensity: Intensity };
  lineGuide: boolean;
  motion: 'full' | 'reduced' | 'none';
  density: 'comfortable' | 'calm' | 'minimal';
  /** max steps shown at once */
  chunkSize: 3 | 5 | 7;
  tone: Tone;
  breathe: { enabled: boolean; sensitivity: Intensity };
  ttsVoice?: string;
  fontStack: 'system' | 'atkinson' | 'lexend' | 'opendyslexic';
  privacy: { cloudAI: 'ask' | 'allow' | 'never'; vaultSync: boolean };
}

/**
 * Axiom 4 in defaults: nothing is inferred, cloud AI is opt-in per use,
 * Breathe is ON but at low sensitivity, bionic is OFF (§34.2 caveat).
 */
export const DEFAULT_DNA: DNAProfile = {
  readingLevel: 'plain',
  language: 'en-IN',
  bionic: { enabled: false, intensity: 2 },
  lineGuide: false,
  motion: 'reduced',
  density: 'calm',
  chunkSize: 5,
  tone: 'warm',
  breathe: { enabled: true, sensitivity: 2 },
  fontStack: 'system',
  privacy: { cloudAI: 'ask', vaultSync: false },
};

/* ── Context assembled by the router ──────────────────────────────────────── */

export type Surface = 'lens' | 'sanctuary' | 'go';

export interface VaultChunk {
  id: string;
  text: string;
  occurredAt: string;
  similarity?: number;
}

export interface Context {
  /** resolved by the router, see §13 */
  tier: ComputeTier;
  /** retrieved memory, if any */
  vaultHits?: VaultChunk[];
  locale: string;
  /** ISO timestamp */
  now: string;
  surface: Surface;
}

export function defaultContext(surface: Surface, tier: ComputeTier = 'L2'): Context {
  return { tier, locale: 'en-IN', now: new Date().toISOString(), surface };
}

/* ── Results ──────────────────────────────────────────────────────────────── */

export interface ResultMeta {
  /** which rung of the ladder actually served this */
  tier: ComputeTier;
  model?: string;
  latencyMs: number;
  cached: boolean;
  tokensIn?: number;
  tokensOut?: number;
  /** Cognitive Load Score, §42.1 */
  loadBefore?: number;
  loadAfter?: number;
  /**
   * Drives the Trust Ledger (§42.3). Present on EVERY result, without exception.
   * Retrofitting this field is painful — it is why the ledger is possible at all.
   */
  leftDevice: boolean;
  /** how many PII spans were redacted before the payload left the device */
  redactions?: number;
  bytesSent?: number;
}

export type Result<T> =
  | { ok: true; data: T; meta: ResultMeta }
  | { ok: false; error: SerializedError; fallback?: T; meta?: ResultMeta };

export interface SerializedError {
  code: string;
  message: string;
  /** what the user can do about it — never a stack trace */
  nextAction?: string;
}

/* ── DOM summary — the agent's perception (§22.1) ─────────────────────────── */

export interface DomEl {
  /** 'e12' — our handle, mapped to a real node in a local WeakMap */
  id: string;
  /** button | link | textbox | checkbox | select | heading | region */
  role: string;
  /** accessible name (aria-label, label, placeholder, or text) */
  name: string;
  value?: string;
  type?: string;
  required?: boolean;
  visible: boolean;
  /** nearest landmark or heading, for spatial grounding */
  section?: string;
}

export interface DomSummary {
  url: string;
  title: string;
  elements: DomEl[];
  /** elements deliberately withheld from the model (password/OTP/payment) */
  withheld: number;
}

/* ── Extraction output (§12.2) ────────────────────────────────────────────── */

export interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'quote' | 'code' | 'table' | 'figure';
  text: string;
  items?: string[];
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  label: string;
}

export interface PIISpan {
  start: number;
  end: number;
  kind: PIIKind;
  placeholder: string;
  original: string;
}

export type PIIKind =
  | 'EMAIL'
  | 'PHONE'
  | 'AADHAAR'
  | 'PAN'
  | 'CARD'
  | 'IBAN'
  | 'DOB'
  | 'PIN'
  | 'URL_TOKEN';

export interface CLSComponents {
  structural: number;
  textual: number;
  visual: number;
  motion: number;
  decision: number;
  interruption: number;
}

export interface CLSBreakdown {
  /** 0 (calm) .. 100 (overwhelming) */
  score: number;
  components: CLSComponents;
  /** human-readable, for the UI */
  topContributors: string[];
  computedInMs: number;
}

export interface Extracted {
  title: string;
  /** clean, ordered, semantic */
  text: string;
  blocks: Block[];
  lang: string;
  wordCount: number;
  /** Flesch-Kincaid */
  readingGrade: number;
  cls: CLSBreakdown;
  /** for START / COMMANDER / CHUNK */
  interactive: FormField[];
  hasMotion: boolean;
  /** detected client-side, redacted before any cloud call */
  piiSpans: PIISpan[];
}
