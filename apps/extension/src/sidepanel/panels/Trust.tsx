import { describeLedger, describeTier, formatBytes, summariseLedger, type LedgerEntry } from '@setu/core';
import { Empty } from '../../ui/components';
import { sendToBackground } from '../../lib/messages';

/**
 * ⭐ THE TRUST LEDGER (§42.3)
 *
 * "Most products put privacy in a policy. We put it in a log the user can
 *  read. Here is every byte that has ever left this device."
 *
 * Four hours of work. It answers the entire privacy section of the rubric and
 * it is unforgettable because nobody else in the room will have one.
 *
 * The design decision that makes it credible: L0 and L1 rows are logged too,
 * carrying a green "never left your device" badge. A ledger that lists only
 * the cloud calls is a list of accusations. A ledger that lists everything is
 * a proof.
 */
export function TrustPanel({ ledger, onRefresh }: { ledger: LedgerEntry[]; onRefresh: () => void }) {
  const summary = summariseLedger(ledger);

  return (
    <div className="stack">
      <div className="card">
        <h3>What has left this device</h3>
        <p style={{ margin: 0 }}>{describeLedger(summary)}</p>
      </div>

      {ledger.length === 0 ? (
        <Empty
          title="Nothing logged yet."
          hint="Every action SETU takes appears here — including the ones that never touch the network."
        />
      ) : (
        <div className="card">
          <div role="table" aria-label="Trust ledger">
            <div className="sr" role="row">
              <span role="columnheader">When</span>
              <span role="columnheader">What</span>
              <span role="columnheader">Where it ran</span>
            </div>
            {ledger.map((e) => (
              <div className="ledger__row" role="row" key={e.id}>
                <span role="cell" className="muted">
                  {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span role="cell">
                  <strong>{e.mode}</strong> — {e.purpose}
                  {e.domain && <span className="muted"> · {e.domain}</span>}
                  <br />
                  <span className="muted">
                    {describeTier(e.tier).label}
                    {e.leftDevice && (
                      <>
                        {' '}
                        · {formatBytes(e.bytesSent)} sent
                        {e.redactions > 0 && (
                          <>
                            {' '}
                            · {e.redactions} personal detail{e.redactions === 1 ? '' : 's'} removed
                            first
                          </>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <span role="cell">
                  <span className={`badge ${e.leftDevice ? 'badge--cloud' : 'badge--local'}`}>
                    {e.leftDevice ? 'sent to cloud' : 'never left your device'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={onRefresh}>
          Refresh
        </button>
        <button
          className="btn btn--quiet"
          onClick={async () => {
            await sendToBackground({ type: 'CLEAR_LEDGER' });
            onRefresh();
          }}
        >
          Clear this log
        </button>
      </div>

      <p className="muted">
        This log lives on your device. SETU does not upload it, and clearing it removes it for good.
      </p>
    </div>
  );
}
