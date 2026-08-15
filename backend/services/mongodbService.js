/**
 * Backend MongoDB Service Module
 * Comprehensive production-grade data layer for conversations, messages,
 * documents, mindmaps, summaries, user settings, and session audits.
 */
const { getStatus, mongoose } = require('../config/db');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const DocumentFile = require('../models/DocumentFile');
const MindMap = require('../models/MindMap');
const SavedSummary = require('../models/SavedSummary');
const UserSettings = require('../models/UserSettings');
const SessionLog = require('../models/SessionLog');

function isDbActive() {
  return mongoose.connection.readyState === 1;
}

/* ----------------------------- Conversations ----------------------------- */

async function createConversation({
  id,
  userId = 'anonymous_user',
  title = 'New Research Chat',
  currentTopic = '',
  mode = 'mindmap',
  mindMapId = null,
  documentIds = [],
  metadata = {}
}) {
  if (!isDbActive()) return null;
  try {
    const convId = id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const conversation = await Conversation.findOneAndUpdate(
      { id: convId },
      {
        id: convId,
        userId,
        title,
        currentTopic,
        mode,
        mindMapId,
        documentIds,
        metadata,
        lastMessageAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return conversation;
  } catch (err) {
    console.warn('[MongoDB Service] Error creating conversation:', err.message);
    return null;
  }
}

async function listConversations({ userId = 'anonymous_user', limit = 50, search = '' }) {
  if (!isDbActive()) return [];
  try {
    const query = { userId };
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { currentTopic: regex }];
    }
    return await Conversation.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error listing conversations:', err.message);
    return [];
  }
}

async function getConversationById(id) {
  if (!isDbActive() || !id) return null;
  try {
    return await Conversation.findOne({ id }).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error fetching conversation:', err.message);
    return null;
  }
}

async function updateConversation(id, updates = {}) {
  if (!isDbActive() || !id) return null;
  try {
    return await Conversation.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error updating conversation:', err.message);
    return null;
  }
}

async function deleteConversation(id) {
  if (!isDbActive() || !id) return false;
  try {
    await Message.deleteMany({ conversationId: id });
    const res = await Conversation.deleteOne({ id });
    return res.deletedCount > 0;
  } catch (err) {
    console.warn('[MongoDB Service] Error deleting conversation:', err.message);
    return false;
  }
}

/* ----------------------------- Messages ----------------------------- */

async function saveMessage({
  id,
  conversationId,
  userId = 'anonymous_user',
  role,
  content,
  intent = 'chat',
  stage = 'done',
  sources = [],
  mindMapData = null,
  fileAttachments = [],
  modelUsed = null,
  provider = null,
  metadata = {}
}) {
  if (!isDbActive() || !conversationId || !role) return null;
  try {
    const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg = await Message.findOneAndUpdate(
      { id: msgId },
      {
        id: msgId,
        conversationId,
        userId,
        role,
        content: content || '',
        intent,
        stage,
        sources,
        mindMapData,
        fileAttachments,
        modelUsed,
        provider,
        metadata
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update parent conversation timestamp
    await Conversation.findOneAndUpdate(
      { id: conversationId },
      { lastMessageAt: new Date(), updatedAt: new Date() }
    ).catch(() => {});

    return msg;
  } catch (err) {
    console.warn('[MongoDB Service] Error saving message:', err.message);
    return null;
  }
}

async function listMessages({ conversationId, limit = 100 }) {
  if (!isDbActive() || !conversationId) return [];
  try {
    return await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(limit).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error listing messages:', err.message);
    return [];
  }
}

/* ----------------------------- Documents & Uploaded Files ----------------------------- */

async function saveDocumentFile({
  id,
  userId = 'anonymous_user',
  conversationId = null,
  originalName,
  mimeType,
  size,
  extractedText,
  summary = '',
  keyPoints = [],
  pageCount = 1,
  charCount = 0,
  tokenCount = 0,
  structuredSections = [],
  metadata = {}
}) {
  if (!isDbActive() || !originalName || !extractedText) return null;
  try {
    const fileId = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc = await DocumentFile.findOneAndUpdate(
      { id: fileId },
      {
        id: fileId,
        userId,
        conversationId,
        originalName,
        mimeType,
        size,
        extractedText,
        summary,
        keyPoints,
        pageCount,
        charCount: charCount || extractedText.length,
        tokenCount: tokenCount || Math.ceil(extractedText.length / 4),
        structuredSections,
        metadata
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc;
  } catch (err) {
    console.warn('[MongoDB Service] Error saving document:', err.message);
    return null;
  }
}

async function listDocumentFiles({ userId = 'anonymous_user', conversationId = null, limit = 50 }) {
  if (!isDbActive()) return [];
  try {
    const query = { userId };
    if (conversationId) query.conversationId = conversationId;
    return await DocumentFile.find(query, { extractedText: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error listing documents:', err.message);
    return [];
  }
}

async function getDocumentFileById(id) {
  if (!isDbActive() || !id) return null;
  try {
    return await DocumentFile.findOne({ id }).lean();
  } catch (err) {
    console.warn('[MongoDB Service] Error fetching document:', err.message);
    return null;
  }
}

async function deleteDocumentFile(id) {
  if (!isDbActive() || !id) return false;
  try {
    const res = await DocumentFile.deleteOne({ id });
    return res.deletedCount > 0;
  } catch (err) {
    console.warn('[MongoDB Service] Error deleting document:', err.message);
    return false;
  }
}

/* ----------------------------- MindMaps ----------------------------- */

async function saveMindMap({
  id,
  userId = 'anonymous_user',
  conversationId = null,
  documentId = null,
  title,
  topic,
  summary,
  keyFacts = [],
  followUps = [],
  sources = [],
  grounded = false,
  root,
  isLensHandoff = false,
  metadata = {}
}) {
  if (!isDbActive() || !title || !root) return null;
  try {
    const mapId = id || `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Count total nodes
    let nodeCount = 1;
    const countNodes = (n) => {
      if (n?.children && Array.isArray(n.children)) {
        nodeCount += n.children.length;
        n.children.forEach(countNodes);
      }
    };
    countNodes(root);

    const updated = await MindMap.findOneAndUpdate(
      { id: mapId },
      {
        id: mapId,
        userId,
        conversationId,
        documentId,
        title,
        topic: topic || title,
        summary: summary || '',
        keyFacts,
        followUps,
        sources,
        grounded,
        root,
        nodeCount,
        isLensHandoff,
        metadata,
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
    return null;
  }
}

module.exports = {
  isConfigured: () => getStatus().configured,
  isDbActive,
  // Conversations & Messages
  createConversation,
  listConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  saveMessage,
  listMessages,
  // Documents & Uploaded Files
  saveDocumentFile,
  listDocumentFiles,
  getDocumentFileById,
  deleteDocumentFile,
  // MindMaps
  saveMindMap,
  listMindMaps,
  getMindMapById,
  deleteMindMap,
  clearMindMaps,
  // Summaries
  saveSummary,
  listSummaries,
  // User Settings & Session
  getUserSettings,
  saveUserSettings,
  logSession
};
