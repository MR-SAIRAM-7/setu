import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Sparkles, Brain, Mic, MessageSquare, PenTool, Compass, X } from 'lucide-react';

import StartMode from '../components/modes/StartMode';
import SimplifyMode from '../components/modes/SimplifyMode';
import LearnMode from '../components/modes/LearnMode';
import MeetMode from '../components/modes/MeetMode';
import PracticeMode from '../components/modes/PracticeMode';
import WriteMode from '../components/modes/WriteMode';
import GuideMode from '../components/modes/GuideMode';

const MODES = [
  { id: 'start', name: 'Start', description: 'Break the Wall of Awful', icon: Rocket, color: 'bg-amber-100 text-amber-800 border-amber-200', component: StartMode },
  { id: 'simplify', name: 'Simplify', description: 'Plain Language, Zero Jargon', icon: Sparkles, color: 'bg-teal-100 text-teal-800 border-teal-200', component: SimplifyMode },
  { id: 'learn', name: 'Learn', description: 'Mind Maps & Quizzes', icon: Brain, color: 'bg-blue-100 text-blue-800 border-blue-200', component: LearnMode },
  { id: 'meet', name: 'Meet', description: 'Meeting Transcript Rescue', icon: Mic, color: 'bg-violet-100 text-violet-800 border-violet-200', component: MeetMode },
  { id: 'practice', name: 'Practice', description: 'Social Script Rehearsal', icon: MessageSquare, color: 'bg-pink-100 text-pink-800 border-pink-200', component: PracticeMode },
  { id: 'write', name: 'Write', description: 'Accessible Authoring', icon: PenTool, color: 'bg-green-100 text-green-800 border-green-200', component: WriteMode },
  { id: 'guide', name: 'Guide', description: 'Step-by-Step Navigator', icon: Compass, color: 'bg-orange-100 text-orange-800 border-orange-200', component: GuideMode }
];

export default function Sanctuary() {
  const [activeMode, setActiveMode] = useState(null);

  return (
    <div className="min-h-screen p-6 md:p-12 transition-colors duration-300">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Your Cognitive Sanctuary</h1>
        <p className="text-lg opacity-80">Select a mode below to help with your current task.</p>
      </header>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode?.id === mode.id;
          return (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveMode(mode)}
              className={`p-6 rounded-2xl border flex flex-col items-start transition-all min-h-[44px] ${mode.color} ${isActive ? 'ring-2 ring-offset-2 ring-current shadow-md' : 'opacity-90 hover:opacity-100 shadow-sm'}`}
              aria-label={`Activate ${mode.name} mode`}
            >
              <div className="bg-white/50 p-3 rounded-full mb-4">
                <Icon size={24} />
              </div>
              <h2 className="text-xl font-bold mb-1">{mode.name}</h2>
              <p className="text-sm text-left">{mode.description}</p>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeMode && (
          <motion.div
            key={activeMode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6 md:p-8 rounded-3xl shadow-lg relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
          >
            <button 
              onClick={() => setActiveMode(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close mode"
            >
              <X size={20} />
            </button>
            <div className="mb-8 flex items-center gap-4">
               <div className={`p-3 rounded-full ${activeMode.color}`}>
                  <activeMode.icon size={24} />
               </div>
               <div>
                 <h3 className="text-2xl font-bold">{activeMode.name} Workspace</h3>
                 <p className="opacity-70">{activeMode.description}</p>
               </div>
            </div>
            
            <div className="mt-4">
              {React.createElement(activeMode.component)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
