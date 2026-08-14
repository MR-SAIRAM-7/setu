/**
 * SETU API Routes
 */
const express = require('express');
const router = express.Router();

const modes = require('../controllers/modeControllers');
const chat = require('../controllers/chatController');
const agent = require('../controllers/agentController');

const { validateInputMiddleware } = require('../middleware/validator');
const { checkHealth } = require('../services/aiService');
const config = require('../config');

/** Cheap liveness probe — never calls the model. */
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    product: 'SETU — Cognitive Operating System',
    version: '3.0.0',
    aiConfigured: config.aiEnabled,
    modes: ['start', 'simplify', 'learn', 'meet', 'practice', 'write', 'guide'],
    timestamp: new Date().toISOString()
  });
});

/** Deep probe — actually round-trips the model. Used by settings screens. */
router.get('/health/ai', async (_req, res) => {
  res.json(await checkHealth());
});

/* --- Seven cognitive modes --- */
router.post('/start', validateInputMiddleware('task', 1000), modes.handleStartMode);
router.post('/simplify', validateInputMiddleware('text', config.maxTextLength), modes.handleSimplifyMode);
router.post('/learn', validateInputMiddleware('text', config.maxTextLength), modes.handleLearnMode);
router.post('/meet', validateInputMiddleware('transcript', config.maxTextLength), modes.handleMeetMode);
router.post('/practice', validateInputMiddleware('topic', 1000), modes.handlePracticeMode);
router.post('/write', validateInputMiddleware('text', config.maxTextLength), modes.handleWriteMode);
router.post('/guide', validateInputMiddleware('goal', 1000), modes.handleGuideMode);

/* --- Mind map chat --- */
router.post('/chat', chat.handleChat);
router.post('/research/mindmap', validateInputMiddleware('topic', 500), chat.handleMindMap);
router.post('/research/expand', chat.handleExpandNode);

/* --- In-page agent --- */
router.post('/agent/plan', validateInputMiddleware('task', 1000), agent.handleAgentPlan);
// Legacy alias: the extension shipped against /agent/navigate before v3.
router.post('/agent/navigate', validateInputMiddleware('task', 1000), agent.handleAgentPlan);
router.post('/agent/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);
router.post('/agent/chunk', agent.handleChunkPage);
router.post('/agent/describe-image', agent.handleDescribeImage);
// Legacy alias for the pre-v3 explain endpoint.
router.post('/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);

/* --- Utilities --- */
router.post('/summarize', validateInputMiddleware('text', config.maxTextLength), modes.handleSummarize);
router.post('/export', modes.handleExport);

module.exports = router;
