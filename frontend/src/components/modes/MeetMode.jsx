import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { callModeApi, exportArtifactMarkdown } from '../../services/apiService';
import { Download, Loader2, Mic, ListTodo, FileText, Search } from 'lucide-react';

export default function MeetMode() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callModeApi('/api/meet', { transcript: input });
      setResult(data);
    } catch (err) {
      setError('Failed to process transcript.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="meet-input" className="font-semibold text-lg">Paste meeting transcript or notes:</label>
        <textarea
          id="meet-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="[00:00] Alice: So about the Q3 roadmap... We need to synergize our deliverables."
          className="setu-input p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[160px] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="setu-btn bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-xl font-bold min-h-[44px] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Mic />} 
          {loading ? 'Rescuing...' : 'Rescue Transcript'}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-4 rounded-xl">{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 mt-4">
          <div className="bg-violet-50 dark:bg-violet-900/20 p-6 rounded-2xl border border-violet-100 dark:border-violet-800/30">
            <h4 className="font-bold flex items-center gap-2 text-violet-800 dark:text-violet-200 text-xl mb-4">
              <FileText size={24} /> Meeting Summary
            </h4>
            <p className="text-lg leading-relaxed">{result.summary}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4 flex items-center gap-2"><CheckSquare size={20} className="text-green-500" /> Key Decisions</h4>
               <ul className="list-disc pl-5 space-y-2">
                 {result.keyDecisions?.map((dec, i) => (
                   <li key={i}>{dec}</li>
                 ))}
               </ul>
             </div>
             
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold mb-4 flex items-center gap-2"><Search size={20} className="text-orange-500" /> Jargon Decoded</h4>
               <ul className="space-y-3">
                 {result.jargonDecoded?.map((item, i) => (
                   <li key={i} className="text-sm">
                     <span className="font-bold text-violet-600 dark:text-violet-400">{item.term}:</span> {item.plainMeaning}
                   </li>
                 ))}
               </ul>
             </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <h4 className="font-bold mb-4 flex items-center gap-2"><ListTodo size={20} className="text-blue-500" /> Action Items</h4>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-gray-200 dark:border-gray-700">
                     <th className="py-2 px-4">Task</th>
                     <th className="py-2 px-4">Owner</th>
                     <th className="py-2 px-4">Deadline</th>
                     <th className="py-2 px-4">Priority</th>
                   </tr>
                 </thead>
                 <tbody>
                   {result.actionItems?.map((item, i) => (
                     <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                       <td className="py-3 px-4 font-medium">{item.task}</td>
                       <td className="py-3 px-4 text-sm">{item.owner}</td>
                       <td className="py-3 px-4 text-sm">{item.deadline}</td>
                       <td className="py-3 px-4">
                         <span className={`text-xs px-2 py-1 rounded-full font-bold ${item.priority === 'High' ? 'bg-red-100 text-red-800' : item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                           {item.priority}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>

          <button
            onClick={() => exportArtifactMarkdown('Meeting Summary', result)}
            className="flex items-center gap-2 justify-center py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium self-start min-h-[44px]"
          >
            <Download size={18} /> Export Notes
          </button>
        </motion.div>
      )}
    </div>
  );
}

// Ensure CheckSquare is imported since it's used
import { CheckSquare } from 'lucide-react';
