import { NoObjectGeneratedError, generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import {
  REPAIR_SUFFIX,
  SCHEMA_BY_MODE,
  buildSystem,
  deterministicFallback,
  toSetuError,
  truncateToWords,
  type Context,
  type ComputeTier,
  type DNAProfile,
  type Mode,
  type Result,
  type TTransformArtifact,
} from '@setu/core';
import { env } from './env';

/**
 * Stage 4 — TRANSFORM (§21.1).
 *
 * The rules that make the demo unbreakable:
 *   1. Validate against the schema. Nothing unvalidated ever leaves here.
 *   2. On a schema miss, one repair prompt at the same rung.
 *   3. Then the next rung down (cheaper model).
 *   4. Then the deterministic fallback, which cannot fail.
 *
 * The user never gets a dead end. The worst case is a less clever result.
 */

const google = env.googleKey
  ? createGoogleGenerativeAI({ apiKey: env.googleKey })
  : null;
const groq = env.groqKey ? createGroq({ apiKey: env.groqKey }) : null;

interface Rung {
  id: string;
  provider: 'google' | 'groq';
  build: () => ReturnType<NonNullable<typeof google>> | ReturnType<NonNullable<typeof groq>>;
  maxWords: number;
  /** multimodal capable */
  vision: boolean;
}

function chain(tier: ComputeTier): Rung[] {
  const rungs: Rung[] = [];

  if (google) {
    // L3 asks for the deep model first; everything else starts at flash.
    if (tier === 'L3')
      rungs.push({
        id: env.modelPro,
        provider: 'google',
        build: () => google(env.modelPro),
        maxWords: 120_000,
        vision: true,
      });

    rungs.push({
      id: env.modelFlash,
      provider: 'google',
      build: () => google(env.modelFlash),
      maxWords: 30_000,
      vision: true,
    });
    rungs.push({
      id: env.modelFlashLite,
      provider: 'google',
      build: () => google(env.modelFlashLite),
      maxWords: 12_000,
      vision: true,
    });
  }

  if (groq)
    rungs.push({
      id: env.modelGroq,
      provider: 'groq',
      build: () => groq(env.modelGroq),
      maxWords: 8_000,
      vision: false,
    });

  return rungs;
}

export interface RunOptions {
  mode: Mode;
  input: string;
  dna: DNAProfile;
  ctx: Context;
  imageDataUrl?: string;
  /** override; otherwise derived from input */
  words?: number;
}

export async function runTransform(opts: RunOptions): Promise<Result<TTransformArtifact>> {
  const schema = SCHEMA_BY_MODE[opts.mode];
  const system = buildSystem(opts.mode, opts.dna, opts.ctx);
  const words = opts.words ?? countWords(opts.input);
  const started = Date.now();
  const hasImage = !!opts.imageDataUrl;

  const rungs = chain(opts.ctx.tier).filter((r) => (hasImage ? r.vision : true));

  if (!rungs.length) {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_FAILED',
        message: 'No AI engine is configured on this SETU server.',
        nextAction: 'Set GOOGLE_GENERATIVE_AI_API_KEY, or keep using the offline features.',
      },
      fallback: deterministicFallback(opts.mode, opts.input),
    };
  }

  let lastErr: unknown = null;

  for (const rung of rungs) {
    // Rather than skipping a rung whose window is too small, truncate to it.
    // A slightly shorter input beats no answer, and §25.2 lists truncation as
    // the single biggest cost lever on LEARN anyway.
    const input = words > rung.maxWords ? truncateToWords(opts.input, rung.maxWords) : opts.input;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { object, usage } = await generateObject({
          model: rung.build(),
          schema,
          system: attempt === 0 ? system : system + REPAIR_SUFFIX,
          ...promptFor(input, opts.imageDataUrl),
          // §18.1 — determinism is an ACCESSIBILITY requirement, not a
          // technical convenience. For a user with ADHD or autism,
          // unpredictability is itself a cognitive load: an interface that
          // behaves differently each time forces re-learning on every use.
          // PRACTICE is the one mode where variation is the point.
          temperature: opts.mode === 'PRACTICE' ? 0.7 : 0.2,
          maxRetries: 0, // we own the retry policy
          abortSignal: AbortSignal.timeout(opts.ctx.tier === 'L3' ? 25_000 : 12_000),
        });

        return {
          ok: true,
          data: object as TTransformArtifact,
          meta: {
            tier: opts.ctx.tier,
            model: rung.id,
            latencyMs: Date.now() - started,
            cached: false,
            tokensIn: usage?.inputTokens,
            tokensOut: usage?.outputTokens,
            leftDevice: true,
            bytesSent: input.length,
          },
        };
      } catch (e) {
        lastErr = e;
        // A schema miss is worth one repair at the SAME rung: the model
        // understood the task and got the shape wrong.
        if (NoObjectGeneratedError.isInstance(e) && attempt === 0) continue;
        break; // provider error, or the repair also failed → next rung
      }
    }
  }

  return {
    ok: false,
    error: toSetuError(lastErr),
    fallback: deterministicFallback(opts.mode, opts.input),
    meta: {
      tier: opts.ctx.tier,
      latencyMs: Date.now() - started,
      cached: false,
      leftDevice: true,
    },
  };
}

/** Text-only or multimodal, in the shape generateObject expects. */
function promptFor(input: string, imageDataUrl?: string) {
  if (!imageDataUrl) return { prompt: input };
  return {
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: input },
          { type: 'image' as const, image: imageDataUrl },
        ],
      },
    ],
  };
}

export function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}
