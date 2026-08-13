import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, Compass, CheckCircle2, ChevronRight } from 'lucide-react';

export default function GuideMode() {
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleSubmit = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/guide', { goal });
      setResult(data);
      setActiveStep(0);
    } catch (err) {
      setError('Failed to generate guide.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="guide-input" className="font-semibold text-lg">What is your goal?</label>
        <input
          id="guide-input"
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g., Renew my driver's license, Setup a React project..."
          className="setu-input p-4 w-full rounded-xl border border-gray-200 dark:border-gray-700"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !goal.trim()}
          className="setu-btn bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Compass />} 
          {loading ? 'Navigating...' : 'Create Step-by-Step Guide'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-700 pb-4">
            <div>
              <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">{result.workflowName}</h3>
              <p className="opacity-70 mt-1">{result.totalSteps} Steps Total</p>
            </div>
          </div>
          
          <div className="relative">
            {/* Progress line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700 z-0"></div>
            
            <div className="space-y-6 relative z-10">
              {result.steps?.map((step, index) => {
                const isActive = index === activeStep;
                const isCompleted = index < activeStep;
                
                return (
                  <div 
                    key={index} 
                    className={`flex gap-4 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                    onClick={() => setActiveStep(index)}
                  >
                    <div className="shrink-0 pt-1 cursor-pointer">
                       {isCompleted ? (
                         <div className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
                           <CheckCircle2 size={28} />
                         </div>
                       ) : (
                         <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-md transition-colors ${isActive ? 'bg-orange-500 text-white ring-4 ring-orange-200 dark:ring-orange-900/50' : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600'}`}>
                           {step.stepNumber}
                         </div>
                       )}
                    </div>
                    
                    <div className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer ${isActive ? 'bg-white dark:bg-gray-800 border-orange-200 shadow-md scale-[1.01]' : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800'}`}>
                      <h4 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isActive ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                        {step.title}
                      </h4>
                      <p className="mb-3 text-lg">{step.actionRequired}</p>
                      
                      {step.tip && (
                        <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg text-sm flex gap-2 items-start mt-4">
                           <span className="font-bold text-orange-800 dark:text-orange-300 shrink-0">Tip:</span>
                           <span className="text-orange-900 dark:text-orange-200">{step.tip}</span>
                        </div>
                      )}
                      
                      {isActive && index < result.steps.length - 1 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveStep(index + 1); }}
                          className="mt-4 flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-100 px-4 py-2 rounded-full transition-colors"
                        >
                          Mark Complete <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Guide Steps', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px] mt-4"
          >
            <Download size={18} /> Export Checklist
          </button>
        </motion.div>
      )}
    </div>
  );
}
