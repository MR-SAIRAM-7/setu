import { useEffect, useState, type ReactNode } from 'react';
import {
  describeCLS,
  describeTier,
  summariseRedactions,
  type CLSBreakdown,
  type ComputeTier,
  type PIISpan,
  type TMicroStep,
} from '@setu/core';

/**
 * Shared renderers. Stage 5 — PRESENT (§12.5).
 *
 * Renderers are DUMB. They take validated data and produce accessible DOM.
 * No renderer is allowed to contain a try/catch around a missing field: if the
 * data reached a renderer, it is valid by construction, because it came
 * through the Contract Layer.
 */

/* ── the Cognitive Load Score meter ───────────────────────────────────────── */

export function CLSMeter({ cls, label }: { cls: CLSBreakdown; label?: string }) {
  const band = cls.score >= 70 ? 'hot' : cls.score >= 40 ? 'mid' : 'calm';

  return (
    <div className={`cls cls--${band}`}>
      <div className="cls__num" aria-hidden="true">
        {cls.score}
      </div>
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block' }}>{label ?? 'Load score'}</strong>
        <span className="muted">{describeCLS(cls)}</span>
        <div className="cls__bar">
          <div className="cls__fill" style={{ width: `${cls.score}%` }} />
        </div>
        {/* The number is announced in words, not left as a bare digit in a div. */}
        <span className="sr">
          Cognitive load score {cls.score} out of 100. {describeCLS(cls)} Computed on this device in{' '}
          {cls.computedInMs} milliseconds.
        </span>
      </div>
    </div>
  );
}

export function CLSDelta({ before, after }: { before: number; after: number }) {
  const drop = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  return (
    <div className="banner banner--calm" role="status">
      <strong>
        Load score {before} → {after}
      </strong>
      {drop > 0 && <> — a {drop}% reduction, computed on this machine with no network call.</>}
    </div>
  );
}

/* ── steps ────────────────────────────────────────────────────────────────── */

export function StepList({
  steps,
  onToggle,
}: {
  steps: TMicroStep[];
  onToggle: (id: string, done: boolean) => void;
}) {
  const done = steps.filter((s) => s.done).length;
  return (
    <div>
      {/* Appendix B rule 2: never celebrate on the user's behalf. Report the fact. */}
      <p className="muted" style={{ margin: '0 0 8px' }}>
        {done} of {steps.length} done
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((s) => (
          <li key={s.id} className={`step${s.done ? ' step--done' : ''}`}>
            <input
              type="checkbox"
              id={`step-${s.id}`}
              checked={s.done}
              onChange={(e) => onToggle(s.id, e.target.checked)}
            />
            <div className="step__text">
              <label htmlFor={`step-${s.id}`} style={{ fontSize: 'inherit', color: 'inherit' }}>
                {s.text}
              </label>
              <div className="pills">
                <span className="pill">{s.minutes} min</span>
                <span className="pill">effort: {s.effort}</span>
                <span className="pill">this step feels: {s.anxiety}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── waiting ──────────────────────────────────────────────────────────────── */

/**
 * Never a spinner. Show the SHAPE of the answer immediately and fill it in.
 * For a user whose difficulty is waiting, a spinner is a blank wall; a
 * skeleton is a promise.
 */
export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      <p className="muted" style={{ marginBottom: 12 }}>
        {label}
      </p>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

/* ── trust ────────────────────────────────────────────────────────────────── */

export function TierBadge({ tier }: { tier: ComputeTier }) {
  const d = describeTier(tier);
  return (
    <span className={`badge ${d.leftDevice ? 'badge--cloud' : 'badge--local'}`}>
      {d.leftDevice ? 'sent to cloud' : 'never left your device'}
    </span>
  );
}

/**
 * The consent dialog. The user sees the REDACTED payload before agreeing —
 * §16.1: "Nothing is silently unsealed."
 */
export function ConsentDialog({
  mode,
  preview,
  spans,
  onAllowOnce,
  onAlwaysAllow,
  onCancel,
}: {
  mode: string;
  preview: string;
  spans: PIISpan[];
  onAllowOnce: () => void;
  onAlwaysAllow: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card" role="dialog" aria-label="Send this to cloud AI?">
      <h3>Send this to cloud AI?</h3>
      <p className="muted">
        {mode} needs a model this device cannot run. Here is exactly what would be sent.
      </p>
      <div className="banner banner--accent">{summariseRedactions(spans)}</div>
      <pre
        style={{
          maxHeight: 160,
          overflow: 'auto',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 10,
          fontSize: '0.833rem',
          whiteSpace: 'pre-wrap',
          margin: '0 0 12px',
        }}
      >
        {preview.slice(0, 1200)}
        {preview.length > 1200 ? '\n…' : ''}
      </pre>
      <div className="row">
        <button className="btn btn--primary" onClick={onAllowOnce}>
          Send this once
        </button>
        <button className="btn" onClick={onAlwaysAllow}>
          Always allow {mode}
        </button>
        <button className="btn btn--quiet" onClick={onCancel}>
          No
        </button>
      </div>
    </div>
  );
}

/* ── error ────────────────────────────────────────────────────────────────────
   Appendix B: never "Oops! Something went wrong 😅". Every error names a next
   action, and offers the fallback artifact rather than a dead end.
   ─────────────────────────────────────────────────────────────────────────── */

export function ErrorCard({
  message,
  nextAction,
  onRetry,
  children,
}: {
  message: string;
  nextAction?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="card" role="alert">
      <strong>{message}</strong>
      {nextAction && <p className="muted">{nextAction}</p>}
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
      {children}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card">
      <strong>{title}</strong>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        {hint}
      </p>
    </div>
  );
}

/* ── a small hook for announcing live results to screen readers ───────────── */

export function useAnnounce(message: string | null) {
  const [live, setLive] = useState('');
  useEffect(() => {
    if (!message) return;
    // Clear first so a repeated identical message is still announced.
    setLive('');
    const t = setTimeout(() => setLive(message), 60);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div className="sr" role="status" aria-live="polite">
      {live}
    </div>
  );
}
