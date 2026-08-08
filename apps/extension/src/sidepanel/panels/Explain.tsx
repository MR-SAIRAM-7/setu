import { useEffect, useState } from 'react';
import type { DNAProfile, ReadingLevel } from '@setu/core';
import { languageName } from '@setu/core';
import { ConsentDialog, Empty, ErrorCard, Skeleton, TierBadge } from '../../ui/components';
import { captureSelection, useTransform } from '../useSetu';

/**
 * EXPLAIN — "what does this even mean."
 *
 * Highest value-per-hour in the entire product, and the multilingual moment:
 * selecting English legalese and hearing it explained in Hindi or Tamil with a
 * local analogy is the single most affecting thing SETU can do in front of an
 * Indian judging panel.
 */

const LEVELS: ReadingLevel[] = ['simple', 'plain', 'standard', 'technical'];

export function ExplainPanel({
  dna,
  initialText,
  onDnaLevelChange,
}: {
  dna: DNAProfile;
  initialText?: string;
  onDnaLevelChange: (level: ReadingLevel) => void;
}) {
  const [text, setText] = useState(initialText ?? '');
  const { run, consent, start, retry } = useTransform(dna.privacy.cloudAI);
  const [speaking, setSpeaking] = useState(false);

  const result = run.data?.mode === 'EXPLAIN' ? run.data : null;

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  const submit = async (override?: string) => {
    const body = (override ?? text).trim();
    if (!body) return;
    await start({ mode: 'EXPLAIN', input: body, url: location.href });
  };

  const pullSelection = async () => {
    const sel = await captureSelection();
    if (sel?.text) {
      setText(sel.text);
      await submit(sel.text);
    }
  };

  const speak = (body: string, lang: string) => {
    // chrome.tts keeps audio off the page and works even when the tab is muted.
    setSpeaking(true);
    chrome.tts.speak(body, {
      lang,
      rate: 0.95,
      onEvent: (e) => {
        if (e.type === 'end' || e.type === 'error' || e.type === 'interrupted') setSpeaking(false);
      },
    });
  };

  if (consent)
    return (
      <ConsentDialog
        mode="EXPLAIN"
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
        <label htmlFor="explain">Text to explain</label>
        <textarea
          id="explain"
          value={text}
          placeholder="Paste jargon, legal text, or a term you got stuck on"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn--primary" onClick={() => void submit()} disabled={!text.trim() || run.busy}>
            Explain it
          </button>
          <button className="btn btn--quiet" onClick={pullSelection}>
            Use what I selected
          </button>
        </div>
      </div>

      {/* §42.7 The Reading Level Dial. Changing it re-runs at the new level —
          the same content, instantly re-rendered, which is visually striking
          and takes two seconds to understand. */}
      <div className="card">
        <label id="lvl-label">Reading level</label>
        <div className="row" role="radiogroup" aria-labelledby="lvl-label">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              role="radio"
              aria-checked={dna.readingLevel === lvl}
              className={`btn${dna.readingLevel === lvl ? ' btn--primary' : ''}`}
              onClick={() => {
                onDnaLevelChange(lvl);
                if (text.trim()) void submit();
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {run.busy && <Skeleton lines={4} label="Putting this in plain words…" />}

      {run.error && (
        <ErrorCard message={run.error.message} nextAction={run.error.nextAction} onRetry={retry} />
      )}

      {result && (
        <>
          <div className="card">
            <h3>In plain words</h3>
            <p style={{ fontFamily: 'var(--font-read)' }}>{result.plain}</p>
            <button className="btn btn--quiet" onClick={() => speak(result.plain, 'en-IN')}>
              {speaking ? 'Stop' : 'Read it aloud'}
            </button>
          </div>

          <div className="card">
            <h3>Think of it like</h3>
            <p>{result.analogy}</p>
          </div>

          <div className="card">
            <h3>Why this matters to you</h3>
            <p style={{ margin: 0 }}>{result.whyItMatters}</p>
          </div>

          {result.steps.length > 0 && (
            <div className="card">
              <h3>What to do</h3>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {result.steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.vernacular && (
            <div className="card" style={{ borderLeft: '4px solid var(--calm)' }}>
              <h3>{languageName(result.vernacular.lang)}</h3>
              <p style={{ fontFamily: 'var(--font-read)', fontSize: 'var(--t-md)' }}>
                {result.vernacular.text}
              </p>
              <button
                className="btn"
                onClick={() => speak(result.vernacular!.text, result.vernacular!.lang)}
              >
                {speaking ? 'Stop' : `Listen in ${languageName(result.vernacular.lang)}`}
              </button>
            </div>
          )}

          {result.imageBreakdown.length > 0 && (
            <div className="card">
              <h3>What is in the image</h3>
              <dl style={{ margin: 0 }}>
                {result.imageBreakdown.map((b, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <dt style={{ fontWeight: 700 }}>{b.region}</dt>
                    <dd style={{ margin: 0 }}>{b.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

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
          title="Select anything on a page."
          hint="Right-click → Explain this with SETU. Or paste the text here."
        />
      )}
    </div>
  );
}
