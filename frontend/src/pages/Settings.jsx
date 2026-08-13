import React, { useState, useEffect } from 'react';
import { dbService, isSupabaseConfigured } from '../services/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Sliders, Palette, Type, Eye, Database, RotateCcw, Check } from 'lucide-react';

const Settings = () => {
  const { theme, setTheme, sensoryCalmMode, setSensoryCalmMode, THEMES } = useTheme();
  
  const [wpm, setWpm] = useState(240);
  const [font, setFont] = useState('inter');
  const [bionicReading, setBionicReading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    // Load from local storage or DB
    const savedSettings = localStorage.getItem('setu_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setWpm(parsed.wpm || 240);
        setFont(parsed.font || 'inter');
        setBionicReading(parsed.bionicReading || false);
        setReducedMotion(parsed.reducedMotion || false);
        setHighContrast(parsed.highContrast || false);
        setApiUrl(parsed.apiUrl || 'http://localhost:8000');
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const saveSettings = () => {
    const settings = {
      wpm, font, bionicReading, reducedMotion, highContrast, apiUrl
    };
    localStorage.setItem('setu_settings', JSON.stringify(settings));
    
    if (isSupabaseConfigured) {
      dbService.updateProfile({ settings }).catch(console.error);
    }
    
    setSaveStatus('Settings saved successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const resetToDefaults = () => {
    setWpm(240);
    setFont('inter');
    setTheme('theme-default');
    setSensoryCalmMode(false);
    setBionicReading(false);
    setReducedMotion(false);
    setHighContrast(false);
    setApiUrl('http://localhost:8000');
    setSaveStatus('Reset to defaults');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
      <Icon className="text-sage-600" size={24} />
      {title}
    </h3>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 pb-20 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="text-sage-600" size={36} />
          Accessibility Preferences
        </h1>
        <p className="text-xl text-gray-600 mt-2">
          Tailor the SETU experience to your unique cognitive needs.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 md:p-8 space-y-10"
      >
        {/* Profile & Reading */}
        <section>
          <SectionTitle icon={Sliders} title="Reading & Processing" />
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-gray-700 font-medium block">Reading Speed (WPM)</label>
                <span className="bg-sage-100 text-sage-800 px-3 py-1 rounded-full text-sm font-semibold">{wpm} WPM</span>
              </div>
              <input 
                type="range" 
                min="60" 
                max="600" 
                step="10"
                value={wpm} 
                onChange={(e) => setWpm(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sage-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>60 (Slow)</span>
                <span>240 (Average)</span>
                <span>600 (Fast)</span>
              </div>
            </div>
            
            <label className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                checked={bionicReading} 
                onChange={(e) => setBionicReading(e.target.checked)}
                className="w-5 h-5 text-sage-600 rounded focus:ring-sage-500"
              />
              <div>
                <p className="font-medium text-gray-900">Bionic Reading Default</p>
                <p className="text-sm text-gray-500">Automatically apply bolding to word prefixes to guide eye movement.</p>
              </div>
            </label>
          </div>
        </section>

        {/* Theme & Visuals */}
        <section>
          <SectionTitle icon={Palette} title="Theme & Visuals" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.keys(THEMES || {}).map(tKey => {
              const isActive = theme === tKey;
              return (
                <button
                  key={tKey}
                  onClick={() => setTheme(tKey)}
                  className={`p-4 rounded-xl border-2 text-center min-h-[44px] transition-all
                    ${isActive ? 'border-sage-600 bg-sage-50 shadow-md scale-105' : 'border-gray-200 hover:border-sage-300'}`}
                >
                  <div className="h-8 w-full rounded-md mb-2 bg-gradient-to-r from-gray-100 to-gray-200"></div>
                  <span className="font-medium text-sm text-gray-700 capitalize">{tKey.replace('theme-', '')}</span>
                  {isActive && <Check size={16} className="mx-auto mt-1 text-sage-600" />}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors mb-4">
            <input 
              type="checkbox" 
              checked={sensoryCalmMode} 
              onChange={(e) => setSensoryCalmMode(e.target.checked)}
              className="w-5 h-5 text-sage-600 rounded focus:ring-sage-500"
            />
            <div>
              <p className="font-medium text-gray-900">Sensory Calm Mode</p>
              <p className="text-sm text-gray-500">Reduces bright colors, hides unnecessary UI elements, and mutes sensory input.</p>
            </div>
          </label>
        </section>

        {/* Typography */}
        <section>
          <SectionTitle icon={Type} title="Typography" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['inter', 'atkinson', 'opendyslexic'].map(f => (
              <button
                key={f}
                onClick={() => setFont(f)}
                className={`p-4 rounded-xl border-2 text-left min-h-[44px] transition-all
                  ${font === f ? 'border-sage-600 bg-sage-50 shadow-md' : 'border-gray-200 hover:border-sage-300'}`}
              >
                <span className="font-bold text-lg text-gray-800 capitalize block mb-1">
                  {f === 'inter' ? 'Inter' : f === 'atkinson' ? 'Atkinson' : 'OpenDyslexic'}
                </span>
                <span className="text-sm text-gray-500">The quick brown fox jumps over the lazy dog.</span>
              </button>
            ))}
          </div>
        </section>

        {/* Advanced & System */}
        <section>
          <SectionTitle icon={Database} title="System Settings" />
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className={`w-3 h-3 rounded-full ${isSupabaseConfigured ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <p className="font-medium text-gray-900">Supabase Connection</p>
                <p className="text-sm text-gray-500">{isSupabaseConfigured ? 'Connected to cloud sync' : 'Local mode only (No Supabase URL/Key provided)'}</p>
              </div>
            </div>
            
            <div>
              <label className="text-gray-700 font-medium block mb-2">API Server URL</label>
              <input 
                type="text" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="setu-input w-full"
                placeholder="http://localhost:8000"
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t gap-4">
          <button 
            onClick={resetToDefaults}
            className="setu-btn-ghost flex items-center gap-2 w-full sm:w-auto text-gray-500 hover:text-gray-800"
          >
            <RotateCcw size={18} />
            Reset Defaults
          </button>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {saveStatus && <span className="text-sage-600 font-medium text-sm animate-pulse">{saveStatus}</span>}
            <button 
              onClick={saveSettings}
              className="setu-btn-primary w-full sm:w-auto shadow-md"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
