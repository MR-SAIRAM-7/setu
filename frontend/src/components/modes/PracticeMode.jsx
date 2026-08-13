import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, MessageSquare, Heart, Lightbulb } from 'lucide-react';

export default function PracticeMode() {
  const [topic, setTopic] = useState('');
  const [utterance, setUtterance] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/practice', { topic, userUtterance: utterance });
      setResult(data);
    } catch (err) {
      setError('Failed to practice script.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="practice-topic" className="font-semibold text-lg block mb-2">Scenario / Topic</label>
          <input
            id="practice-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Asking for a raise, Declining an invitation..."
            className="setu-input p-4 w-full rounded-xl border border-gray-200 dark:border-gray-700"
          />
        </div>
        <div>
          <label htmlFor="practice-utterance" className="font-semibold text-lg block mb-2">What you want to say (Optional)</label>
          <textarea
            id="practice-utterance"
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            placeholder="I want to say no but I'm afraid they'll be mad..."
            className="setu-input p-4 w-full rounded-xl border border-gray-200 dark:border-gray-700 min-h-[100px] resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !topic.trim()}
          className="setu-btn bg-pink-600 hover:bg-pink-700 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <MessageSquare />} 
          {loading ? 'Preparing scripts...' : 'Generate Scripts'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-pink-50 dark:bg-pink-900/20 p-6 rounded-2xl border border-pink-100 dark:border-pink-800/30">
            <h4 className="font-bold mb-2 text-pink-800 dark:text-pink-200 text-xl">Context</h4>
            <p className="text-lg">{result.scenarioContext}</p>
            {result.openingLine && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl font-medium italic border-l-4 border-pink-400">
                Opening Line: "{result.openingLine}"
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <h4 className="font-bold mb-4 flex items-center gap-2"><MessageSquare size={20} className="text-pink-500" /> Suggested Responses</h4>
             <div className="grid gap-4 md:grid-cols-2">
               {result.suggestedResponses?.map((resp, i) => (
                 <div key={i} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 flex flex-col justify-between">
                   <div>
                     <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">{resp.label} - {resp.tone} Tone</span>
                     <p className="font-medium text-lg mb-2">"{resp.text}"</p>
                   </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl border border-orange-100 dark:border-orange-800/30 flex gap-4 items-start">
             <div className="p-2 bg-orange-100 dark:bg-orange-800/50 rounded-full text-orange-600 dark:text-orange-400 shrink-0">
               <Lightbulb size={24} />
             </div>
             <div>
               <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-1">Coaching Tip</h4>
               <p>{result.coachingTip}</p>
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Social Scripts', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export Scripts
          </button>
        </motion.div>
      )}
    </div>
  );
}
