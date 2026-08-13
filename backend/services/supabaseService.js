/**
 * Backend Supabase Service Module
 * Handles cloud persistence for AI generations, mindmaps, and audit logs.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function saveSummaryToCloud({ userId = 'anonymous_user', title, content, summaryPoints, mode }) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('saved_summaries')
      .insert([
        {
          user_id: userId,
          title,
          content,
          summary_points: summaryPoints,
          mode
        }
      ])
      .select();
    if (error) {
      console.warn('[Supabase Backend] Save summary error:', error.message);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.warn('[Supabase Backend] Exception during save summary:', err.message);
    return null;
  }
}

async function saveMindmapToCloud({ userId = 'anonymous_user', title, topic, nodes, edges, summary }) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('mindmaps')
      .insert([
        {
          user_id: userId,
          title,
          topic,
          nodes_json: nodes,
          edges_json: edges,
          summary
        }
      ])
      .select();
    if (error) {
      console.warn('[Supabase Backend] Save mindmap error:', error.message);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.warn('[Supabase Backend] Exception during save mindmap:', err.message);
    return null;
  }
}

module.exports = {
  isConfigured,
  supabase,
  saveSummaryToCloud,
  saveMindmapToCloud
};
