import {
  isSensitiveField,
  resolveElement,
  summariseDom,
  type TCommanderAction,
  type TCommanderPlan,
} from '@setu/core';
import { clearSpotlight, spotlight } from './overlays';

/**
 * COMMANDER — the executor (§22.2, §22.3).
 *
 * The model PLANS. The human CONFIRMS. The browser EXECUTES. Three separate
 * parties, and this file is only the third one. It receives an already-
 * confirmed plan and does the smallest possible thing with it.
 *
 * Safety rails enforced HERE, at execution time, on top of the ones enforced
 * at perception time in summariseDom():
 *
 *   1. Element ids are a closed set. An unresolvable id aborts the run.
 *   2. Sensitive fields are re-checked before every fill — perception-time
 *      filtering is the primary defence, this is the belt to its braces.
 *   3. Step budget of 6. Loops terminate.
 *   4. A structural DOM change mid-run stops execution and asks for a re-plan.
 *      That re-summarise step is what makes this an actual perceive-act-observe
 *      loop rather than a batch script.
 *   5. Esc aborts instantly, between any two steps.
 */

export const MAX_STEPS = 6;
const PAUSE_MS = 400;

export interface ExecutionReport {
  completed: number;
  total: number;
  stoppedBecause: 'done' | 'aborted' | 'element-missing' | 'page-changed' | 'blocked' | 'budget';
  detail?: string;
}

let abort = false;

export function abortExecution(): void {
  abort = true;
}

export async function executePlan(plan: TCommanderPlan): Promise<ExecutionReport> {
  abort = false;
  const actions = plan.actions.slice(0, MAX_STEPS);

  if (plan.actions.length > MAX_STEPS) {
    // Never silently truncate a plan the user confirmed. Refuse the whole run.
    return {
      completed: 0,
      total: plan.actions.length,
      stoppedBecause: 'budget',
      detail: `That plan had ${plan.actions.length} steps. SETU runs at most ${MAX_STEPS} at a time.`,
    };
  }

  const escape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') abort = true;
  };
  document.addEventListener('keydown', escape, true);

  let fingerprint = structuralFingerprint();
  let completed = 0;

  try {
    for (const action of actions) {
      if (abort) return report(completed, actions.length, 'aborted');

      const el = resolveElement(action.elementId);
      if (!el) {
        return report(
          completed,
          actions.length,
          'element-missing',
          `"${action.targetHint}" is no longer on this page. Nothing further was changed.`,
        );
      }

      if ((action.op === 'fill' || action.op === 'select') && isSensitiveField(el)) {
        return report(
          completed,
          actions.length,
          'blocked',
          'That field holds a password, one-time code or payment detail. Please type it yourself.',
        );
      }

      // Show the user exactly what is about to happen, then pause so they can
      // watch it and stop it. The pause is a feature, not a limitation.
      spotlight(el, `${completed + 1}/${actions.length} · ${action.targetHint}`);
      await sleep(PAUSE_MS);
      if (abort) return report(completed, actions.length, 'aborted');

      await perform(action, el);
      completed++;

      await sleep(PAUSE_MS);

      // Observe. If the page restructured, the remaining ids may now point at
      // different things — so we stop rather than guess.
      const next = structuralFingerprint();
      if (next !== fingerprint && completed < actions.length) {
        return report(
          completed,
          actions.length,
          'page-changed',
          'The page changed after that step. SETU stopped so it can look again.',
        );
      }
      fingerprint = next;
    }

    return report(completed, actions.length, 'done');
  } finally {
    document.removeEventListener('keydown', escape, true);
    clearSpotlight();
  }
}

async function perform(action: TCommanderAction, el: HTMLElement): Promise<void> {
  switch (action.op) {
    case 'scrollTo':
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;

    case 'focus':
      el.focus();
      return;

    case 'click':
      el.focus();
      el.click();
      return;

    case 'fill': {
      const value = action.value ?? '';
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        // Use the native setter so React/Vue controlled inputs actually see it.
        // Assigning .value directly is the classic reason "it filled but the
        // form still says the field is empty".
        setNativeValue(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      return;
    }

    case 'select': {
      if (el instanceof HTMLSelectElement && action.value) {
        const match =
          Array.from(el.options).find((o) => o.value === action.value) ??
          Array.from(el.options).find(
            (o) => o.textContent?.trim().toLowerCase() === action.value?.trim().toLowerCase(),
          );
        if (match) {
          el.value = match.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return;
    }

    case 'submit': {
      const form = el.closest('form');
      if (form) form.requestSubmit(el instanceof HTMLButtonElement ? el : undefined);
      else el.click();
      return;
    }

    case 'navigate':
      if (el instanceof HTMLAnchorElement) el.click();
      return;
  }
}

/**
 * A cheap structural signature. Counting interactive elements and landmarks
 * catches route changes and modal opens without the cost of diffing the tree.
 */
function structuralFingerprint(): string {
  const counts = [
    document.querySelectorAll('form').length,
    document.querySelectorAll('input,select,textarea').length,
    document.querySelectorAll('button,a[href]').length,
    document.querySelectorAll('[role="dialog"],dialog[open]').length,
  ];
  return `${location.pathname}|${counts.join(',')}`;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function report(
  completed: number,
  total: number,
  stoppedBecause: ExecutionReport['stoppedBecause'],
  detail?: string,
): ExecutionReport {
  return { completed, total, stoppedBecause, ...(detail ? { detail } : {}) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Re-perceive. Called before planning, and again after a page-changed stop. */
export function perceive() {
  return summariseDom(document);
}
