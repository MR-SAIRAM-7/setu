import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';

export default function SimplifyMode() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/simplify', { text: input });
      setResult(data);
    } catch (err) {
      setError('Failed to simplify text.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="simplify-input" className="font-semibold text-lg">Paste complex text here:</label>
        <textarea
          id="simplify-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Notwithstanding the aforementioned provisions..."
          className="setu-input p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[160px] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="setu-btn bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} 
          {loading ? 'Simplifying...' : 'Simplify Text'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-2xl border border-teal-100 dark:border-teal-800/30">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold flex items-center gap-2 text-teal-800 dark:text-teal-200 text-xl">
                <BookOpen size={24} /> Plain Language Version
              </h4>
              <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-bold">
                Grade: {result.readabilityGrade}
              </span>
            </div>
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{result.plainLanguageRewrite}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4">Key Takeaways</h4>
               <ul className="list-disc pl-5 space-y-2">
                 {result.keyTakeaways?.map((item, i) => (
                   <li key={i}>{item}</li>
                 ))}
               </ul>
             </div>
             
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                 <AlertCircle size={20} /> Sensory / Cognitive Tips
               </h4>
               <ul className="list-disc pl-5 space-y-2">
                 {result.sensoryTips?.map((tip, i) => (
                   <li key={i}>{tip}</li>
                 ))}
               </ul>
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Simplified Text', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export
          </button>
        </motion.div>
      )}
    </div>
  );
}
