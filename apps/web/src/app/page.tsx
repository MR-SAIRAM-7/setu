import { availableProviders, env } from '@/server/env';

export const dynamic = 'force-dynamic';

/**
 * SETU Edge status page.
 *
 * The Sanctuary UI (ingest, mind maps, Rewind, the Trust page) is the next
 * milestone. Today this deployment is the API surface the extension talks to,
 * and this page says so plainly rather than showing a marketing shell over
 * something that does not exist yet.
 */
export default function Home() {
  const providers = availableProviders();

  return (
    <main>
      <span className="tag">SETU Edge · v0.9.0</span>
      <h1>SETU</h1>
      <p className="muted" style={{ fontSize: '1.2rem' }}>
        The cognitive bridge. From overwhelm to action.
      </p>

      <div className="card">
        <strong>Service status</strong>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          AI engines configured:{' '}
          {providers.length ? <strong>{providers.join(', ')}</strong> : <strong>none</strong>}
          <br />
          Auth mode: <strong>{env.authMode}</strong>
        </p>
        {!providers.length && (
          <p style={{ margin: '12px 0 0' }}>
            No engine is configured, so cloud modes will return their deterministic fallback. Focus
            Mode, bionic reading, the load score and the pause offer are unaffected — they never
            needed a model.
          </p>
        )}
      </div>

      <h2>What this deployment is</h2>
      <p>
        This is the one door. Every cloud request from SETU Lens, and later from Sanctuary and Go,
        arrives here — so there is exactly one place that enforces authentication, rate limits,
        consent, PII redaction, schema validation and cost accounting.
      </p>
      <p>
        The API key lives here and only here. The browser extension never talks to a model provider
        directly, which is why there is no key to extract from its bundle.
      </p>

      <h2>Endpoints</h2>
      <pre>
        <code>{`POST /api/transform   nine modes, schema-validated, with repair + fallback
POST /api/commander   plan browser actions (the agent) — plans only, never executes
POST /api/ledger      Trust Ledger mirror
GET  /api/health      capability probe`}</code>
      </pre>

      <h2>Next</h2>
      <p className="muted">
        Sanctuary — document ingest, mind maps, the Memory Vault and the Trust page — is the next
        surface. SETU Go follows it.
      </p>
    </main>
  );
}
