import { useEffect, useState, useRef } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import MindMapChat from './pages/MindMapChat';
import Library from './pages/Library';
import Modes from './pages/Modes';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import CommandPalette from './components/CommandPalette';
import BreakDialog from './components/BreakDialog';
import { api } from './lib/api';
import { applyPrefs, getPrefs } from './lib/storage';

export default function App() {
  useEffect(() => {
    applyPrefs();
  }, []);

  return (
    <HashRouter>
      <AppRoot />
    </HashRouter>
  );
}

function AppRoot() {
  const location = useLocation();
  const isLandingOrOnboarding =
    location.pathname === '/landing' || location.pathname === '/onboarding';

  // Global Command Palette & Focus Session States
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);

  // 25-minute focus session timer state (1500 seconds)
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const timerRef = useRef(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus Timer interval
  useEffect(() => {
    if (focusRunning) {
      timerRef.current = setInterval(() => {
        setFocusSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setFocusRunning(false);
            setBreakOpen(true);
            return 25 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [focusRunning]);

  const toggleFocus = () => setFocusRunning((prev) => !prev);
  const resetFocus = () => {
    setFocusRunning(false);
    setFocusSeconds(25 * 60);
  };

  const handleBreakKeepGoing = () => {
    setBreakOpen(false);
    setFocusSeconds(25 * 60);
    setFocusRunning(true);
  };

  const handleBreakTakeFive = () => {
    setBreakOpen(false);
    setFocusSeconds(5 * 60);
    setFocusRunning(true);
  };

  return (
    <>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/*"
          element={
            <Shell
              onOpenPalette={() => setPaletteOpen(true)}
              focusSeconds={focusSeconds}
              focusRunning={focusRunning}
              onToggleFocus={toggleFocus}
              onResetFocus={resetFocus}
            >
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/mindmap" element={<MindMapChat />} />
                <Route path="/library" element={<Library />} />
                <Route path="/modes" element={<Modes />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onStartFocus={() => {
          setFocusRunning(true);
          setPaletteOpen(false);
        }}
      />

      <BreakDialog
        isOpen={breakOpen}
        onKeepGoing={handleBreakKeepGoing}
        onTakeFive={handleBreakTakeFive}
      />
    </>
  );
}

function RootRedirect() {
  const prefs = getPrefs();
  if (!prefs.onboardingDone) {
    return <Navigate to="/landing" replace />;
  }
  return <Navigate to="/mindmap" replace />;
}

const NAV = [
  { to: '/mindmap', label: 'Mind Map', icon: 'ph-graph', hint: 'Ask anything, get a map' },
  { to: '/library', label: 'Library', icon: 'ph-books', hint: 'Your saved maps' },
  { to: '/modes', label: 'Modes', icon: 'ph-squares-four', hint: 'Seven cognitive tools' },
  { to: '/settings', label: 'Settings', icon: 'ph-gear', hint: 'Reading preferences' }
];

function Shell({
  children,
  onOpenPalette,
  focusSeconds,
  focusRunning,
  onToggleFocus,
  onResetFocus
}) {
  const [engine, setEngine] = useState('checking');
  const [dbState, setDbState] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const health = await api.health();
      if (cancelled) return;
      if (!health) {
        setEngine('down');
      } else {
        setEngine(health.aiConfigured ? 'ok' : 'nokey');
        setDbState(health.database);
      }
    };

    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] font-[var(--font-body)]">
      <a href="#main" className="sr-only-focusable btn-primary z-50 m-2">
        Skip to content
      </a>

      {/* ----------------- Broadsheet Sidebar (236px fixed) ----------------- */}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col bg-[var(--color-surface)] transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-[var(--color-divider)] flex items-center justify-between">
          <div>
            <span className="font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text)] tracking-tight block">
              SETU
            </span>
            <span className="kicker block text-[10px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] mt-0.5">
              Sanctuary
            </span>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            className="lg:hidden btn btn-quiet !min-h-[28px] !px-1.5"
            aria-label="Close sidebar"
          >
            <i className="ph-duotone ph-x text-base"></i>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 space-y-1 py-4 pr-3 pl-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 pl-4 pr-3 rounded-r-[var(--radius-md)] transition-colors ${
                  isActive
                    ? 'bg-[var(--color-bg)] text-[var(--color-text)] font-semibold border-l-[3.5px] border-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[color-mix(in_srgb,var(--color-text)_72%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-bg)_60%,transparent)] hover:text-[var(--color-text)] border-l-[3.5px] border-transparent'
                }`
              }
            >
              <i className={`ph-duotone ${item.icon} text-lg text-[var(--color-accent)] shrink-0`}></i>
              <div className="min-w-0 text-left">
                <span className="block text-[14px] leading-tight font-semibold">
                  {item.label}
                </span>
                <span className="block text-[11px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] truncate mt-0.5">
                  {item.hint}
                </span>
              </div>
            </NavLink>
          ))}
        </div>

        {/* Command Palette Trigger */}
        <div className="px-3 pb-3">
          <button
            onClick={onOpenPalette}
            className="w-full flex items-center justify-between gap-2 p-2 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-bg)] text-[12.5px] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-700)] transition-colors cursor-pointer"
            aria-label="Open command palette"
          >
            <div className="flex items-center gap-2">
              <i className="ph-duotone ph-magnifying-glass text-base text-[var(--color-accent)]"></i>
              <span className="font-semibold">Do anything</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-divider)] bg-[var(--color-surface)] font-mono text-[10px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Focus Session Widget */}
        <div className="p-3 border-t border-[var(--color-divider)] space-y-2 text-left bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)]">
          <div className="flex items-center justify-between">
            <span className="kicker text-[9.5px]">Focus Session</span>
            <span
              className={`font-mono text-[18px] font-bold ${
                focusRunning
                  ? 'text-[var(--color-accent)]'
                  : 'text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]'
              }`}
            >
              {formatTime(focusSeconds)}
            </span>
          </div>

          <p className="text-[11px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] leading-tight">
            {focusRunning
              ? 'Active · 25 min timer'
              : focusSeconds < 25 * 60
                ? 'Session paused'
                : '25 min focus interval'}
          </p>

          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={onToggleFocus}
              className={`btn flex-1 !min-h-[28px] !py-1 text-[12px] ${
                focusRunning ? 'btn-secondary' : 'btn-primary'
              }`}
            >
              {focusRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={onResetFocus}
              className="btn btn-quiet !min-h-[28px] !px-2"
              title="Reset focus clock"
              aria-label="Reset focus clock"
            >
              <i className="ph-duotone ph-arrow-counter-clockwise text-sm"></i>
            </button>
          </div>
        </div>

        {/* Engine & MongoDB Status Badge */}
        <div className="border-t border-[var(--color-divider)] p-3 bg-[var(--color-surface)]">
          <EngineBadge state={engine} dbState={dbState} />
        </div>
      </nav>

      {/* Mobile Backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(32,30,29,0.4)] backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      {/* ----------------- Main Workspace ----------------- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between p-3 border-b border-[var(--color-divider)] bg-[var(--color-surface)]">
          <button
            onClick={() => setNavOpen(true)}
            className="btn btn-ghost !min-h-[34px] !px-2.5 text-xs font-semibold"
            aria-label="Open menu"
          >
            <i className="ph-duotone ph-list text-base"></i>
            Menu
          </button>
          <span className="font-[var(--font-heading)] font-bold text-base text-[var(--color-text)]">
            SETU Sanctuary
          </span>
          <button
            onClick={onOpenPalette}
            className="btn btn-quiet !min-h-[34px] !px-2"
            aria-label="Search"
          >
            <i className="ph-duotone ph-magnifying-glass text-lg"></i>
          </button>
        </div>

        <main id="main" className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function EngineBadge({ state, dbState }) {
  const configs = {
    checking: {
      dot: 'bg-slate-400',
      label: 'Checking engine…'
    },
    ok: {
      dot: 'bg-[var(--color-accent)]',
      label: dbState?.connected ? 'Engine & DB ready' : 'Engine ready'
    },
    nokey: {
      dot: 'bg-[#edbb00]',
      label: 'No AI key set'
    },
    down: {
      dot: 'bg-[var(--color-accent-2)]',
      label: 'Engine offline'
    }
  }[state] || { dot: 'bg-slate-400', label: 'Engine offline' };

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-bg)] text-[11px] font-semibold text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]"
      title={
        state === 'down'
          ? 'Start the backend: npm start in /backend'
          : state === 'nokey'
            ? 'Set GEMINI_API_KEY in your .env file'
            : dbState?.connected
              ? 'Connected to Gemini and MongoDB'
              : 'Connected to Gemini with local storage fallback'
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${configs.dot} ${
          state === 'ok' ? 'animate-setu-breathe' : ''
        }`}
      />
      <span className="truncate">{configs.label}</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid h-full place-items-center p-8 text-center bg-[var(--color-bg)]">
      <div className="space-y-4 max-w-sm">
        <i className="ph-duotone ph-warning-circle text-4xl text-[var(--color-accent-2)]"></i>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Page not found</h1>
        <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
          The link or screen you requested is not available.
        </p>
        <NavLink to="/mindmap" className="btn btn-primary text-sm inline-flex">
          Back to Mind Map
        </NavLink>
      </div>
    </div>
  );
}
