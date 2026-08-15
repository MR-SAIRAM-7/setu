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
 * Gemini model fallback chain.
 */
const GEMINI_MODEL_CHAIN = (process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL.trim()]
  : []
).concat([
  // Ordered by capability. Each model has its own free-tier daily quota, so a
  // longer chain directly extends how far a free key goes before it is spent.
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
]);

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  // AI providers
  geminiApiKey: clean(process.env.GEMINI_API_KEY),
  geminiModelChain: [...new Set(GEMINI_MODEL_CHAIN)],
  openAiApiKey: clean(process.env.OPENAI_API_KEY),
  openAiModel: clean(process.env.OPENAI_MODEL) || 'gpt-4o-mini',

  // Request shaping
  maxTextLength: 16000,
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000),
  aiMaxRetries: Number(process.env.AI_MAX_RETRIES || 2),
  maxRetryWaitMs: Number(process.env.AI_MAX_RETRY_WAIT_MS || 20000),

  // MongoDB Database Configuration
  mongoUri: clean(process.env.MONGODB_URI) || 'mongodb://127.0.0.1:27017/setu',

  corsOptions: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  get aiEnabled() {
    return Boolean(this.geminiApiKey || this.openAiApiKey);
  }
};
