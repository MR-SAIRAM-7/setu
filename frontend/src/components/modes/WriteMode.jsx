import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, PenTool, Edit3, ArrowRight } from 'lucide-react';

export default function WriteMode() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/write', { text: input });
      setResult(data);
    } catch (err) {
      setError('Failed to process text.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="write-input" className="font-semibold text-lg">Your Draft:</label>
        <textarea
          id="write-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste your draft here to get accessibility and clarity suggestions..."
          className="setu-input p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[200px] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="setu-btn bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <PenTool />} 
          {loading ? 'Reviewing...' : 'Review & Improve'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-800/30">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold flex items-center gap-2 text-green-800 dark:text-green-200 text-xl">
                <Edit3 size={24} /> Improved Text
              </h4>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                Original Grade: {result.originalGradeLevel}
              </span>
            </div>
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{result.improvedText}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4">Clarity Fixes</h4>
               <div className="space-y-4">
                 {result.clarityFixes?.map((fix, i) => (
                   <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 text-sm">
                     <div className="flex items-center gap-2 mb-2 text-gray-500">
                       <span className="line-through">{fix.originalSnippet}</span>
                       <ArrowRight size={14} />
                       <span className="font-semibold text-green-600 dark:text-green-400">{fix.suggestedSnippet}</span>
                     </div>
                     <div className="italic opacity-80">{fix.reason}</div>
                   </div>
                 ))}
               </div>
             </div>
             
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4">Passive Voice Instances</h4>
               <ul className="list-disc pl-5 space-y-2">
                 {result.passiveVoiceInstances?.length > 0 ? (
                   result.passiveVoiceInstances.map((instance, i) => (
                     <li key={i} className="text-red-500/80">{instance}</li>
                   ))
                 ) : (
                   <li className="text-green-600">None detected! Great job.</li>
                 )}
               </ul>
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Improved Writing', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export Text
          </button>
        </motion.div>
      )}
    </div>
  );
}
