import { useEffect, useState } from 'react';
import { getPrefs, savePrefs, listMaps } from '../lib/storage';
import { api } from '../lib/api';

export default function Settings() {
  const [prefs, setPrefs] = useState(getPrefs);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.health().then(setHealth);
  }, []);

  const update = (patch) => setPrefs(savePrefs(patch));

  const deepCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/health/ai');
      setHealth({ ...(health || {}), ai: await response.json() });
    } catch (_) {
      setHealth({ ...(health || {}), ai: { ok: false, reason: 'Engine unreachable' } });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-slate-400">
          Reading preferences apply across the whole workspace and are saved on this device.
        </p>
      </header>

      <div className="max-w-2xl space-y-4">
        <Section title="Reading">
          <Choice
            label="Typeface"
            hint="OpenDyslexic has weighted letter bottoms that reduce letter flipping."
            value={prefs.font}
            onChange={(font) => update({ font })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dyslexic', label: 'OpenDyslexic' }
            ]}
          />
          <Choice
            label="Text size"
            value={prefs.textSize}
            onChange={(textSize) => update({ textSize })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'large', label: 'Large' }
            ]}
          />
          <Toggle
            label="Reduce motion"
            hint="Removes transitions and animated backgrounds."
            checked={prefs.reduceMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
        </Section>

        <Section title="Engine">
          <dl className="space-y-2 text-[13px]">
            <Field label="Status">
              {health ? (
                <span className="text-mint-300">Connected · v{health.version}</span>
              ) : (
                <span className="text-rose-400">Offline — run <code className="rounded bg-ink-700 px-1">npm start</code> in /backend</span>
              )}
            </Field>
            <Field label="AI key">
              {health?.aiConfigured ? (
                <span className="text-mint-300">Configured</span>
              ) : (
                <span className="text-sun-400">Not set — add GEMINI_API_KEY to your .env</span>
              )}
            </Field>
            {health?.ai && (
              <Field label="Live test">
                {health.ai.ok ? (
                  <span className="text-mint-300">
                    Responding · {health.ai.provider} / {health.ai.model}
                  </span>
                ) : (
                  <span className="text-rose-400">{health.ai.reason}</span>
                )}
              </Field>
            )}
          </dl>
          <button onClick={deepCheck} disabled={checking} className="btn-ghost mt-3 !min-h-[34px] text-[12.5px]">
            {checking ? 'Testing…' : 'Test the AI connection'}
          </button>
        </Section>

        <Section title="Your data">
          <p className="text-[13px] leading-relaxed text-slate-400">
            {listMaps().length} map{listMaps().length === 1 ? '' : 's'} stored in this browser.
            Nothing is uploaded anywhere — clearing your browser data removes them.
          </p>
          <button
            onClick={() => {
              if (confirm('Delete every saved map? This cannot be undone.')) {
                localStorage.removeItem('setu.maps.v1');
                window.location.reload();
              }
            }}
            className="btn-ghost mt-3 !min-h-[34px] text-[12.5px] hover:!border-rose-400 hover:!text-rose-400"
          >
            Delete all saved maps
          </button>
        </Section>

        <Section title="Keyboard shortcuts (browser extension)">
          <dl className="grid gap-1.5 text-[12.5px] sm:grid-cols-2">
            {[
              ['Alt + B', 'Bionic Reading'],
              ['Alt + F', 'Focus Mode'],
              ['Alt + L', 'Line Focus'],
              ['Alt + H', 'Reading Ruler'],
              ['Alt + T', 'Read Aloud'],
              ['Alt + S', 'Auto Scroll'],
              ['Alt + Shift + C', 'SETU Commander'],
              ['Alt + X', 'Turn everything off']
            ].map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-2 rounded-lg bg-ink-700/40 px-3 py-1.5">
                <dt className="text-slate-400">{action}</dt>
                <dd>
                  <kbd className="rounded border border-white/15 bg-ink-800 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300">
                    {keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}

/* --------------------------- presentational --------------------------- */

const Section = ({ title, children }) => (
  <section className="card p-5">
    <h2 className="label mb-3">{title}</h2>
    <div className="space-y-4">{children}</div>
  </section>
);

const Field = ({ label, children }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right">{children}</dd>
  </div>
);

function Choice({ label, hint, value, onChange, options }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-slate-200">{label}</p>
      {hint && <p className="mb-2 mt-0.5 text-[11.5px] text-slate-500">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              value === option.value
                ? 'border-iris-500 bg-iris-500/15 text-white'
                : 'border-white/10 bg-ink-700/40 text-slate-400 hover:border-white/30 hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13px] font-semibold text-slate-200">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] text-slate-500">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-iris-500' : 'bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
