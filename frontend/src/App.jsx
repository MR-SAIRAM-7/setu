import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import MindMapChat from './pages/MindMapChat';
import Library from './pages/Library';
import Modes from './pages/Modes';
import Settings from './pages/Settings';
import { api } from './lib/api';
import { applyPrefs } from './lib/storage';

/**
 * HashRouter is deliberate: the extension hands off to `/#/mindmap?import=…`,
 * and a hash route works from a file:// build and any static host without
 * server rewrite rules.
 */
export default function App() {
  useEffect(() => {
    applyPrefs();
  }, []);

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/mindmap" replace />} />
          <Route path="/mindmap" element={<MindMapChat />} />
          <Route path="/library" element={<Library />} />
          <Route path="/modes" element={<Modes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

const NAV = [
  { to: '/mindmap', label: 'Mind Map', glyph: '◈', hint: 'Ask anything, get a map' },
  { to: '/library', label: 'Library', glyph: '▤', hint: 'Your saved maps' },
  { to: '/modes', label: 'Modes', glyph: '◐', hint: 'Seven cognitive tools' },
  { to: '/settings', label: 'Settings', glyph: '⚙', hint: 'Reading preferences' }
];

function Shell({ children }) {
  const [engine, setEngine] = useState('checking');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const health = await api.health();
      if (cancelled) return;
      setEngine(!health ? 'down' : health.aiConfigured ? 'ok' : 'nokey');
    };

    check();
    const timer = setInterval(check, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main" className="sr-only-focusable btn-primary z-50 m-2">
        Skip to content
      </a>

      {/* -------------------------- sidebar -------------------------- */}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/10
                    bg-ink-950/95 backdrop-blur transition-transform lg:static lg:translate-x-0
                    ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main"
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-iris-500 to-purple-400 text-ink-950">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 17c3-6 6-9 9-9s6 3 9 9" />
              <circle cx="12" cy="8" r="1.7" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <p className="text-[14.5px] font-extrabold leading-tight text-white">SETU</p>
            <p className="text-[10.5px] text-slate-500">Sanctuary</p>
          </div>
        </div>

        <div className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-iris-500/15 text-white ring-1 ring-iris-500/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              <span className="w-4 text-center text-[15px]" aria-hidden>
                {item.glyph}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{item.label}</span>
                <span className="block truncate text-[10.5px] text-slate-500">{item.hint}</span>
              </span>
            </NavLink>
          ))}
        </div>

        <div className="border-t border-white/10 p-3">
          <EngineBadge state={engine} />
        </div>
      </nav>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      {/* --------------------------- main ---------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setNavOpen(true)}
          className="btn-ghost m-3 !min-h-[38px] w-fit lg:hidden"
          aria-label="Open menu"
        >
          ☰ Menu
        </button>
        <main id="main" className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function EngineBadge({ state }) {
  const config = {
    checking: { tone: 'text-slate-500 border-white/10', dot: 'bg-slate-500', label: 'Checking engine…' },
    ok: { tone: 'text-mint-300 border-mint-400/30', dot: 'bg-mint-400', label: 'Engine ready' },
    nokey: { tone: 'text-sun-400 border-sun-400/30', dot: 'bg-sun-400', label: 'No AI key set' },
    down: { tone: 'text-rose-400 border-rose-400/30', dot: 'bg-rose-400', label: 'Engine offline' }
  }[state];

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${config.tone}`}
      title={
        state === 'down'
          ? 'Start the backend: npm start in /backend'
          : state === 'nokey'
            ? 'Set GEMINI_API_KEY in your .env file'
            : undefined
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${state === 'ok' ? 'animate-breathe' : ''}`} />
      {config.label}
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="space-y-3">
        <p className="text-4xl" aria-hidden>◌</p>
        <h1 className="text-lg font-bold">That page doesn't exist</h1>
        <NavLink to="/mindmap" className="btn-primary">
          Back to the mind map
        </NavLink>
      </div>
    </div>
  );
}
