import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Brain, MessageSquare, Palette, BarChart3,
  Settings, Info, Menu, X, Leaf, Sun, Moon, Eye, BookOpen,
  ChevronLeft
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/sanctuary', label: 'Sanctuary', icon: LayoutDashboard, desc: '7-Mode Workspace' },
  { path: '/canvas', label: 'Mind Maps', icon: Brain, desc: 'Visual Knowledge' },
  { path: '/chat', label: 'AI Assistant', icon: MessageSquare, desc: 'Chat & Voice' },
  { path: '/playground', label: 'Playground', icon: Palette, desc: 'Live Demo' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, desc: 'Trust Ledger' },
  { path: '/settings', label: 'Settings', icon: Settings, desc: 'Preferences' },
  { path: '/about', label: 'About', icon: Info, desc: 'Our Vision' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme, sensoryCalmMode, setSensoryCalmMode, THEMES } = useTheme();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-sand-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-[72px]'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center shrink-0 shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <h1 className="font-bold text-gray-900 text-lg leading-tight tracking-tight">SETU</h1>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Cognitive OS</p>
            </motion.div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" aria-label="Toggle sidebar">
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto setu-scrollbar">
          {NAV_ITEMS.map(({ path, label, icon: Icon, desc }) => (
            <NavLink key={path} to={path} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group min-h-[44px] ${
                isActive
                  ? 'bg-sage-50 text-sage-700 font-semibold shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }>
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <span className="block text-sm">{label}</span>
                  <span className="block text-[10px] text-gray-400 font-normal">{desc}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sensory Calm Toggle */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button onClick={() => setSensoryCalmMode(!sensoryCalmMode)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all ${
              sensoryCalmMode ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'
            }`}
            aria-label="Toggle Sensory Calm Mode"
          >
            <Leaf className="w-4 h-4" />
            {sidebarOpen && <span>Sensory Calm</span>}
          </button>
        </div>

        {/* Theme Dots */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Theme</p>
            <div className="flex gap-2">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                    theme === t.id ? 'border-sage-500 scale-110 shadow-sm' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: t.color }}
                  aria-label={`${t.label} theme`}
                />
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Header + Overlay */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200 h-14 flex items-center px-4">
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100" aria-label="Open menu">
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">SETU</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/40 z-50" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-white z-50 flex flex-col shadow-elevated"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center">
                    <Leaf className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-gray-900">SETU</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 py-3 px-2 space-y-1">
                {NAV_ITEMS.map(({ path, label, icon: Icon, desc }) => (
                  <NavLink key={path} to={path} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all min-h-[44px] ${
                        isActive ? 'bg-sage-50 text-sage-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'
                      }`
                    }>
                    <Icon className="w-5 h-5" />
                    <div>
                      <span className="block text-sm">{label}</span>
                      <span className="block text-[10px] text-gray-400">{desc}</span>
                    </div>
                  </NavLink>
                ))}
              </nav>
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex gap-2">
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${theme === t.id ? 'border-sage-500 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: t.color }} />
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto setu-scrollbar lg:pt-0 pt-14">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
