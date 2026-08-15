/**
 * Backend MongoDB Service Module
 * Handles cloud/local persistence for mindmaps, summaries, user settings, and audit logs.
 */
const { getStatus, mongoose } = require('../config/db');
const MindMap = require('../models/MindMap');
const SavedSummary = require('../models/SavedSummary');
const UserSettings = require('../models/UserSettings');
const SessionLog = require('../models/SessionLog');

function isDbActive() {
  return mongoose.connection.readyState === 1;
}

/* ----------------------------- MindMaps ----------------------------- */

async function saveMindMap({
  id,
  userId = 'anonymous_user',
  title,
  topic,
  summary,
  keyFacts = [],
  followUps = [],
  sources = [],
  grounded = false,
  root,
  isLensHandoff = false
}) {
  if (!isDbActive() || !title || !root) return null;
  try {
    const mapId = id || `map_${Date.now()}`;
    const updated = await MindMap.findOneAndUpdate(
      { id: mapId },
      {
        id: mapId,
        userId,
        title,
        topic: topic || title,
        summary: summary || '',
        keyFacts,
        followUps,
        sources,
        grounded,
        root,
        isLensHandoff,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return updated;
  } catch (err) {
    console.warn('[MongoDB Service] Error saving mindmap:', err.message);
    return null;
  }
}

async function listMindMaps({ userId = 'anonymous_user', search = '', limit = 50 }) {
  if (!isDbActive()) return [];
  try {
    const query = { userId };
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { summary: regex }, { topic: regex }];
    }
    return await MindMap.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error listing mindmaps:', err.message);
    return [];
  }
}

async function getMindMapById(id) {
  if (!isDbActive() || !id) return null;
  try {
    return await MindMap.findOne({ id }).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error fetching mindmap:', err.message);
    return null;
  }
}

async function deleteMindMap(id) {
  if (!isDbActive() || !id) return false;
  try {
    const res = await MindMap.deleteOne({ id });
    return res.deletedCount > 0;
  } catch (err) {
    console.warn('[MongoDB Service] Error deleting mindmap:', err.message);
    return false;
  }
}

async function clearMindMaps(userId = 'anonymous_user') {
  if (!isDbActive()) return false;
  try {
    await MindMap.deleteMany({ userId });
    return true;
  } catch (err) {
    console.warn('[MongoDB Service] Error clearing mindmaps:', err.message);
    return false;
  }
}

/* ----------------------------- Summaries ----------------------------- */

async function saveSummary({
  id,
  userId = 'anonymous_user',
  title,
  content,
  summaryPoints = [],
  mode = 'summary',
  resultData = {},
  metadata = {}
}) {
  if (!isDbActive()) return null;
  try {
    const summaryId = id || `sum_${Date.now()}`;
    const doc = await SavedSummary.findOneAndUpdate(
      { id: summaryId },
      {
        id: summaryId,
        userId,
        title: title || 'Untitled Summary',
        content: content || '',
        summaryPoints,
        mode,
        resultData,
        metadata
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc;
  } catch (err) {
    console.warn('[MongoDB Service] Error saving summary:', err.message);
    return null;
  }
}

async function listSummaries({ userId = 'anonymous_user', limit = 50 }) {
  if (!isDbActive()) return [];
  try {
    return await SavedSummary.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error listing summaries:', err.message);
    return [];
  }
}

/* ----------------------------- User Settings ----------------------------- */

async function getUserSettings(userId = 'anonymous_user') {
  if (!isDbActive()) return null;
  try {
    return await UserSettings.findOne({ userId }).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error getting settings:', err.message);
    return null;
  }
}

async function saveUserSettings(userId = 'anonymous_user', settings = {}) {
  if (!isDbActive()) return null;
  try {
    return await UserSettings.findOneAndUpdate(
      { userId },
      { ...settings, userId, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error saving settings:', err.message);
    return null;
  }
}

/* ----------------------------- Audit / Session ----------------------------- */

async function logSession(userId = 'anonymous_user', action, details = {}) {
  if (!isDbActive()) return null;
  try {
    return await SessionLog.create({ userId, action, details, timestamp: new Date() });
  } catch (err) {
    // Non-critical logging failure
    return null;
  }
}

module.exports = {
  isConfigured: () => getStatus().configured,
  isDbActive,
  saveMindMap,
  listMindMaps,
  getMindMapById,
  deleteMindMap,
  clearMindMaps,
  saveSummary,
  listSummaries,
  getUserSettings,
  saveUserSettings,
  logSession
};
