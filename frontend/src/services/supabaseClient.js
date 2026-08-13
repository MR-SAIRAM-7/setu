import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const getLocal = (key, defaultVal) => {
  try { const d = localStorage.getItem(`setu_${key}`); return d ? JSON.parse(d) : defaultVal; } catch { return defaultVal; }
};
const setLocal = (key, value) => {
  try { localStorage.setItem(`setu_${key}`, JSON.stringify(value)); } catch {}
};

export const dbService = {
  async getProfile(userId = 'anonymous_user') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
        if (!error && data) return data;
      } catch {}
    }
    return getLocal('profile', { user_id: userId, reading_wpm: 240, preferred_theme: 'default', font_family: 'OpenDyslexic', sensory_calm: false, bionic_reading_enabled: true });
  },
  async updateProfile(profileData, userId = 'anonymous_user') {
    const updated = { ...profileData, user_id: userId, updated_at: new Date().toISOString() };
    setLocal('profile', updated);
    if (supabase) { try { await supabase.from('profiles').upsert(updated, { onConflict: 'user_id' }); } catch {} }
    return updated;
  },
  async getSavedSummaries(userId = 'anonymous_user') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('saved_summaries').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch {}
    }
    return getLocal('saved_summaries', []);
  },
  async saveSummary(summaryObj, userId = 'anonymous_user') {
    const item = { id: summaryObj.id || `sum_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, user_id: userId, title: summaryObj.title || 'Untitled Summary', source_url: summaryObj.source_url || '', content: summaryObj.content || '', summary_points: summaryObj.summary_points || [], mode: summaryObj.mode || 'simplify', readability_before: summaryObj.readability_before || null, readability_after: summaryObj.readability_after || null, created_at: new Date().toISOString() };
    const existing = getLocal('saved_summaries', []);
    setLocal('saved_summaries', [item, ...existing.filter(i => i.id !== item.id)]);
    if (supabase) { try { await supabase.from('saved_summaries').insert([item]); } catch {} }
    return item;
  },
  async deleteSummary(id) {
    const existing = getLocal('saved_summaries', []);
    setLocal('saved_summaries', existing.filter(i => i.id !== id));
    if (supabase) { try { await supabase.from('saved_summaries').delete().eq('id', id); } catch {} }
  },
  async getMindmaps(userId = 'anonymous_user') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('mindmaps').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        if (!error && data) return data;
      } catch {}
    }
    return getLocal('mindmaps', []);
  },
  async saveMindmap(mapObj, userId = 'anonymous_user') {
    const item = { id: mapObj.id || `map_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, user_id: userId, title: mapObj.title || 'Untitled Mindmap', topic: mapObj.topic || 'General', nodes_json: mapObj.nodes_json || [], edges_json: mapObj.edges_json || [], summary: mapObj.summary || '', created_at: mapObj.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
    const existing = getLocal('mindmaps', []);
    setLocal('mindmaps', [item, ...existing.filter(i => i.id !== item.id)]);
    if (supabase) { try { await supabase.from('mindmaps').upsert([item]); } catch {} }
    return item;
  },
  async deleteMindmap(id) {
    const existing = getLocal('mindmaps', []);
    setLocal('mindmaps', existing.filter(i => i.id !== id));
    if (supabase) { try { await supabase.from('mindmaps').delete().eq('id', id); } catch {} }
  },
  async getChatHistory(sessionId = 'default_session') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch {}
    }
    return getLocal(`chat_${sessionId}`, []);
  },
  async saveChatMessage(msgObj, sessionId = 'default_session') {
    const item = { id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, session_id: sessionId, role: msgObj.role || 'user', content: msgObj.content || '', mode: msgObj.mode || 'general', metadata: msgObj.metadata || {}, created_at: new Date().toISOString() };
    const existing = getLocal(`chat_${sessionId}`, []);
    setLocal(`chat_${sessionId}`, [...existing, item]);
    if (supabase) { try { await supabase.from('chat_messages').insert([item]); } catch {} }
    return item;
  },
  async clearChatHistory(sessionId = 'default_session') {
    setLocal(`chat_${sessionId}`, []);
    if (supabase) { try { await supabase.from('chat_messages').delete().eq('session_id', sessionId); } catch {} }
  },
  async getTasks(userId = 'anonymous_user') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('task_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch {}
    }
    return getLocal('task_items', []);
  },
  async saveTask(taskObj, userId = 'anonymous_user') {
    const item = { id: taskObj.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, user_id: userId, title: taskObj.title || 'Action Task', original_task: taskObj.original_task || '', anxiety_level: taskObj.anxiety_level || 'Low', effort_level: taskObj.effort_level || 'Low', steps_json: taskObj.steps_json || [], status: taskObj.status || 'in_progress', completed_steps: taskObj.completed_steps || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const existing = getLocal('task_items', []);
    setLocal('task_items', [item, ...existing.filter(i => i.id !== item.id)]);
    if (supabase) { try { await supabase.from('task_items').upsert([item]); } catch {} }
    return item;
  },
};

export default dbService;
