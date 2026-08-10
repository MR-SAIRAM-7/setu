import React, { useState } from 'react';
import { 
  Rocket, 
  Sparkles, 
  Brain, 
  Mic, 
  MessageSquare, 
  Edit3, 
  Compass 
} from 'lucide-react';
import StartModePane from '../components/modes/StartModePane';
import SimplifyModePane from '../components/modes/SimplifyModePane';
import LearnModePane from '../components/modes/LearnModePane';
import MeetModePane from '../components/modes/MeetModePane';
import PracticeModePane from '../components/modes/PracticeModePane';
import WriteModePane from '../components/modes/WriteModePane';
import GuideModePane from '../components/modes/GuideModePane';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('start');

  const tabs = [
    { id: 'start', label: 'Start Mode', icon: Rocket, badge: 'Hero Flow' },
    { id: 'simplify', label: 'Simplify Mode', icon: Sparkles },
    { id: 'learn', label: 'Learn Mode', icon: Brain },
    { id: 'meet', label: 'Meet Mode', icon: Mic },
    { id: 'practice', label: 'Practice Mode', icon: MessageSquare },
    { id: 'write', label: 'Write Mode', icon: Edit3 },
    { id: 'guide', label: 'Guide Mode', icon: Compass },
  ];

  return (
    <div className="nb-workspace">
      <header className="workspace-header">
        <div>
          <h1>Unified Cognitive Accessibility Workspace</h1>
          <p>Transform overwhelm into concrete next actions across 7 specialized cognitive modes.</p>
        </div>
      </header>

      {/* Tab Selector */}
      <div className="mode-tabs-grid">
        {tabs.map((t) => (
          <button 
            key={t.id}
            className={`mode-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={18} />
            <span>{t.label}</span>
            {t.badge && <span className="hero-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Modular Mode Component Container */}
      <div className="workspace-content-container">
        {activeTab === 'start' && <StartModePane />}
        {activeTab === 'simplify' && <SimplifyModePane />}
        {activeTab === 'learn' && <LearnModePane />}
        {activeTab === 'meet' && <MeetModePane />}
        {activeTab === 'practice' && <PracticeModePane />}
        {activeTab === 'write' && <WriteModePane />}
        {activeTab === 'guide' && <GuideModePane />}
      </div>
    </div>
  );
};

export default Dashboard;
