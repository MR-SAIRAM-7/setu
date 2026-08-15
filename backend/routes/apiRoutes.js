/**
 * SETU API Routes
 */
const express = require('express');
const router = express.Router();

const modes = require('../controllers/modeControllers');
const chat = require('../controllers/chatController');
const agent = require('../controllers/agentController');
const dbCtrl = require('../controllers/databaseController');

const { validateInputMiddleware } = require('../middleware/validator');
const { checkHealth } = require('../services/aiService');
const { getStatus } = require('../config/db');
const config = require('../config');

/** Cheap liveness probe — reports AI status and MongoDB connection. */
router.get('/health', (_req, res) => {
  const dbStatus = getStatus();
  res.json({
    status: 'healthy',
    product: 'SETU — Cognitive Operating System',
    version: '3.0.0',
    aiConfigured: config.aiEnabled,
    database: {
      provider: 'MongoDB',
      connected: dbStatus.connected,
      state: dbStatus.state
    },
    modes: ['start', 'simplify', 'learn', 'meet', 'practice', 'write', 'guide'],
    timestamp: new Date().toISOString()
  });
});

/** Deep probe — actually round-trips the model and reports DB. */
router.get('/health/ai', async (_req, res) => {
  const aiHealth = await checkHealth();
  const dbStatus = getStatus();
  res.json({
    ...aiHealth,
    database: {
      provider: 'MongoDB',
      connected: dbStatus.connected,
      state: dbStatus.state,
      configured: dbStatus.configured
    }
  });
});

/** Database status probe */
router.get('/db/status', dbCtrl.handleDbStatus);

/* --- MongoDB Persistence Endpoints --- */
router.get('/mindmaps', dbCtrl.handleGetMindMaps);
router.post('/mindmaps', dbCtrl.handleSaveMindMap);
router.get('/mindmaps/:id', dbCtrl.handleGetMindMapById);
router.delete('/mindmaps/:id', dbCtrl.handleDeleteMindMap);
router.delete('/mindmaps', dbCtrl.handleClearMindMaps);

router.get('/summaries', dbCtrl.handleGetSummaries);
router.post('/summaries', dbCtrl.handleSaveSummary);

router.get('/settings', dbCtrl.handleGetSettings);
router.post('/settings', dbCtrl.handleSaveSettings);
router.put('/settings', dbCtrl.handleSaveSettings);

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
router.post('/agent/navigate', validateInputMiddleware('task', 1000), agent.handleAgentPlan);
router.post('/agent/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);
router.post('/agent/chunk', agent.handleChunkPage);
router.post('/agent/describe-image', agent.handleDescribeImage);
router.post('/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);

/* --- Utilities --- */
router.post('/summarize', validateInputMiddleware('text', config.maxTextLength), modes.handleSummarize);
router.post('/export', modes.handleExport);

module.exports = router;
