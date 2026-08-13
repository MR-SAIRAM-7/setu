import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, Brain, CheckSquare, Network } from 'lucide-react';

export default function LearnMode() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/learn', { text: input });
      setResult(data);
    } catch (err) {
      setError('Failed to generate learning materials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="learn-input" className="font-semibold text-lg">What do you want to learn about?</label>
        <textarea
          id="learn-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste an article, notes, or concept here..."
          className="setu-input p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[160px] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="setu-btn bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Brain />} 
          {loading ? 'Synthesizing...' : 'Generate Learning Material'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/30">
            <h4 className="font-bold mb-2 text-blue-800 dark:text-blue-200 text-xl">Summary</h4>
            <p className="text-lg leading-relaxed">{result.summary}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <h4 className="font-bold mb-4 flex items-center gap-2"><Network size={20} className="text-purple-500" /> Mind Map Outline</h4>
             <div className="pl-2">
                <div className="font-bold text-lg mb-2 bg-gray-100 dark:bg-gray-700 inline-block px-3 py-1 rounded-lg">
                  {result.mindMap?.rootNode}
                </div>
                <div className="space-y-4 ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                   {result.mindMap?.branches?.map((branch, i) => (
                     <div key={i}>
                       <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{branch.topic}</div>
                       <ul className="list-disc pl-5 text-sm space-y-1 opacity-80">
                         {branch.details?.map((detail, j) => (
                           <li key={j}>{detail}</li>
                         ))}
                       </ul>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <h4 className="font-bold mb-4 flex items-center gap-2"><CheckSquare size={20} className="text-green-500" /> Quick Quiz</h4>
             <div className="space-y-6">
                {result.quiz?.map((q, i) => (
                  <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <p className="font-semibold mb-3">{i+1}. {q.question}</p>
                    <div className="space-y-2 mb-3">
                       {q.options?.map((opt, j) => (
                         <div key={j} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800">
                           {String.fromCharCode(65+j)}. {opt}
                         </div>
                       ))}
                    </div>
                    <div className="text-sm bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded-lg border border-green-200 dark:border-green-800/50">
                      <strong>Answer: {String.fromCharCode(65+q.answerIndex)}</strong> - {q.explanation}
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Learning Material', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export Study Guide
          </button>
        </motion.div>
      )}
    </div>
  );
}
