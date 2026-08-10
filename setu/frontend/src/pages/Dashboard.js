import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  BookOpen, 
  Type, 
  Volume2, 
  Sparkles,
  Activity,
  Clock,
  TrendingUp
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    wpm: 0,
    time: 0,
    words: 0,
    sessions: 0
  });

  const [features, setFeatures] = useState([
    { id: 'bionic', name: 'Bionic Reading', icon: Type, active: false, description: 'Bold first half of words' },
    { id: 'focus', name: 'Focus Mode', icon: Eye, active: false, description: 'Remove distractions' },
    { id: 'eye', name: 'Eye Tracking', icon: Activity, active: false, description: 'Hands-free scrolling' },
    { id: 'scroll', name: 'Auto Scroll', icon: TrendingUp, active: false, description: 'Adaptive speed' },
    { id: 'tts', name: 'Text to Speech', icon: Volume2, active: false, description: 'Read aloud' },
    { id: 'highlight', name: 'Word Highlight', icon: Sparkles, active: false, description: 'Guide reading' },
  ]);

  useEffect(() => {
    // Load stats from storage
    const loadStats = async () => {
      try {
        const result = await chrome.storage.local.get(['readingStats']);
        if (result.readingStats) {
          setStats(result.readingStats);
        }
      } catch (error) {
        console.log('Storage not available');
      }
    };

    loadStats();
  }, []);

  const toggleFeature = (featureId) => {
    setFeatures(features.map(f => 
      f.id === featureId ? { ...f, active: !f.active } : f
    ));

    // Send message to extension
    try {
      chrome.runtime.sendMessage({
        action: 'toggleMode',
        mode: featureId,
        enabled: !features.find(f => f.id === featureId).active
      });
    } catch (error) {
      console.log('Extension not available');
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome to your reading assistant</p>
      </header>

      {/* Stats Cards */}
      <section className="stats-section">
        <h2>Your Reading Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Activity size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.wpm || 200}</span>
              <span className="stat-label">Avg WPM</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.time || 0}m</span>
              <span className="stat-label">Reading Time</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <BookOpen size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.words || 0}</span>
              <span className="stat-label">Words Read</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.sessions || 0}</span>
              <span className="stat-label">Sessions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Features */}
      <section className="features-section">
        <h2>Quick Features</h2>
        <div className="features-grid">
          {features.map(feature => (
            <button
              key={feature.id}
              className={`feature-card ${feature.active ? 'active' : ''}`}
              onClick={() => toggleFeature(feature.id)}
            >
              <div className="feature-header">
                <feature.icon size={24} />
                <div className={`feature-toggle ${feature.active ? 'active' : ''}`}>
                  <div className="toggle-dot"></div>
                </div>
              </div>
              <div className="feature-info">
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tips Section */}
      <section className="tips-section">
        <h2>💡 Tips for Better Reading</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <span className="tip-icon">👁️</span>
            <h3>Use Bionic Reading</h3>
            <p>Bolding the first half of words helps your brain process text faster by creating visual anchor points.</p>
          </div>
          
          <div className="tip-card">
            <span className="tip-icon">🎯</span>
            <h3>Enable Focus Mode</h3>
            <p>Remove distractions like ads and sidebars to maintain concentration on the content.</p>
          </div>
          
          <div className="tip-card">
            <span className="tip-icon">📜</span>
            <h3>Try Auto Scroll</h3>
            <p>Let the page scroll automatically at your reading speed for hands-free reading.</p>
          </div>
          
          <div className="tip-card">
            <span className="tip-icon">🎨</span>
            <h3>Find Your Theme</h3>
            <p>Experiment with different color themes to find what works best for your eyes.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <h2>About NeuroRead</h2>
        <div className="about-card">
          <p>
            NeuroRead is designed to make the web more accessible for people with ADHD and Dyslexia. 
            Roughly 1 in 5 people have a learning difference, and we're here to help.
          </p>
          <div className="about-stats">
            <div className="about-stat">
              <span className="about-stat-value">6</span>
              <span className="about-stat-label">Reading Modes</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value">4</span>
              <span className="about-stat-label">Color Themes</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value">∞</span>
              <span className="about-stat-label">Websites</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
