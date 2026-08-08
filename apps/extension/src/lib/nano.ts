import { zodToJsonSchema } from './jsonschema';
import { SCHEMA_BY_MODE, type Mode } from '@setu/core';

/**
 * L1 — ON-DEVICE, via the Chrome Prompt API (§35.3).
 *
 * ⚠️ FEATURE-DETECT, ALWAYS. The Prompt API needs roughly 22GB free disk,
 * >4GB VRAM or 16GB RAM with 4+ cores, and a ~2GB model download.
 *
 *   ASSUME THE JUDGE'S LAPTOP DOES NOT QUALIFY.
 *
 * L1 is a bonus rung that makes the architecture story excellent; L2 is what
 * will actually run on stage. Never build a demo step that REQUIRES L1 — but
 * absolutely mention it, and if it works on your machine, show it with the
 * wifi off. That is a showstopper moment.
 */

interface LanguageModelSession {
  prompt(input: string, opts?: { responseConstraint?: unknown }): Promise<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts: {
    initialPrompts?: Array<{ role: string; content: string }>;
    temperature?: number;
    topK?: number;
    monitor?: (m: EventTarget) => void;
  }): Promise<LanguageModelSession>;
}

function api(): LanguageModelStatic | null {
  const g = globalThis as Record<string, unknown>;
  const lm = g.LanguageModel as LanguageModelStatic | undefined;
  return lm && typeof lm.availability === 'function' ? lm : null;
}

let cached: { at: number; value: boolean } | null = null;

export async function nanoAvailable(): Promise<boolean> {
  // Availability can change (model downloads in the background), but probing
  // it on every keystroke is wasteful. 60s is a reasonable middle.
  if (cached && Date.now() - cached.at < 60_000) return cached.value;

  let value = false;
  try {
    const lm = api();
    if (lm) {
      const a = await lm.availability();
      value = a === 'available' || a === 'downloadable';
    }
  } catch {
    value = false;
  }
  cached = { at: Date.now(), value };
  return value;
}

export async function nanoStatus(): Promise<string> {
  try {
    const lm = api();
    if (!lm) return 'not supported in this browser';
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

export interface NanoArgs {
  mode: Mode;
  input: string;
  system: string;
}

export interface NanoResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
}

export async function nanoPrompt({ mode, input, system }: NanoArgs): Promise<NanoResult> {
  const started = Date.now();
  const lm = api();
  if (!lm) return { ok: false, error: 'No on-device model.', latencyMs: 0 };

  let session: LanguageModelSession | null = null;
  try {
    session = await lm.create({
      initialPrompts: [{ role: 'system', content: system }],
      temperature: 0.2,
      topK: 3,
    });

    // responseConstraint takes a JSON Schema — the SAME contract as the cloud
    // path. One schema, two rungs. That is the point of the Contract Layer.
    const schema = zodToJsonSchema(SCHEMA_BY_MODE[mode]);
    const text = await session.prompt(input, { responseConstraint: schema });

    const parsed = JSON.parse(stripFences(text));
    const validated = SCHEMA_BY_MODE[mode].safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        error: 'On-device output did not match the contract.',
        latencyMs: Date.now() - started,
      };
    }

    return { ok: true, data: validated.data, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'On-device model failed.',
      latencyMs: Date.now() - started,
    };
  } finally {
    try {
      session?.destroy();
    } catch {
      /* the session is already gone */
    }
  }
}

/** Small models sometimes wrap JSON in fences despite the constraint. */
function stripFences(s: string): string {
  const t = s.trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}
