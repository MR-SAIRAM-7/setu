import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import {
  Type, Eye, BookOpen, ScrollText, Volume2, Ruler, Focus, Palette,
  Play, Pause, RotateCcw, Leaf, Sun, Moon, Contrast, ChevronDown
} from 'lucide-react';

const SAMPLE_TEXT = `The human brain processes visual information in a remarkably complex way. When reading text on a screen, our eyes don't move smoothly — they make rapid jumps called saccades, landing on specific fixation points. For people with dyslexia, these fixation points can be unreliable, causing words to appear to jump, swap, or blur together.

Attention Deficit Hyperactivity Disorder (ADHD) adds another layer of complexity. The prefrontal cortex, responsible for executive function and sustained attention, operates differently in ADHD brains. This makes it extraordinarily difficult to maintain focus on dense blocks of text, especially when surrounded by the visual noise of modern web interfaces — advertisements, pop-ups, notification badges, and competing calls to action.

Research from the International Dyslexia Association shows that approximately 15-20% of the population has some form of language-based learning disability. Combined with ADHD prevalence rates of 5-7% in children and 2.5-4% in adults, the number of people who struggle with conventional digital reading interfaces is staggering.

Bionic Reading addresses this by bolding the initial fixation points of each word, creating visual anchors that guide the eye along the text more efficiently. Line rulers provide a horizontal reference point that prevents line skipping — a common issue where the reader's gaze drifts to the wrong line. OpenDyslexic font uses weighted bottoms on letters to reduce the visual rotation and mirroring that dyslexic readers often experience.

These aren't just convenience features — they are bridges to information equality. When 70% of websites fail basic accessibility audits, tools like these transform the web from an obstacle course into an open highway.`;

function applyBionic(text) {
  return text.split(' ').map((word, i) => {
    if (word.length <= 1) return word + ' ';
    const mid = Math.ceil(word.length / 2);
    return (
      <span key={i}>
        <strong className="font-bold">{word.slice(0, mid)}</strong>
        <span className="font-normal">{word.slice(mid)}</span>{' '}
      </span>
    );
  });
}

export default function Playground() {
  const { theme, setTheme, sensoryCalmMode, setSensoryCalmMode, THEMES } = useTheme();
  const [bionic, setBionic] = useState(false);
  const [ruler, setRuler] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [wpm, setWpm] = useState(240);
  const [ttsActive, setTtsActive] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const [rulerY, setRulerY] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);

  const previewRef = useRef(null);
  const scrollInterval = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && previewRef.current) {
      const pxPerSecond = (wpm / 60) * 12;
      scrollInterval.current = setInterval(() => {
        if (previewRef.current) {
          previewRef.current.scrollTop += pxPerSecond / 30;
        }
      }, 1000 / 30);
    }
    return () => { if (scrollInterval.current) clearInterval(scrollInterval.current); };
  }, [autoScroll, wpm]);

  // Line ruler tracking
  const handleMouseMove = useCallback((e) => {
    if (ruler && previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      setRulerY(e.clientY - rect.top);
    }
  }, [ruler]);

  // TTS
  const toggleTTS = () => {
    if (ttsActive) {
      window.speechSynthesis.cancel();
      setTtsActive(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(SAMPLE_TEXT);
      utterance.rate = ttsRate;
      utterance.onend = () => setTtsActive(false);
      window.speechSynthesis.speak(utterance);
      setTtsActive(true);
    }
  };

  const resetAll = () => {
    setBionic(false); setRuler(false); setDyslexiaFont(false); setAutoScroll(false);
    setWpm(240); setTtsRate(1); setFontSize(18); setLineHeight(1.8);
    window.speechSynthesis.cancel(); setTtsActive(false);
    if (previewRef.current) previewRef.current.scrollTop = 0;
  };

  const toggles = [
    { key: 'bionic', label: 'Bionic Reading', desc: 'Bold word anchors', icon: Type, active: bionic, toggle: () => setBionic(!bionic), color: 'amber', shortcut: 'Alt+B' },
    { key: 'ruler', label: 'Line Ruler', desc: 'Horizontal guide', icon: Ruler, active: ruler, toggle: () => setRuler(!ruler), color: 'blue', shortcut: 'Alt+H' },
    { key: 'dyslexia', label: 'Dyslexia Font', desc: 'OpenDyslexic', icon: BookOpen, active: dyslexiaFont, toggle: () => setDyslexiaFont(!dyslexiaFont), color: 'purple' },
    { key: 'autoScroll', label: 'Auto Scroll', desc: `${wpm} WPM`, icon: ScrollText, active: autoScroll, toggle: () => setAutoScroll(!autoScroll), color: 'green', shortcut: 'Alt+S' },
    { key: 'tts', label: 'Text to Speech', desc: ttsActive ? 'Speaking...' : 'Read aloud', icon: Volume2, active: ttsActive, toggle: toggleTTS, color: 'teal', shortcut: 'Alt+T' },
    { key: 'calm', label: 'Sensory Calm', desc: 'Reduce stimuli', icon: Leaf, active: sensoryCalmMode, toggle: () => setSensoryCalmMode(!sensoryCalmMode), color: 'emerald' },
  ];

  const colorMap = { amber: 'bg-amber-500', blue: 'bg-blue-500', purple: 'bg-purple-500', green: 'bg-green-500', teal: 'bg-teal-500', emerald: 'bg-emerald-500' };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Accessibility Playground</h1>
            <p className="text-gray-500 mt-1">Toggle features and see the effect in real-time</p>
          </div>
          <button onClick={resetAll} className="setu-btn-secondary text-sm">
            <RotateCcw className="w-4 h-4" /> Reset All
          </button>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Controls Panel */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Toggle Cards */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Reading Supports</h3>
            <div className="space-y-2">
              {toggles.map(t => (
                <button key={t.key} onClick={t.toggle}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 min-h-[52px] ${
                    t.active
                      ? 'bg-sage-50 border border-sage-200 shadow-sm'
                      : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    t.active ? `${colorMap[t.color]} text-white` : 'bg-gray-200 text-gray-500'
                  }`}>
                    <t.icon className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <span className={`block text-sm font-semibold ${t.active ? 'text-sage-800' : 'text-gray-700'}`}>{t.label}</span>
                    <span className="block text-[11px] text-gray-400">{t.desc}</span>
                  </div>
                  {t.shortcut && <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.shortcut}</span>}
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${t.active ? 'bg-sage-500' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${t.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fine Tuning</h3>
            {autoScroll && (
              <div>
                <label className="text-sm font-medium text-gray-700 flex justify-between">
                  <span>Reading Speed</span><span className="text-sage-600 font-bold">{wpm} WPM</span>
                </label>
                <input type="range" min="60" max="600" step="20" value={wpm} onChange={e => setWpm(+e.target.value)}
                  className="w-full mt-1 accent-sage-500" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 flex justify-between">
                <span>Font Size</span><span className="text-sage-600 font-bold">{fontSize}px</span>
              </label>
              <input type="range" min="14" max="28" step="1" value={fontSize} onChange={e => setFontSize(+e.target.value)}
                className="w-full mt-1 accent-sage-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 flex justify-between">
                <span>Line Height</span><span className="text-sage-600 font-bold">{lineHeight.toFixed(1)}</span>
              </label>
              <input type="range" min="1.2" max="2.4" step="0.1" value={lineHeight} onChange={e => setLineHeight(+e.target.value)}
                className="w-full mt-1 accent-sage-500" />
            </div>
            {ttsActive && (
              <div>
                <label className="text-sm font-medium text-gray-700 flex justify-between">
                  <span>Speech Rate</span><span className="text-sage-600 font-bold">{ttsRate}x</span>
                </label>
                <input type="range" min="0.5" max="2" step="0.1" value={ttsRate} onChange={e => setTtsRate(+e.target.value)}
                  className="w-full mt-1 accent-sage-500" />
              </div>
            )}
          </div>

          {/* Theme Selector */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Theme</h3>
            <div className="flex gap-2">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                  className={`w-9 h-9 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center text-sm ${
                    theme === t.id ? 'border-sage-500 scale-110 shadow-sm' : 'border-gray-200'
                  }`} style={{ backgroundColor: t.color }}>
                  {t.icon}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Preview Panel */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-soft overflow-hidden relative"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-400 font-mono ml-2">preview://setu-playground</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {bionic && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Bionic</span>}
              {ruler && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Ruler</span>}
              {dyslexiaFont && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Dyslexic</span>}
              {autoScroll && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{wpm} WPM</span>}
            </div>
          </div>
          <div ref={previewRef} onMouseMove={handleMouseMove}
            className="p-6 lg:p-8 h-[500px] lg:h-[600px] overflow-y-auto relative setu-scrollbar"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily: dyslexiaFont ? "'OpenDyslexic', 'Comic Sans MS', sans-serif" : 'inherit',
              letterSpacing: dyslexiaFont ? '0.05em' : 'inherit',
              wordSpacing: dyslexiaFont ? '0.15em' : 'inherit',
            }}
          >
            {/* Line Ruler */}
            {ruler && (
              <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: rulerY - 16 }}>
                <div className="h-8 bg-blue-500/10 border-y border-blue-400/30" />
              </div>
            )}
            {/* Text Content */}
            <div className="text-gray-700 leading-relaxed">
              {SAMPLE_TEXT.split('\n\n').map((para, idx) => (
                <p key={idx} className="mb-6">
                  {bionic ? applyBionic(para) : para}
                </p>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
