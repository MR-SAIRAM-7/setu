import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Brain, 
  Settings, 
  BarChart3, 
  Info, 
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react';
import './Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('default');
  const [sensoryCalm, setSensoryCalm] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    if (sensoryCalm) {
      document.body.classList.add('nb-sensory-calm');
    } else {
      document.body.classList.remove('nb-sensory-calm');
    }
  }, [theme, sensoryCalm]);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: '7-Mode Workspace' },
    { path: '/statistics', icon: BarChart3, label: 'Trust & Load Ledger' },
    { path: '/settings', icon: Settings, label: 'Accessibility Memory' },
    { path: '/about', icon: Info, label: 'Platform Vision' },
  ];

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="mobile-logo">
          <Brain size={24} color="#2563eb" />
          <span>NeuroBridge One</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-badge">⌁</div>
            <div className="logo-text">
              <h1>NeuroBridge One</h1>
              <span className="subtext">powered by SETU</span>
            </div>
          </div>
        </div>

        {/* Sensory Calm Quick Toggle */}
        <div className="sensory-quick-box">
          <label className="sensory-toggle-label">
            <input 
              type="checkbox" 
              checked={sensoryCalm}
              onChange={(e) => setSensoryCalm(e.target.checked)}
            />
            <span className="slider"></span>
            <span className="sensory-text">🌱 Sensory Calm Mode</span>
          </label>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Theme Picker */}
        <div className="sidebar-theme-box">
          <span className="theme-label">Interface Theme:</span>
          <div className="theme-picker-dots">
            <button className={`dot default ${theme === 'default' ? 'active' : ''}`} onClick={() => setTheme('default')} title="Light Theme" />
            <button className={`dot sepia ${theme === 'sepia' ? 'active' : ''}`} onClick={() => setTheme('sepia')} title="Sepia Warmth" />
            <button className={`dot dark ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark Obsidian" />
            <button className={`dot high-contrast ${theme === 'high-contrast' ? 'active' : ''}`} onClick={() => setTheme('high-contrast')} title="High Contrast AAA" />
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="version">NeuroBridge v2.5.0</div>
          <div className="tagline">Cognitive Accessibility Layer</div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
