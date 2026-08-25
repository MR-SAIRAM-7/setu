/**
 * SETU Production API Routes
 * --------------------------
 * Integrates the Gemini-backed AI agent, MongoDB persistence, document parsing,
 * conversation threads, and the cognitive accessibility modes.
 */

const express = require('express');
const router = express.Router();

const modes = require('../controllers/modeControllers');
const chat = require('../controllers/chatController');
const agent = require('../controllers/agentController');
const dbCtrl = require('../controllers/databaseController');
const fileCtrl = require('../controllers/fileController');
const convCtrl = require('../controllers/conversationController');
const speechCtrl = require('../controllers/speechController');

const { validateInputMiddleware } = require('../middleware/validator');
const { checkHealth } = require('../services/aiService');
const { getStatus } = require('../config/db');
const config = require('../config');
const multer = require('multer');

const audioUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
}).single('file');

/* -------------------------------------------------------------------------- */
/* Health Probes & System Status                                              */
/* -------------------------------------------------------------------------- */

/** Cheap liveness probe — reports AI provider status and MongoDB state */
router.get('/health', (_req, res) => {
  const dbStatus = getStatus();
  res.json({
    status: 'healthy',
    product: 'SETU — Cognitive Operating System',
    version: '3.0.0',
    primaryProvider: config.primaryProvider,
    aiConfigured: config.aiEnabled,
    // Named `aiEngine`, not `ai`: the web app merges the deep probe from
    // /api/health/ai into its own `health.ai` slot, and a static block landing
    // on the same key makes the latency row render an empty result before the
    // probe has run.
    aiEngine: {
      provider: config.primaryProvider,
      configured: config.aiEnabled,
      model: config.geminiApiKey ? config.geminiModel : config.openAiApiKey ? config.openAiModel : null,
      fallbackChain: config.geminiApiKey ? config.geminiModelChain : [],
      proChain: config.geminiApiKey ? config.geminiProModelChain : [],
      grounding: Boolean(config.geminiApiKey && config.geminiGroundingEnabled),
      // Surfaced so the web app and the extension can tell a misconfigured
      // server apart from an unreachable one without a second round trip.
      setupHint: config.aiEnabled
        ? null
        : 'Set GEMINI_API_KEY in the backend .env — create a key at https://aistudio.google.com/apikey'
    },
    speech: {
      provider: config.speechEnabled ? 'sarvam' : 'browser',
      configured: config.speechEnabled,
      model: config.speechEnabled ? config.sarvamTtsModel : null,
      sttProvider: config.sttEnabled ? 'sarvam' : 'browser',
      sttConfigured: config.sttEnabled,
      sttModel: config.sttEnabled ? config.sarvamSttModel : null
    },
    database: {
      provider: 'MongoDB',
      connected: dbStatus.connected,
      state: dbStatus.state,
      name: dbStatus.database
    },
    modes: [
      'start',
      'simplify',
      'learn',
      'meet',
      'practice',
      'write',
      'guide',
      'numbers',
      'listen'
    ],
    timestamp: new Date().toISOString()
  });
});

/** Deep probe — live round-trips the AI model and database connection */
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

/* -------------------------------------------------------------------------- */
/* File Upload & Document Ingestion Endpoints                                 */
/* -------------------------------------------------------------------------- */

router.post('/files/upload', fileCtrl.handleUploadFile);
router.get('/files', fileCtrl.handleListFiles);
router.get('/files/:id', fileCtrl.handleGetFileById);
router.delete('/files/:id', fileCtrl.handleDeleteFile);
router.post('/files/:id/mindmap', fileCtrl.handleMindMapFromFile);
router.post('/files/:id/query', fileCtrl.handleQueryFile);

/* -------------------------------------------------------------------------- */
/* Conversation Threads & Interaction History                                 */
/* -------------------------------------------------------------------------- */

router.get('/conversations', convCtrl.handleListConversations);
router.post('/conversations', convCtrl.handleCreateConversation);
router.get('/conversations/:id', convCtrl.handleGetConversation);
router.put('/conversations/:id', convCtrl.handleUpdateConversation);
router.delete('/conversations/:id', convCtrl.handleDeleteConversation);
router.get('/conversations/:id/messages', convCtrl.handleGetMessages);
router.post('/conversations/:id/messages', convCtrl.handleSaveMessage);

/* -------------------------------------------------------------------------- */
/* Mind Map & Artifact Database Persistence                                   */
/* -------------------------------------------------------------------------- */

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

router.get('/progress', dbCtrl.handleGetProgress);
router.post('/progress', dbCtrl.handleSaveProgress);

/* -------------------------------------------------------------------------- */
/* Conversational AI & Research Streaming                                     */
/* -------------------------------------------------------------------------- */

router.post('/chat', chat.handleChat);
router.post('/research/mindmap', validateInputMiddleware('topic', 1000), chat.handleMindMap);
router.post('/research/expand', chat.handleExpandNode);

/* -------------------------------------------------------------------------- */
/* Seven Cognitive Modes                                                      */
/* -------------------------------------------------------------------------- */

router.post('/start', validateInputMiddleware('task', 2000), modes.handleStartMode);
router.post('/simplify', validateInputMiddleware('text', config.maxTextLength), modes.handleSimplifyMode);
router.post('/learn', validateInputMiddleware('text', config.maxTextLength), modes.handleLearnMode);
router.post('/meet', validateInputMiddleware('transcript', config.maxTextLength), modes.handleMeetMode);
router.post('/practice', validateInputMiddleware('topic', 2000), modes.handlePracticeMode);
router.post('/write', validateInputMiddleware('text', config.maxTextLength), modes.handleWriteMode);
router.post('/guide', validateInputMiddleware('goal', 2000), modes.handleGuideMode);

/* Numbers (dyscalculia) and Listen (anxiety support) */
router.post('/numbers', validateInputMiddleware('problem', 2000), modes.handleNumbersMode);
router.post('/listen', validateInputMiddleware('entry', 4000), modes.handleListenMode);

/* -------------------------------------------------------------------------- */
/* In-Page Agent & Assistive Tools                                            */
/* -------------------------------------------------------------------------- */

router.post('/agent/plan', validateInputMiddleware('task', 2000), agent.handleAgentPlan);
router.post('/agent/navigate', validateInputMiddleware('task', 2000), agent.handleAgentPlan);
router.post('/agent/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);
router.post(
  '/agent/explain/stream',
  validateInputMiddleware('text', config.maxTextLength),
  agent.handleExplainStream
);
router.post('/agent/visualize', agent.handleVisualize);
router.post('/agent/chunk', agent.handleChunkPage);
router.post('/agent/describe-image', agent.handleDescribeImage);
router.post('/explain', validateInputMiddleware('text', config.maxTextLength), agent.handleExplain);

/* -------------------------------------------------------------------------- */
/* Natural-voice read-aloud & Speech-to-Text (Sarvam AI)                      */
/* -------------------------------------------------------------------------- */

router.get('/speech/voices', speechCtrl.handleListVoices);
router.post('/speech', speechCtrl.handleSynthesize);
router.post('/speech/transcribe', (req, res, next) => {
  audioUploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: `Audio upload error: ${err.message}` });
    }
    speechCtrl.handleTranscribe(req, res, next);
  });
});

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

router.post('/summarize', validateInputMiddleware('text', config.maxTextLength), modes.handleSummarize);
router.post('/export', modes.handleExport);

module.exports = router;
