import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEMES = [
  { id: 'default', label: 'Light', color: '#fdfcfa', icon: '☀️' },
  { id: 'sepia', label: 'Sepia', color: '#fef3c7', icon: '📜' },
  { id: 'dark', label: 'Dark', color: '#0f172a', icon: '🌙' },
  { id: 'high-contrast', label: 'High Contrast', color: '#000000', icon: '🔲' },
  { id: 'dyslexia', label: 'Dyslexia', color: '#fde68a', icon: '🔤' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('setu_theme') || 'default'; } catch { return 'default'; }
  });
  const [sensoryCalmMode, setSensoryCalmState] = useState(() => {
    try { return localStorage.getItem('setu_sensory_calm') === 'true'; } catch { return false; }
  });

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem('setu_theme', t); } catch {}
  }, []);

  const setSensoryCalmMode = useCallback((v) => {
    setSensoryCalmState(v);
    try { localStorage.setItem('setu_sensory_calm', String(v)); } catch {}
  }, []);

  useEffect(() => {
    const body = document.body;
    // Remove old theme classes
    body.classList.remove('theme-default', 'theme-sepia', 'theme-dark', 'theme-high-contrast', 'theme-dyslexia');
    if (theme !== 'default') {
      body.classList.add(`theme-${theme}`);
    }
    // Sensory calm
    body.classList.toggle('sensory-calm', sensoryCalmMode);
  }, [theme, sensoryCalmMode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, sensoryCalmMode, setSensoryCalmMode, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
