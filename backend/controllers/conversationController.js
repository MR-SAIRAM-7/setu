/**
 * Conversation Controller
 * Handles conversation history, message threads, and interaction persistence in MongoDB.
 */

const mongoService = require('../services/mongodbService');

/**
 * GET /api/conversations
 */
async function handleListConversations(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'anonymous_user';
    const search = req.query.search || '';
    const conversations = await mongoService.listConversations({ userId, search });
    res.json({ conversations, dbConnected: mongoService.isDbActive() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/conversations
 */
async function handleCreateConversation(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous_user';
    const conversation = await mongoService.createConversation({
      ...req.body,
      userId
    });
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/conversations/:id
 */
async function handleGetConversation(req, res, next) {
  try {
    const conversation = await mongoService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    const messages = await mongoService.listMessages({ conversationId: req.params.id });
    res.json({ conversation, messages });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/conversations/:id
 */
async function handleUpdateConversation(req, res, next) {
  try {
    const updated = await mongoService.updateConversation(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json({ conversation: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/conversations/:id
 */
async function handleDeleteConversation(req, res, next) {
  try {
    const success = await mongoService.deleteConversation(req.params.id);
    res.json({ success, id: req.params.id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/conversations/:id/messages
 */
async function handleGetMessages(req, res, next) {
  try {
    const messages = await mongoService.listMessages({ conversationId: req.params.id });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/conversations/:id/messages
 */
async function handleSaveMessage(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous_user';
    const msg = await mongoService.saveMessage({
      ...req.body,
      conversationId: req.params.id,
      userId
    });
    res.status(201).json({ message: msg });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleListConversations,
  handleCreateConversation,
  handleGetConversation,
  handleUpdateConversation,
  handleDeleteConversation,
  handleGetMessages,
  handleSaveMessage
};
