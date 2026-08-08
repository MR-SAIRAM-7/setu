import { useState } from 'react';
import type { TStartResult } from '@setu/core';
import { ConsentDialog, ErrorCard, Skeleton, StepList, TierBadge, Empty } from '../../ui/components';
import { capturePage, useTransform } from '../useSetu';
import type { DNAProfile } from '@setu/core';

/**
 * START — "I can't begin." The Wall of Awful.
 *
 * This is the emotional core of the pitch. The gap was never knowledge; it was
 * the translation of intent into a first physical action. So the panel's most
 * prominent element is not the plan — it is the ONE thing to do in the next
 * ten minutes.
 */
export function StartPanel({ dna, initialText }: { dna: DNAProfile; initialText?: string }) {
  const [task, setTask] = useState(initialText ?? '');
  const { run, consent, start, retry } = useTransform(dna.privacy.cloudAI);
  const [steps, setSteps] = useState<TStartResult['steps']>([]);

  const result = run.data?.mode === 'START' ? run.data : null;

  // The user's edits always win (§14, `edited_output`). We never overwrite a
  // checked box with a re-render.
  const liveSteps = steps.length ? steps : (result?.steps ?? []);

  const submit = async () => {
    if (!task.trim()) return;
    setSteps([]);
    await start({ mode: 'START', input: `TASK: ${task.trim()}`, url: location.href });
  };

  const useThisPage = async () => {
    const page = await capturePage();
    if (page) setTask(`Complete what this page is asking me to do: ${page.title}`);
  };

  if (consent)
    return (
      <ConsentDialog
        mode="START"
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
        <label htmlFor="task">What are you avoiding?</label>
        <textarea
          id="task"
          value={task}
          placeholder="Apply for my exam re-evaluation"
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn--primary" onClick={submit} disabled={!task.trim() || run.busy}>
            Break it down
          </button>
          <button className="btn btn--quiet" onClick={useThisPage}>
            Use this page
          </button>
        </div>
      </div>

      {run.busy && <Skeleton lines={5} label="Working out the first small step…" />}

      {run.error && (
        <ErrorCard message={run.error.message} nextAction={run.error.nextAction} onRetry={retry}>
          {run.usedFallback && (
            <p className="muted" style={{ marginTop: 8 }}>
              Below is a plan built without AI, from the words you typed.
            </p>
          )}
        </ErrorCard>
      )}

      {result && (
        <>
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              {result.restated}
            </p>
            {result.clarifier && (
              <p style={{ marginTop: 8, fontWeight: 700 }}>{result.clarifier}</p>
            )}
          </div>

          {/* The hero element. One action, ten minutes, today. */}
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <p className="muted" style={{ margin: 0 }}>
              Start here — {result.firstAction.minutes} minutes
            </p>
            <p style={{ fontSize: 'var(--t-md)', margin: '6px 0 8px', fontFamily: 'var(--font-read)' }}>
              {result.firstAction.text}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {result.firstAction.why}
            </p>
          </div>

          <div className="card">
            <h3>Then</h3>
            <StepList
              steps={liveSteps}
              onToggle={(id, done) =>
                setSteps((prev) =>
                  (prev.length ? prev : (result.steps ?? [])).map((s) =>
                    s.id === id ? { ...s, done } : s,
                  ),
                )
              }
            />
          </div>

          <div className="card">
            <p style={{ margin: 0 }}>{result.encouragement}</p>
            <button
              className="btn btn--quiet"
              style={{ marginTop: 8 }}
              onClick={() =>
                void start({
                  mode: 'START',
                  input: `TASK: ${task}\n\nThe previous breakdown still felt too big. Make each step smaller and lower-anxiety.`,
                  url: location.href,
                })
              }
            >
              {result.escapeHatch}
            </button>
          </div>

          {run.meta && (
            <p className="muted">
              <TierBadge tier={run.meta.tier} /> {run.meta.latencyMs}ms
              {run.meta.cached ? ' · from cache' : ''}
            </p>
          )}
        </>
      )}

      {!run.busy && !result && !run.error && (
        <Empty
          title="Nothing here yet."
          hint="Type the thing you have been putting off. SETU will find the first ten minutes of it."
        />
      )}
    </div>
  );
}
