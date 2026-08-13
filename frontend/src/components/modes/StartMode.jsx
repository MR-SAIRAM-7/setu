import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, Target, CheckCircle, BrainCircuit } from 'lucide-react';

export default function StartMode() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/start', { task: input, isStuck: true });
      setResult(data);
    } catch (err) {
      setError('Failed to process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="start-input" className="font-semibold text-lg">What are you trying to do?</label>
        <textarea
          id="start-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I need to start my history essay but I feel paralyzed..."
          className="setu-input p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[120px] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="setu-btn bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Gathering thoughts...</span> : 'Break the Wall'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800/30">
            <h4 className="font-bold flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xl mb-4">
              <Target size={24} /> Immediate 10-Minute Action
            </h4>
            <p className="text-lg">{result.immediateTenMinuteAction}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4 flex items-center gap-2"><CheckCircle size={20} className="text-green-500" /> Micro Steps</h4>
               <ul className="flex flex-col gap-3">
                 {result.microSteps?.map((step, i) => (
                   <li key={i} className="flex gap-3 items-start">
                     <span className="bg-amber-100 text-amber-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{i+1}</span>
                     <span>{step}</span>
                   </li>
                 ))}
               </ul>
             </div>
             
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4 flex items-center gap-2"><BrainCircuit size={20} className="text-blue-500" /> Stats</h4>
               <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-sm opacity-70 mb-1">Estimated Time</div>
                    <div className="font-bold">{result.confidenceMeter?.estimatedTimeMinutes} mins</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70 mb-1">Supportive Message</div>
                    <div className="italic text-gray-600 dark:text-gray-300">"{result.supportiveMessage}"</div>
                  </div>
               </div>
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Start Plan', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export Plan
          </button>
        </motion.div>
      )}
    </div>
  );
}
