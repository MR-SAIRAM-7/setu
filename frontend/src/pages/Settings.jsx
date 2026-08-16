import { useEffect, useState } from 'react';
import { getPrefs, savePrefs, listMaps, clearAllMaps, restoreSeedMaps, THEMES } from '../lib/storage';
import { getUserId } from '../lib/identity';
import { api } from '../lib/api';

export default function Settings() {
  const [prefs, setPrefs] = useState(getPrefs);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [mapsCount, setMapsCount] = useState(0);
  const [notice, setNotice] = useState(null);
  const userId = getUserId();

  useEffect(() => {
    let cancelled = false;
    api.health().then((result) => {
      if (!cancelled) setHealth(result);
    });
    setMapsCount(listMaps().length);
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch) => {
    const next = savePrefs(patch);
    setPrefs(next);
  };

  const deepCheck = async () => {
    setChecking(true);
    try {
      const res = await api.healthAi();
      setHealth((prev) => ({
        ...(prev || {}),
        ai: res || { ok: false, reason: 'Engine unreachable' },
        database: res?.database || prev?.database
      }));
    } finally {
      setChecking(false);
    }
  };

  const handleDeleteAll = () => {
    if (!confirm('Delete every saved map in this browser? This cannot be undone.')) return;
    clearAllMaps();
    setMapsCount(0);
    setNotice('All saved maps deleted.');
  };

  const handleRestoreSeeds = () => {
    const maps = restoreSeedMaps();
    setMapsCount(maps.length);
    setNotice('Reference library restored. Your own maps were left untouched.');
  };

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10 bg-[var(--color-bg)] text-left">
      <div className="max-w-[680px] mx-auto space-y-9">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl sm:text-[34px] font-bold text-[var(--color-text)]">
            Accessibility & Engine Settings
          </h1>
          <p className="text-[15px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
            Customise sensory palettes, dyslexia fonts, ADHD focus tools, and ultra-fast AI engine connections.
          </p>
        </header>

        {/* 1. Sensory Overlays & Themes */}
        <section className="space-y-4">
          <span className="kicker block">Sensory Color Palettes (Scotopic & Visual Comfort)</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Theme palette">
            {[
              { id: 'broadsheet', name: 'Broadsheet Light', hint: 'Editorial neutral grey (#F3F2F2)' },
              { id: 'cream', name: 'Warm Parchment', hint: 'Anti-glare warm cream for visual stress' },
              { id: 'pastel', name: 'Calming Blue', hint: 'Low-stimulus soothing blue for ADHD' },
              { id: 'sage', name: 'Muted Sage Green', hint: 'Restful muted green ground' },
              { id: 'velvet', name: 'Velvet Dark', hint: 'Deep dark background (#18181A)' },
              { id: 'contrast', name: 'High Contrast Yellow/Black', hint: 'Maximum readability & bold accents' }
            ].map((theme) => {
              const isSelected = (prefs.theme || 'broadsheet') === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => update({ theme: theme.id })}
                  className={`p-3 rounded-[var(--radius-md)] text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--color-surface)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                      : 'bg-transparent border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-[var(--color-text)]">
                      {theme.name}
                    </span>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]"></span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] mt-0.5">
                    {theme.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Reading & Typography */}
        <section className="space-y-5 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker block">Dyslexia & Typography Preferences</span>

          {/* Typeface Choice */}
          <div className="space-y-2">
            <label className="block text-[14.5px] font-semibold text-[var(--color-text)]">
              Dyslexia-Optimized Typeface
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Typeface">
              {[
                { value: 'serif', label: 'Source Serif 4', hint: 'Balanced editorial serif' },
                { value: 'lexend', label: 'Lexend Reading Font', hint: 'Clinically proven reading speed font' },
                { value: 'hyper', label: 'Atkinson Hyperlegible', hint: 'Braille Institute low-vision design' },
                { value: 'dyslexic', label: 'Dyslexia Hybrid Stack', hint: 'Heavy baseline to reduce letter flips' },
                { value: 'system', label: 'System Clean Sans', hint: 'Modern system sans-serif' }
              ].map((opt) => {
                const isSelected = prefs.font === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => update({ font: opt.value })}
                    className={`p-2.5 rounded-[var(--radius-md)] text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                        : 'bg-transparent text-[var(--color-text)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    <span className="block text-[13.5px] font-bold">{opt.label}</span>
                    <span className={`block text-[11px] mt-0.5 ${isSelected ? 'opacity-85' : 'opacity-65'}`}>
                      {opt.hint}
                    </span>
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
                { value: 'comfortable', label: 'Comfortable (17.6px)' },
                { value: 'large', label: 'Large (19.5px)' }
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

          {/* Typography Spacing */}
          <div className="space-y-2">
            <label className="block text-[14.5px] font-semibold text-[var(--color-text)]">
              Line & Letter Spacing
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Spacing scale">
              {[
                { value: 'normal', label: 'Standard' },
                { value: 'relaxed', label: 'Relaxed (+0.035em)' },
                { value: 'spacious', label: 'Spacious (+0.06em, 2.0 Line Height)' }
              ].map((opt) => {
                const isSelected = (prefs.spacing || 'normal') === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => update({ spacing: opt.value })}
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

          {/* Bionic Reading & Reading Ruler Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)]">
              <div>
                <span className="block text-[14px] font-bold text-[var(--color-text)]">
                  Bionic Syllable Fixation
                </span>
                <span className="block text-[12px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                  Bolds first letters of words to guide eye fixations and speed comprehension
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.bionicReading !== false}
                onChange={(e) => update({ bionicReading: e.target.checked })}
                className="h-5 w-5 rounded accent-[var(--color-accent)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)]">
              <div>
                <span className="block text-[14px] font-bold text-[var(--color-text)]">
                  ADHD Reading Ruler / Focus Guide
                </span>
                <span className="block text-[12px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                  Highlights active reading line and masks peripheral distractions (Toggle with Alt+H)
                </span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(prefs.readingRuler)}
                onChange={(e) => update({ readingRuler: e.target.checked })}
                className="h-5 w-5 rounded accent-[var(--color-accent)] cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* 3. Fast Engine & Database Section */}
        <section className="space-y-4 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker block">AI Engine Speed & Database Persistence</span>

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
              <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Database Persistence</dt>
              <dd className="font-semibold text-right">
                <span className="text-[var(--color-accent-700)]">
                  MongoDB {health?.database?.connected ? '(Connected & Synced)' : '(Local Storage Fallback)'}
                </span>
              </dd>
            </div>

            <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
              <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Active Fast Model Chain</dt>
              <dd className="font-semibold text-right">
                {health?.aiConfigured ? (
                  <span className="text-[var(--color-accent-700)]">
                    OpenRouter (Gemini 2.0 Flash / 2.5 Flash / Llama 3.3 / Claude 3.5)
                  </span>
                ) : (
                  <span className="text-[#edbb00]">Set OPENROUTER_API_KEY in .env</span>
                )}
              </dd>
            </div>

            {health?.ai && (
              <div className="flex justify-between py-1.5 border-b border-[var(--color-divider)]">
                <dt className="text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Latency Test</dt>
                <dd className="font-semibold text-right">
                  {health.ai.ok ? (
                    <span className="text-[var(--color-accent-700)]">
                      Ultra-Fast Response · {health.ai.provider} ({health.ai.model})
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
            {checking ? 'Testing round-trip latency…' : 'Test AI Round-Trip Latency'}
          </button>
        </section>

        {/* 4. Your Data Section */}
        <section className="space-y-3 pt-4 border-t border-[var(--color-divider)]">
          <span className="kicker kicker-magenta block">Storage & Data Management</span>
          <p className="text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
            {mapsCount} mind map{mapsCount === 1 ? '' : 's'} and all uploaded files stored securely.
          </p>

          <div className="flex items-center justify-between gap-3 p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-sm)] text-[12.5px]">
            <span className="text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">
              Client Anonymous ID
            </span>
            <code className="font-mono text-[11.5px] text-[var(--color-text)]">{userId}</code>
          </div>

          {notice && (
            <p
              role="status"
              className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--color-accent-100)] border border-[var(--color-accent-300)] text-[13px] text-[var(--color-accent-900)]"
            >
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button onClick={handleRestoreSeeds} className="btn btn-secondary !min-h-[36px] text-[13px]">
              <i className="ph-duotone ph-arrow-counter-clockwise"></i>
              Restore reference library
            </button>
            <button onClick={handleDeleteAll} className="btn btn-destructive !min-h-[36px] text-[13px]">
              Delete all saved maps
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
