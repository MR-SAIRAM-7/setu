import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DNA,
  ONBOARDING_CARDS,
  bionicTokens,
  dnaFromCards,
  dnaToAttributes,
  languageName,
  type DNAProfile,
  type OnboardingCard,
} from '@setu/core';
import { checkHealth } from '../lib/api';
import { nanoStatus } from '../lib/nano';
import { sendToBackground } from '../lib/messages';
import {
  clearAlwaysAllow,
  getApiBase,
  getDemoMode,
  setApiBase,
  setDemoMode,
  setOnboarded,
} from '../lib/storage';

/**
 * THE ACCESSIBILITY DNA PROFILE (§9).
 *
 * First-run must take under 60 seconds, and it must NEVER ask "do you have
 * ADHD?" — it asks about experience. SETU has no opinion about whether the
 * user has a condition. It has a record of what the user said works for them.
 * That is Axiom 4, and it is a legal requirement as much as an ethical one:
 * inferred health data is special-category data under GDPR Art. 9 and India's
 * DPDP Act.
 */

const SAMPLE =
  'Candidates who wish to apply for re-evaluation must submit the prescribed form together with the requisite fee before the last date notified by the Controller of Examinations.';

const LANGUAGES = ['en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'mr-IN', 'kn-IN', 'ml-IN', 'gu-IN'];

export function Options() {
  const onboarding = new URLSearchParams(location.search).has('onboarding');

  const [dna, setDna] = useState<DNAProfile>(DEFAULT_DNA);
  const [cards, setCards] = useState<OnboardingCard[]>([]);
  const [step, setStep] = useState(onboarding ? 0 : 3);
  const [saved, setSaved] = useState(false);
  const [apiBase, setApiBaseState] = useState('');
  const [demo, setDemo] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; detail: string } | null>(null);
  const [nano, setNano] = useState('checking…');

  useEffect(() => {
    void (async () => {
      const state = await sendToBackground<{ dna: DNAProfile }>({ type: 'GET_STATE' });
      if (state?.dna) setDna(state.dna);
      setApiBaseState(await getApiBase());
      setDemo(await getDemoMode());
      setNano(await nanoStatus());
    })();
  }, []);

  useEffect(() => {
    for (const [k, v] of Object.entries(dnaToAttributes(dna))) {
      document.documentElement.setAttribute(k, v);
    }
    document.documentElement.setAttribute('data-density', dna.density);
  }, [dna]);

  const save = async (next: DNAProfile) => {
    setDna(next);
    await sendToBackground({ type: 'SET_DNA', dna: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const preview = useMemo(() => bionicTokens(SAMPLE, dna.bionic.enabled ? dna.bionic.intensity : 0), [dna.bionic]);

  /* ── onboarding ─────────────────────────────────────────────────────────── */

  if (step < 3) {
    return (
      <div className="wrap stack">
        <h1>Set SETU up</h1>
        <p className="muted">Under a minute. You can change any of this later.</p>

        {step === 0 && (
          <div className="card">
            <h2>Which of these feels most like you?</h2>
            <p className="muted">Pick as many as apply. Pick none if you would rather just look around.</p>
            <div className="stack">
              {ONBOARDING_CARDS.map((c) => {
                const on = cards.includes(c.id);
                return (
                  <button
                    key={c.id}
                    className="btn btn--block"
                    aria-pressed={on}
                    style={{
                      textAlign: 'left',
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      borderWidth: on ? 2 : 1,
                      height: 'auto',
                      padding: '14px 16px',
                    }}
                    onClick={() =>
                      setCards((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                      )
                    }
                  >
                    <strong>
                      {on ? '✓ ' : ''}
                      {c.label}
                    </strong>
                    <br />
                    <span className="muted">{c.hint}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 16 }}
              onClick={() => {
                setDna(dnaFromCards(cards));
                setStep(1);
              }}
            >
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          /* §9.1 step 2: they pick by SEEING, not by reading settings names. */
          <div className="card">
            <h2>Does this help?</h2>
            <p
              style={{
                fontFamily: 'var(--font-read)',
                fontSize: 'var(--t-md)',
                lineHeight: 'var(--read-leading)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              {preview.map(([bold, rest], i) => (
                <span key={i}>
                  <b>{bold}</b>
                  {rest}
                </span>
              ))}
            </p>
            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  setDna({ ...dna, bionic: { ...dna.bionic, enabled: !dna.bionic.enabled } })
                }
              >
                {dna.bionic.enabled ? 'Turn the bolding off' : 'Turn the bolding on'}
              </button>
              <button
                className="btn"
                onClick={() =>
                  setDna({
                    ...dna,
                    density: dna.density === 'minimal' ? 'calm' : 'minimal',
                  })
                }
              >
                More spacing
              </button>
            </div>
            <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <h2>Two last things</h2>

            <label htmlFor="lang2">What language should SETU explain things in?</label>
            <select
              id="lang2"
              value={dna.language}
              onChange={(e) => setDna({ ...dna, language: e.target.value })}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>

            <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0' }}>
              <legend style={{ padding: 0, fontSize: 'var(--t-xs)', color: 'var(--fg-muted)' }}>
                Can SETU use cloud AI for hard tasks?
              </legend>
              {(
                [
                  ['ask', 'Ask me each time', 'You see exactly what would be sent, every time.'],
                  ['allow', 'Yes', 'Faster. Everything is still logged in the Trust page.'],
                  [
                    'never',
                    'Never — on-device only',
                    'Focus Mode always works. Other modes need a local model.',
                  ],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 0',
                    color: 'var(--fg)',
                    fontSize: 'var(--t-sm)',
                  }}
                >
                  <input
                    type="radio"
                    name="cloud"
                    style={{ width: 22, height: 22, marginTop: 2 }}
                    checked={dna.privacy.cloudAI === value}
                    onChange={() => setDna({ ...dna, privacy: { ...dna.privacy, cloudAI: value } })}
                  />
                  <span>
                    <strong>{label}</strong>
                    <br />
                    <span className="muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 16 }}
              onClick={async () => {
                await save(dna);
                await setOnboarded(true);
                setStep(3);
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── full settings ──────────────────────────────────────────────────────── */

  return (
    <div className="wrap stack">
      <h1>SETU settings</h1>
      <p className="muted">
        This is your profile, not a diagnosis. SETU never records or infers anything about a
        condition — only what you have told it works for you.
      </p>

      {saved && (
        <div className="banner banner--calm" role="status">
          Saved.
        </div>
      )}

      <section className="card">
        <h2>Reading</h2>

        <label htmlFor="level">Explain things at this level</label>
        <select
          id="level"
          value={dna.readingLevel}
          onChange={(e) => void save({ ...dna, readingLevel: e.target.value as DNAProfile['readingLevel'] })}
        >
          <option value="simple">Simple — short sentences, common words</option>
          <option value="plain">Plain — everyday language</option>
          <option value="standard">Standard — general adult</option>
          <option value="technical">Technical — precision over simplification</option>
        </select>

        <label htmlFor="font" style={{ marginTop: 14 }}>
          Typeface
        </label>
        <select
          id="font"
          value={dna.fontStack}
          onChange={(e) => void save({ ...dna, fontStack: e.target.value as DNAProfile['fontStack'] })}
        >
          <option value="system">System default</option>
          <option value="atkinson">Atkinson Hyperlegible — designed for low vision</option>
          <option value="lexend">Lexend</option>
          <option value="opendyslexic">OpenDyslexic</option>
        </select>

        <div style={{ marginTop: 14 }}>
          <label>
            <input
              type="checkbox"
              style={{ width: 22, height: 22, marginRight: 8, verticalAlign: 'middle' }}
              checked={dna.bionic.enabled}
              onChange={(e) => void save({ ...dna, bionic: { ...dna.bionic, enabled: e.target.checked } })}
            />
            Bold the start of each word
          </label>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Studies of this technique are mixed at the population level. It is here because some
            people find it helps them hold their place. It is off unless you choose it.
          </p>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-read)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 16,
            marginTop: 12,
          }}
        >
          {preview.map(([bold, rest], i) => (
            <span key={i}>
              <b>{bold}</b>
              {rest}
            </span>
          ))}
        </p>
      </section>

      <section className="card">
        <h2>The pause offer</h2>
        <p className="muted">
          SETU can notice when a page is going badly and offer a moment to breathe. The signals stay
          on your device: pointer and scroll movement in a 30-second buffer, compared against your
          own baseline. Nothing is stored and nothing is sent.
        </p>
        <label>
          <input
            type="checkbox"
            style={{ width: 22, height: 22, marginRight: 8, verticalAlign: 'middle' }}
            checked={dna.breathe.enabled}
            onChange={(e) => void save({ ...dna, breathe: { ...dna.breathe, enabled: e.target.checked } })}
          />
          Offer a pause on difficult pages
        </label>
        {dna.breathe.enabled && (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="sens">How readily: {['off', 'rarely', 'sometimes', 'readily'][dna.breathe.sensitivity]}</label>
            <input
              id="sens"
              type="range"
              min={1}
              max={3}
              value={dna.breathe.sensitivity}
              style={{ width: '100%' }}
              onChange={(e) =>
                void save({
                  ...dna,
                  breathe: { ...dna.breathe, sensitivity: Number(e.target.value) as 1 | 2 | 3 },
                })
              }
            />
          </div>
        )}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <label htmlFor="cloud">Cloud AI</label>
        <select
          id="cloud"
          value={dna.privacy.cloudAI}
          onChange={(e) =>
            void save({
              ...dna,
              privacy: { ...dna.privacy, cloudAI: e.target.value as 'ask' | 'allow' | 'never' },
            })
          }
        >
          <option value="ask">Ask me each time</option>
          <option value="allow">Allow</option>
          <option value="never">Never — on-device only</option>
        </select>

        <p className="muted" style={{ marginTop: 12 }}>
          On-device model: <strong>{nano}</strong>.{' '}
          {nano === 'available'
            ? 'Short explanations and rewrites can run without touching the network.'
            : 'Chrome needs roughly 22GB free disk and a capable GPU for this. Everything still works without it.'}
        </p>

        <button className="btn" style={{ marginTop: 8 }} onClick={() => void clearAlwaysAllow()}>
          Forget my “always allow” choices
        </button>
      </section>

      <section className="card">
        <h2>Connection</h2>
        <label htmlFor="api">SETU server</label>
        <input
          id="api"
          type="url"
          value={apiBase}
          onChange={(e) => setApiBaseState(e.target.value)}
          onBlur={() => void setApiBase(apiBase)}
          placeholder="http://localhost:3000"
        />
        <p className="muted" style={{ marginTop: 6 }}>
          Cloud modes go through this server, never straight to a model provider. That is how the
          API key stays out of this extension.
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={async () => setHealth(await checkHealth())}>
            Test the connection
          </button>
        </div>
        {health && (
          <div className={`banner ${health.ok ? 'banner--calm' : ''}`} style={{ marginTop: 12 }}>
            {health.detail}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Demo mode</h2>
        <p className="muted">
          Every result comes from a local fixture and no network call is made. Alt+Shift+D toggles
          it from anywhere.
        </p>
        <label>
          <input
            type="checkbox"
            style={{ width: 22, height: 22, marginRight: 8, verticalAlign: 'middle' }}
            checked={demo}
            onChange={async (e) => {
              setDemo(e.target.checked);
              await setDemoMode(e.target.checked);
              await sendToBackground({ type: 'SET_DEMO_MODE', on: e.target.checked });
            }}
          />
          Use local fixtures instead of the network
        </label>
      </section>
    </div>
  );
}
