import { useEffect, useState } from 'react';
import { getPrefs, savePrefs, listMaps, clearAllMaps } from '../lib/storage';
import { api } from '../lib/api';

export default function Settings() {
  const [prefs, setPrefs] = useState(getPrefs);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [mapsCount, setMapsCount] = useState(0);

  useEffect(() => {
    api.health().then(setHealth);
    setMapsCount(listMaps().length);
  }, []);

  const update = (patch) => {
    const next = savePrefs(patch);
    setPrefs(next);
  };

  const deepCheck = async () => {
    setChecking(true);
    try {
      const res = await api.healthAi();
      setHealth((prev) => ({ ...(prev || {}), ai: res, database: res?.database }));
    } catch (_) {
      setHealth((prev) => ({
        ...(prev || {}),
        ai: { ok: false, reason: 'Engine unreachable' }
      }));
    } finally {
      setChecking(false);
    }
  };

  const handleDeleteAll = () => {
    if (confirm('Delete every saved map? This cannot be undone.')) {
      clearAllMaps();
      setMapsCount(0);
      window.location.reload();
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10 bg-[var(--color-bg)] text-left">
      <div className="max-w-[660px] mx-auto space-y-9">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl sm:text-[34px] font-bold text-[var(--color-text)]">
            Settings
          </h1>
          <p className="text-[15px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
            Reading preferences apply across the whole workspace and are saved on this device.
          </p>
        </header>

        {/* 1. Reading Section (Whitespace separated, no cards) */}
        <section className="space-y-5">
          <span className="kicker block">Reading Preferences</span>

          {/* Typeface Choice */}
          <div className="space-y-2">
            <label className="block text-[14.5px] font-semibold text-[var(--color-text)]">
              Typeface
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Typeface">
              {[
                { value: 'serif', label: 'Source Serif 4' },
                { value: 'hyper', label: 'Atkinson Hyperlegible' },
                { value: 'system', label: 'System sans' }
              ].map((opt) => {
                const isSelected = prefs.font === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => update({ font: opt.value })}
                    className={`px-3.5 py-2 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                        : 'bg-transparent text-[var(--color-text)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Size Choice */}
          <div className="space-y-2">
            <label className="block text-[14.5px] font-semibold text-[var(--color-text)]">
              Text size
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Text size">
              {[
                { value: 'normal', label: 'Normal (16px)' },
                { value: 'comfortable', label: 'Comfortable (1.1×)' },
                { value: 'large', label: 'Large (1.22×)' }
              ].map((opt) => {
                const isSelected = prefs.textSize === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => update({ textSize: opt.value })}
                    className={`px-3.5 py-2 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                        : 'bg-transparent text-[var(--color-text)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motion Choice */}
          <div className="space-y-2">
            <label className="block text-[14.5px] font-semibold text-[var(--color-text)]">
              Motion
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motion">
              {[
                { value: 'move', label: 'Let things move' },
                { value: 'still', label: 'Keep it still' }
              ].map((opt) => {
                const isSelected = prefs.motion === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => update({ motion: opt.value })}
                    className={`px-3.5 py-2 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                        : 'bg-transparent text-[var(--color-text)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. Engine & Database Section */}
        <section className="space-y-4 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker block">Engine & Persistence</span>

          <dl className="space-y-2.5 text-[14px]">
            <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
              <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Status</dt>
              <dd className="font-semibold text-right">
                {health ? (
                  <span className="text-[var(--color-accent-700)]">
                    Connected · {health.product || 'SETU Engine'} v{health.version}
                  </span>
                ) : (
                  <span className="text-[var(--color-accent-2-700)]">
                    Offline — run <code className="px-1 bg-[var(--color-surface)]">npm start</code> in /backend
                  </span>
                )}
              </dd>
            </div>

            <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
              <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Database</dt>
              <dd className="font-semibold text-right">
                <span className="text-[var(--color-accent-700)]">
                  MongoDB {health?.database?.connected ? '(Connected)' : '(Local Storage Fallback)'}
                </span>
              </dd>
            </div>

            <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
              <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">AI Provider</dt>
              <dd className="font-semibold text-right">
                {health?.aiConfigured ? (
                  <span className="text-[var(--color-accent-700)]">Configured (Gemini / OpenAI fallback)</span>
                ) : (
                  <span className="text-[#edbb00]">Set GEMINI_API_KEY in .env</span>
                )}
              </dd>
            </div>

            {health?.ai && (
              <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
                <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Live Test</dt>
                <dd className="font-semibold text-right">
                  {health.ai.ok ? (
                    <span className="text-[var(--color-accent-700)]">
                      Responding · {health.ai.provider} ({health.ai.model})
                    </span>
                  ) : (
                    <span className="text-[var(--color-accent-2-700)]">{health.ai.reason}</span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          <button
            onClick={deepCheck}
            disabled={checking}
            className="btn btn-secondary !min-h-[34px] text-[13px]"
          >
            {checking ? 'Testing AI & DB connection…' : 'Test the AI connection'}
          </button>
        </section>

        {/* 3. Extension Shortcuts Section */}
        <section className="space-y-4 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker block">Extension Shortcuts (Lens)</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
            {[
              ['Alt + B', 'Bionic Reading'],
              ['Alt + F', 'Focus Mode'],
              ['Alt + L', 'Line Focus'],
              ['Alt + H', 'Reading Ruler'],
              ['Alt + T', 'Read Aloud'],
              ['Alt + S', 'Auto Scroll'],
              ['Alt + ⇧ + C', 'SETU Commander'],
              ['Alt + X', 'Turn everything off']
            ].map(([keys, action]) => (
              <div
                key={keys}
                className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-sm)]"
              >
                <span className="text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
                  {action}
                </span>
                <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-divider)] bg-[var(--color-bg)] font-mono text-[11px] font-semibold text-[var(--color-text)]">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Your Data Section */}
        <section className="space-y-3 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker kicker-magenta block">Your Data</span>
          <p className="text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
            {mapsCount} map{mapsCount === 1 ? '' : 's'} stored in this browser. Nothing is uploaded
            to third-party tracking services. Clearing your browser data removes them.
          </p>
          <button
            onClick={handleDeleteAll}
            className="btn btn-destructive !min-h-[36px] text-[13px] mt-2"
          >
            Delete all saved maps
          </button>
        </section>
      </div>
    </div>
  );
}
