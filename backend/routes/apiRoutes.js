/**
 * API Routes Module
 */
const express = require('express');
const router = express.Router();

const {
  handleStartMode,
  handleSimplifyMode,
  handleLearnMode,
  handleMeetMode,
  handlePracticeMode,
  handleWriteMode,
  handleGuideMode,
  handleAgentNavigate,
  handleAgentPlan,
  handleExplain,
  handleExport
} = require('../controllers/modeControllers');

const { validateInputMiddleware } = require('../middleware/validator');
const fallbacks = require('../services/fallbackEngine');
const config = require('../config');

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    product: 'NeuroBridge One',
    engine: 'SETU Kernel Modular v2.5',
    aiEnabled: Boolean(config.openAiApiKey || config.geminiApiKey),
    modes: ['start', 'simplify', 'learn', 'meet', 'practice', 'write', 'guide', 'agent_navigate'],
    timestamp: new Date().toISOString()
  });
});

// 7 Mode Endpoints + Autonomous Agent Navigator
router.post('/start', validateInputMiddleware('task', 1000), handleStartMode);
router.post('/simplify', validateInputMiddleware('text', config.maxTextLength), handleSimplifyMode);
router.post('/learn', validateInputMiddleware('text', config.maxTextLength), handleLearnMode);
router.post('/meet', validateInputMiddleware('transcript', config.maxTextLength), handleMeetMode);
router.post('/practice', validateInputMiddleware('topic', 1000), handlePracticeMode);
router.post('/write', validateInputMiddleware('text', config.maxTextLength), handleWriteMode);
router.post('/guide', validateInputMiddleware('goal', 1000), handleGuideMode);
router.post('/agent/navigate', validateInputMiddleware('task', 1000), handleAgentNavigate);
router.post('/agent/plan', handleAgentPlan);
router.post('/explain', handleExplain);

// Export & Summarize
router.post('/export', handleExport);

router.post('/summarize', (req, res, next) => {
  try {
    const text = req.body.text || '';
    const points = fallbacks.generateLocalSummary(text, 5);
    res.json({ points, summary: points, fallback: true });
  } catch (err) { next(err); }
});

module.exports = router;
