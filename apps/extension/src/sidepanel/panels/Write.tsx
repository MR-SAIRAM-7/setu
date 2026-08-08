import { useState } from 'react';
import type { DNAProfile } from '@setu/core';
import { ConsentDialog, Empty, ErrorCard, Skeleton, TierBadge } from '../../ui/components';
import { captureSelection, useTransform } from '../useSetu';

/**
 * WRITE — "I can't get this out clearly."
 *
 * Presented as an accept/reject diff, never as a silent replacement. Axiom:
 * "You are reducing friction, not rewriting their personality." The user must
 * remain the author, so every change is shown with its reason and can be
 * refused individually.
 */
export function WritePanel({ dna, initialText }: { dna: DNAProfile; initialText?: string }) {
  const [text, setText] = useState(initialText ?? '');
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const { run, consent, start, retry } = useTransform(dna.privacy.cloudAI);

  const result = run.data?.mode === 'WRITE' ? run.data : null;

  const submit = async (override?: string) => {
    const body = (override ?? text).trim();
    if (!body) return;
    setRejected(new Set());
    await start({ mode: 'WRITE', input: body, url: location.href });
  };

  const pullSelection = async () => {
    const sel = await captureSelection();
    if (sel?.text) {
      setText(sel.text);
      await submit(sel.text);
    }
  };

  if (consent)
    return (
      <ConsentDialog
        mode="WRITE"
        preview={consent.preview}
        spans={consent.spans}
        onAllowOnce={consent.proceed}
        onAlwaysAllow={consent.proceed}
        onCancel={consent.cancel}
      />
    );

  return (
    <div className="stack">
      <div className="card">
        <label htmlFor="draft">Your draft</label>
        <textarea
          id="draft"
          value={text}
          placeholder="Write it badly here. SETU will make it clearer without making it someone else's."
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn--primary" onClick={() => void submit()} disabled={!text.trim() || run.busy}>
            Make it clearer
          </button>
          <button className="btn btn--quiet" onClick={pullSelection}>
            Use what I selected
          </button>
        </div>
      </div>

      {run.busy && <Skeleton lines={4} label="Looking for the friction…" />}

      {run.error && (
        <ErrorCard message={run.error.message} nextAction={run.error.nextAction} onRetry={retry} />
      )}

      {result && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Rewritten</h3>
              <span className="pill">
                reading grade {result.gradeBefore.toFixed(1)} → {result.gradeAfter.toFixed(1)}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-read)', marginTop: 12 }}>{result.rewrite}</p>
            <div className="row">
              <button
                className="btn btn--primary"
                onClick={() => void navigator.clipboard.writeText(result.rewrite)}
              >
                Copy
              </button>
              <button className="btn" onClick={() => setText(result.rewrite)}>
                Keep editing this
              </button>
            </div>
          </div>

          {result.changes.length > 0 && (
            <div className="card">
              <h3>What changed, and why</h3>
              <p className="muted">Reject anything that changed your meaning.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {result.changes.map((c, i) => (
                  <li
                    key={i}
                    className="step"
                    style={{ opacity: rejected.has(i) ? 0.45 : 1, display: 'block' }}
                  >
                    <span className="pill">{c.kind}</span>
                    <p style={{ margin: '6px 0 2px' }}>
                      <s className="muted">{c.before}</s>
                    </p>
                    <p style={{ margin: '0 0 4px' }}>{c.after}</p>
                    <p className="muted" style={{ margin: 0 }}>
                      {c.why}
                    </p>
                    <button
                      className="btn btn--quiet"
                      onClick={() =>
                        setRejected((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                    >
                      {rejected.has(i) ? 'Undo reject' : 'Reject this change'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.meta && (
            <p className="muted">
              <TierBadge tier={run.meta.tier} /> {run.meta.latencyMs}ms
            </p>
          )}
        </>
      )}

      {!run.busy && !result && !run.error && (
        <Empty
          title="Paste a draft."
          hint="Or select text in any box on the page and press “Use what I selected”."
        />
      )}
    </div>
  );
}
