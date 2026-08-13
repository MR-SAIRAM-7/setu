import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, Copy, Trash2, Plus, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { dbService } from '../services/supabaseClient';
import { callModeApi } from '../services/apiService';
import { useTheme } from '../contexts/ThemeContext';

const SUGGESTIONS = [
  "Simplify this page",
  "Help me start a task",
  "Create a mind map",
  "Explain this concept"
];

const Chat = () => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId] = useState(() => 'chat_' + Date.now());
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const loadHistory = async () => {
    try {
      const history = await dbService.getChatHistory(sessionId);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I am your SETU assistant. How can I help you today?',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (text = input) => {
    if (!text.trim()) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    
    try {
      await dbService.saveChatMessage(userMsg, sessionId);
      
      // Determine endpoint based on text (simple heuristic)
      let endpoint = '/api/guide';
      if (text.toLowerCase().includes('simplify')) endpoint = '/api/simplify';
      else if (text.toLowerCase().includes('start')) endpoint = '/api/start';
      
      const response = await callModeApi(endpoint, { query: text });
      
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content || 'I processed your request.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      await dbService.saveChatMessage(aiMsg, sessionId);
      
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const clearChat = async () => {
    await dbService.clearChatHistory(sessionId);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Chat cleared. How can I help?',
      timestamp: new Date().toISOString()
    }]);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full bg-white rounded-2xl shadow-soft overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sage-100 rounded-lg text-sage-600">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">SETU Assistant</h2>
            <p className="text-xs text-slate-500">Always here to help</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={clearChat} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Clear History">
            <Trash2 size={20} />
          </button>
          <button className="setu-btn-primary flex items-center gap-2 py-2 px-4 rounded-lg text-sm">
            <Plus size={16} /> New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 setu-scrollbar bg-white">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-sage-100 text-sage-600'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {msg.role === 'assistant' && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => speakText(msg.content)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                      <Volume2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-[85%]">
             <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-sage-100 text-sage-600">
                <Bot size={16} />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 rounded-tl-none flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-sage-500" />
                <span className="text-sm text-slate-500">Thinking...</span>
              </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex gap-2 mb-3 overflow-x-auto setu-scrollbar pb-1">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => handleSend(s)} className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-600 transition-colors flex items-center gap-1.5">
              <Sparkles size={12} className="text-sage-500" />
              {s}
            </button>
          ))}
        </div>
        
        <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-sage-400 focus-within:ring-1 focus-within:ring-sage-400 transition-all">
          <button 
            onClick={handleVoice}
            className={`p-3 rounded-lg flex-shrink-0 transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask SETU anything..."
            className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 text-[15px] max-h-32 min-h-[48px] setu-scrollbar"
            rows={1}
          />
          
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-slate-900 text-white rounded-lg flex-shrink-0 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
