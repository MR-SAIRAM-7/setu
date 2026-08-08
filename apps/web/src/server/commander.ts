import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  CommanderPlan,
  buildSystem,
  renderDomSummary,
  toSetuError,
  type Context,
  type DNAProfile,
  type DomSummary,
  type Result,
  type TCommanderPlan,
} from '@setu/core';
import { env } from './env';

/**
 * THE AGENT (§22).
 *
 * This is the ONLY component in SETU that is a true agent: it has a bounded
 * tool set (seven ops), a perceive-act-observe loop (the observe half lives in
 * the content script and calls back here on a structural change), a step
 * budget, and a human confirmation gate before any state-changing action.
 *
 * Everything else in the product is a single-shot transformer or a retrieval
 * pipeline, and being precise about that distinction is a scoring advantage:
 * the wrong answer to "is this really agentic?" is "yes, it's all agentic."
 *
 * THE CORE SAFETY IDEA, which is worth saying out loud:
 *   The model can only reference element ids that appear in the summary WE
 *   generated. It cannot invent `e57` if `e57` was never there, and if it
 *   tries, lookup fails safely and we refuse the whole plan.
 *   Constrain the action space by construction, not by hope.
 */

const google = env.googleKey ? createGoogleGenerativeAI({ apiKey: env.googleKey }) : null;

const MAX_STEPS = 6;

export async function planCommand(opts: {
  utterance: string;
  dom: DomSummary;
  dna: DNAProfile;
  ctx: Context;
}): Promise<Result<TCommanderPlan>> {
  const started = Date.now();

  if (!google) {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_FAILED',
        message: 'No planner is configured on this SETU server.',
        nextAction: 'Nothing was changed on the page.',
      },
    };
  }

  if (!opts.dom.elements.length) {
    return {
      ok: true,
      data: {
        mode: 'COMMANDER',
        understood: opts.utterance,
        actions: [],
        needsConfirmation: false,
        cannotDo: 'There are no controls on this page that SETU can operate.',
      },
      meta: { tier: 'L0', latencyMs: 0, cached: false, leftDevice: false },
    };
  }

  try {
    const { object, usage } = await generateObject({
      model: google(env.modelFlash),
      schema: CommanderPlan,
      system: buildSystem('COMMANDER', opts.dna, opts.ctx),
      prompt: [
        `USER SAID: "${opts.utterance}"`,
        ``,
        `PAGE: ${opts.dom.title} — ${opts.dom.url}`,
        opts.dom.withheld > 0
          ? `NOTE: ${opts.dom.withheld} field(s) on this page hold passwords, one-time codes or payment details. They were removed before you saw this list and you cannot act on them.`
          : '',
        ``,
        `ELEMENTS (you may ONLY reference these ids):`,
        renderDomSummary(opts.dom),
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.1,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(12_000),
    });

    const plan = harden(object, opts.dom);

    return {
      ok: true,
      data: plan,
      meta: {
        tier: 'L2',
        model: env.modelFlash,
        latencyMs: Date.now() - started,
        cached: false,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        leftDevice: true,
        bytesSent: opts.utterance.length + JSON.stringify(opts.dom.elements).length,
      },
    };
  } catch (e) {
    return { ok: false, error: toSetuError(e) };
  }
}

/**
 * Server-side hardening. Everything here is re-checked in the content script
 * before execution — this is the first of two independent gates, not the only
 * one, because a single check is a check that can be bypassed.
 */
export function harden(plan: TCommanderPlan, dom: DomSummary): TCommanderPlan {
  const known = new Set(dom.elements.map((e) => e.id));

  // Rail 2: a single invented id invalidates the ENTIRE plan. We do not
  // silently drop the bad action and run the rest — a plan built on a
  // hallucinated element is a plan whose intent we no longer understand.
  const invented = plan.actions.filter((a) => !known.has(a.elementId));
  if (invented.length) {
    return {
      ...plan,
      actions: [],
      needsConfirmation: false,
      cannotDo: 'I could not find those controls on this page.',
    };
  }

  // Rail 5: step budget. Loops terminate.
  if (plan.actions.length > MAX_STEPS) {
    return {
      ...plan,
      actions: [],
      needsConfirmation: false,
      cannotDo: `That needs ${plan.actions.length} steps. SETU does at most ${MAX_STEPS} at a time — try asking for the first part.`,
    };
  }

  // Risk is not something the model gets the last word on. Anything that
  // submits, pays, deletes or sends is at minimum "writes-data", whatever the
  // model claimed.
  const actions = plan.actions.map((a) => {
    let risk = a.risk;
    if (a.op === 'submit') risk = risk === 'irreversible' ? 'irreversible' : 'writes-data';
    if (a.op === 'fill' || a.op === 'select') risk = risk === 'safe' ? 'writes-data' : risk;

    const target = dom.elements.find((e) => e.id === a.elementId);
    if (target && /pay|delete|remove|withdraw|cancel|submit|confirm|send/i.test(target.name))
      risk = risk === 'safe' ? 'writes-data' : risk;

    return { ...a, risk };
  });

  return {
    ...plan,
    actions,
    // Rail 1: force confirmation for anything that is not purely navigational.
    needsConfirmation: actions.some((a) => a.risk !== 'safe'),
  };
}
