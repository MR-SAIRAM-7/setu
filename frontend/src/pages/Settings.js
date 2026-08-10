import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, ShieldCheck, Cpu } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState({
    memory: {
      preferredTone: 'Calm & Direct',
      targetReadingLevel: 'Grade 6.0 (Plain Language)',
      reducedMotion: true,
      sensoryCalmDefault: false,
      fontFamily: 'Atkinson Hyperlegible'
    },
    bionic: {
      intensity: 0.5,
      enabled: true
    },
    focus: {
      hideAds: true,
      hideSidebars: true,
      hideComments: true
    },
    tts: {
      rate: 1.0,
      highlightWords: true
    }
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.chrome && window.chrome.storage) {
          const result = await window.chrome.storage.sync.get(['nbSettings']);
          if (result.nbSettings) {
            setSettings(result.nbSettings);
          }
        }
      } catch (error) {
        console.log('Storage unavailable, using local memory');
      }
    };
    loadSettings();
  }, []);

  const handleChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setSaved(false);
  };

  const saveSettings = async () => {
    try {
      if (window.chrome && window.chrome.storage) {
        await window.chrome.storage.sync.set({ nbSettings: settings });
      }
      localStorage.setItem('nbSettings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.log('Could not save settings');
    }
  };

  return (
    <div className="settings">
      <header className="settings-header">
        <h1>Personal Accessibility Memory</h1>
        <p>Your tone, reading level, and sensory preferences persist seamlessly across all 7 modes.</p>
      </header>

      {/* Memory Profile */}
      <section className="settings-section">
        <h2>🧠 Accessibility Profile & Tone Memory</h2>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-info">
              <label>AI Co-pilot Tone</label>
              <p>How NeuroBridge One speaks when delivering instructions and plans</p>
            </div>
            <select 
              value={settings.memory.preferredTone}
              onChange={(e) => handleChange('memory', 'preferredTone', e.target.value)}
              className="setting-input"
            >
              <option value="Calm & Direct">Calm & Direct (No pressure)</option>
              <option value="Encouraging & Warm">Encouraging & Warm</option>
              <option value="Ultra-Short & Bulleted">Ultra-Short & Bulleted</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Target Reading Level</label>
              <p>Simplification threshold for text processing</p>
            </div>
            <select 
              value={settings.memory.targetReadingLevel}
              onChange={(e) => handleChange('memory', 'targetReadingLevel', e.target.value)}
              className="setting-input"
            >
              <option value="Grade 6.0 (Plain Language)">Grade 6.0 (Plain Language - WCAG AAA)</option>
              <option value="Grade 8.0 (Standard)">Grade 8.0 (Standard)</option>
              <option value="Original Unaltered">Original Unaltered</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Typography Preference</label>
              <p>Accessible typeface designed for low vision and dyslexic readers</p>
            </div>
            <select 
              value={settings.memory.fontFamily}
              onChange={(e) => handleChange('memory', 'fontFamily', e.target.value)}
              className="setting-input"
            >
              <option value="Atkinson Hyperlegible">Atkinson Hyperlegible (Braille Institute)</option>
              <option value="Lexend">Lexend (Fluent Reading)</option>
              <option value="System Default">System Default</option>
            </select>
          </div>
        </div>
      </section>

      {/* Sensory & Reading Assistance */}
      <section className="settings-section">
        <h2>🌱 Sensory & Motion Rules</h2>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-info">
              <label>Reduced Motion Default</label>
              <p>Suppress UI animations and transitions by default</p>
            </div>
            <input 
              type="checkbox"
              checked={settings.memory.reducedMotion}
              onChange={(e) => handleChange('memory', 'reducedMotion', e.target.checked)}
              className="setting-checkbox"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Bionic Reading Bold Intensity</label>
              <p>Adjust visual anchor strength</p>
            </div>
            <input 
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              value={settings.bionic.intensity}
              onChange={(e) => handleChange('bionic', 'intensity', parseFloat(e.target.value))}
              className="setting-slider"
            />
          </div>
        </div>
      </section>

      <div className="settings-actions">
        <button className="save-btn" onClick={saveSettings}>
          <Save size={18} />
          <span>Save Preferences</span>
        </button>
        {saved && <span className="saved-indicator"><ShieldCheck size={16} /> Saved to Local Memory!</span>}
      </div>
    </div>
  );
};

export default Settings;
