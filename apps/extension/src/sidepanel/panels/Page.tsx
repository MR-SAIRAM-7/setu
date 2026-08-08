import { useEffect, useState } from 'react';
import type { CLSBreakdown, DNAProfile } from '@setu/core';
import { CLSMeter, Empty } from '../../ui/components';
import { forceBreathe, panicOnPage, toggleFocusOnPage } from '../useSetu';
import { sendToBackground } from '../../lib/messages';

/**
 * The L0 panel. Everything here runs on the user's own CPU: zero network
 * calls, zero server cost, works with the wifi off.
 *
 * On stage this is the segment where you turn the wifi OFF and keep going.
 * §42.5 — highest ROI item on the entire differentiator list, and it costs
 * zero build hours. Rehearse it.
 */
export function PagePanel({
  dna,
  cls,
  url,
  onDnaChange,
}: {
  dna: DNAProfile;
  cls?: CLSBreakdown;
  url?: string;
  onDnaChange: (dna: DNAProfile) => void;
}) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (!url) return;
    try {
      const pattern = `${new URL(url).origin}/*`;
      setOrigin(pattern);
      chrome.permissions.contains({ origins: [pattern] }).then(setGranted).catch(() => setGranted(null));
    } catch {
      setGranted(null);
    }
  }, [url]);

  return (
    <div className="stack">
      {cls ? (
        <div className="card">
          <CLSMeter cls={cls} label="This page" />
          <p className="muted" style={{ margin: '12px 0 0' }}>
            Computed on this device in {cls.computedInMs}ms. No network call.
          </p>
        </div>
      ) : (
        <Empty
          title="No measurement yet."
          hint="Open a normal web page and press the SETU icon once, so SETU can look at it."
        />
      )}

      <div className="card">
        <h3>Make this page survivable</h3>
        <div className="row">
          <button className="btn btn--primary" onClick={() => void toggleFocusOnPage()}>
            Toggle Focus Mode
          </button>
          <button className="btn" onClick={() => void panicOnPage()}>
            Just the next step
          </button>
        </div>
        <p className="muted" style={{ margin: '10px 0 0' }}>
          Keyboard: Alt+Shift+F to focus, Alt+Shift+Q for the next step only.
        </p>
      </div>

      <div className="card">
        <h3>Reading</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label htmlFor="bionic" style={{ margin: 0 }}>
            Bold the start of each word
          </label>
          <input
            id="bionic"
            type="checkbox"
            style={{ width: 22, height: 22 }}
            checked={dna.bionic.enabled}
            onChange={(e) => onDnaChange({ ...dna, bionic: { ...dna.bionic, enabled: e.target.checked } })}
          />
        </div>
        {dna.bionic.enabled && (
          <div style={{ marginTop: 10 }}>
            <label htmlFor="intensity">Anchor strength: {dna.bionic.intensity}</label>
            <input
              id="intensity"
              type="range"
              min={1}
              max={3}
              step={1}
              value={dna.bionic.intensity}
              style={{ width: '100%' }}
              onChange={(e) =>
                onDnaChange({
                  ...dna,
                  bionic: { ...dna.bionic, intensity: Number(e.target.value) as 1 | 2 | 3 },
                })
              }
            />
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <label htmlFor="guide" style={{ margin: 0 }}>
            Line guide follows my cursor
          </label>
          <input
            id="guide"
            type="checkbox"
            style={{ width: 22, height: 22 }}
            checked={dna.lineGuide}
            onChange={(e) => onDnaChange({ ...dna, lineGuide: e.target.checked })}
          />
        </div>
      </div>

      {granted === false && origin && (
        <div className="card">
          <h3>Let SETU watch this site</h3>
          <p className="muted">
            SETU is running here for this visit only. Grant this one site to have Focus Mode, the
            load score and the pause offer ready automatically next time.
          </p>
          <button
            className="btn"
            onClick={async () => {
              const res = await sendToBackground<{ granted: boolean }>({
                type: 'REQUEST_SITE_ACCESS',
                origin,
              });
              setGranted(!!res?.granted);
            }}
          >
            Always allow {safeHost(origin)}
          </button>
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer' }}>Demo controls</summary>
        <p className="muted" style={{ marginTop: 10 }}>
          Risk #3 mitigation: never depend on rage-clicking convincingly on stage.
        </p>
        <button className="btn" onClick={() => void forceBreathe()}>
          Trigger the pause offer now
        </button>
      </details>
    </div>
  );
}

function safeHost(pattern: string): string {
  try {
    return new URL(pattern.replace('/*', '')).hostname;
  } catch {
    return 'this site';
  }
}
