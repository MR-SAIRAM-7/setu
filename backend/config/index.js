const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root and backend .env files.
// Earlier calls win: dotenv never overwrites an already-defined key.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const clean = (value) => {
  const trimmed = (value || '').trim();
  return trimmed.length ? trimmed : null;
};

/**
 * OpenRouter model fallback chain.
 * Primary model is first, followed by resilient multi-vendor alternatives.
 * If one model hits rate limits, balance exhaustion, or outages, the engine
 * automatically falls back to the next best model in line.
 */
const DEFAULT_OPENROUTER_CHAIN = [
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
  'anthropic/claude-3.5-haiku',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
  'openai/gpt-4o-mini',
  'mistralai/mistral-small-24b-instruct-2501',
  'qwen/qwen-2.5-72b-instruct'
];

/** Comma-separated list of web origins permitted to call the API. */
const allowedOrigins = (clean(process.env.CORS_ORIGINS) || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const customOpenRouterModel = clean(process.env.OPENROUTER_MODEL);
const customOpenRouterChain = clean(process.env.OPENROUTER_MODEL_CHAIN)
  ? process.env.OPENROUTER_MODEL_CHAIN.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const OPENROUTER_MODEL_CHAIN = [
  ...(customOpenRouterModel ? [customOpenRouterModel] : []),
  ...customOpenRouterChain,
  ...DEFAULT_OPENROUTER_CHAIN
];

/**
 * Direct Gemini model fallback chain (secondary provider).
 */
const GEMINI_MODEL_CHAIN = (process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL.trim()]
  : []
).concat([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro'
]);

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  // OpenRouter (Primary AI Provider)
  openRouterApiKey: clean(process.env.OPENROUTER_API_KEY),
  openRouterModel: customOpenRouterModel || 'google/gemini-2.5-flash',
  openRouterModelChain: [...new Set(OPENROUTER_MODEL_CHAIN)],
  openRouterBaseUrl: clean(process.env.OPENROUTER_BASE_URL) || 'https://openrouter.ai/api/v1',
  openRouterSiteUrl: clean(process.env.OPENROUTER_SITE_URL) || 'https://setu-sanctuary.app',
  openRouterAppName: clean(process.env.OPENROUTER_APP_NAME) || 'SETU Cognitive Sanctuary',

  // Direct AI providers (Secondary & Tertiary Fallbacks)
  geminiApiKey: clean(process.env.GEMINI_API_KEY),
  geminiModelChain: [...new Set(GEMINI_MODEL_CHAIN)],
  openAiApiKey: clean(process.env.OPENAI_API_KEY),
  openAiModel: clean(process.env.OPENAI_MODEL) || 'gpt-4o-mini',

  // Request shaping & limits
  maxTextLength: 64000,
  maxFileUploadSizeBytes: 25 * 1024 * 1024, // 25MB max file upload
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 60000),
  aiMaxRetries: Number(process.env.AI_MAX_RETRIES || 3),
  maxRetryWaitMs: Number(process.env.AI_MAX_RETRY_WAIT_MS || 15000),

  // MongoDB Database Configuration
  mongoUri: clean(process.env.MONGODB_URI) || 'mongodb://127.0.0.1:27017/setu',

  /** Credentials stripped — safe to print in logs and health payloads. */
  get safeMongoUri() {
    if (!this.mongoUri) return null;
    return this.mongoUri.replace(/:\/\/[^@/]+@/, '://***:***@');
  },

  /**
   * Browser origins allowed to call the API.
   *
   * The Chrome extension is a first-class client, so `chrome-extension://` and
   * origin-less requests (extension service workers, curl, server-to-server)
   * must pass. Set CORS_ORIGINS to lock the web app down to known hosts in
   * production; leaving it unset reflects the caller's origin, which is what a
   * local demo needs.
   */
  corsOptions: {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
        return callback(null, true);
      }
      if (!allowedOrigins.length) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: false,
    maxAge: 86400,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-conversation-id']
  },

  allowedOrigins,

  /** Serve the built SPA from the API process (single-service deploy). */
  serveStatic: clean(process.env.SERVE_STATIC) !== 'false',

  rateLimit: {
    // AI calls are the expensive, quota-bound path. 30/min per user is well above
    // what hands-on use produces, while still stopping a runaway client.
    aiWindowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS || 60000),
    aiMax: Number(process.env.RATE_LIMIT_AI_MAX || 30),
    // Everything else is cheap; this only stops runaway loops.
    generalWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    generalMax: Number(process.env.RATE_LIMIT_MAX || 240)
  },

  get aiEnabled() {
    return Boolean(this.openRouterApiKey || this.geminiApiKey || this.openAiApiKey);
  },

  get primaryProvider() {
    if (this.openRouterApiKey) return 'openrouter';
    if (this.geminiApiKey) return 'gemini';
    if (this.openAiApiKey) return 'openai';
    return 'offline_l0';
  },

  /**
   * Configuration problems worth printing at boot. Never throws: the engine is
   * designed to run degraded (offline rule engine, browser-local storage) rather
   * than refuse to start, so these are warnings, not fatal errors.
   */
  warnings() {
    const notes = [];
    if (!this.aiEnabled) {
      notes.push(
        'No AI key set (OPENROUTER_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY). ' +
          'Running on the deterministic offline engine only.'
      );
    }
    if (this.nodeEnv === 'production' && !allowedOrigins.length) {
      notes.push('CORS_ORIGINS is unset in production — the API will accept any web origin.');
    }
    if (!Number.isFinite(this.port) || this.port <= 0) {
      notes.push(`PORT "${process.env.PORT}" is not a valid port number.`);
    }
    return notes;
  }
};
