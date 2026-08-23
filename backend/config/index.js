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

/** Database used when the connection string carries no path of its own. */
const MONGO_DB_NAME = clean(process.env.MONGODB_DB) || 'setu';

/**
 * Normalise a MongoDB connection string.
 *
 * Atlas hands out URIs with no database path (`.../?appName=Cluster0`), and the
 * driver silently falls back to `test` for those — so seeded data lands in one
 * database while the app reads from another. Appending the database name here
 * means both surfaces agree regardless of which form the URI was pasted in.
 *
 * Returns null for anything that is not a usable mongodb URI, which puts the
 * process into fallback mode rather than failing at connect time.
 */
function normalizeMongoUri(raw) {
  const uri = clean(raw);
  if (!uri) return null;

  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    console.warn(
      `  [config] MONGODB_URI must start with mongodb:// or mongodb+srv:// — got "${uri.slice(
        0,
        24
      )}…". Ignoring it.`
    );
    return null;
  }

  const queryAt = uri.indexOf('?');
  const base = queryAt === -1 ? uri : uri.slice(0, queryAt);
  const query = queryAt === -1 ? '' : uri.slice(queryAt);

  const schemeEnd = base.indexOf('://') + 3;
  const authority = base.slice(schemeEnd);

  // Look for the path separator only after the credentials, so an escaped slash
  // inside a password is not mistaken for the start of the database name.
  const credentialsEnd = authority.lastIndexOf('@') + 1;
  const pathStart = authority.indexOf('/', credentialsEnd);

  const hasDbName =
    pathStart !== -1 && authority.slice(pathStart + 1).length > 0;

  if (hasDbName) return uri;

  const hostPart =
    pathStart === -1 ? authority : authority.slice(0, pathStart);

  return `${base.slice(0, schemeEnd)}${hostPart}/${MONGO_DB_NAME}${query}`;
}

/**
 * OpenRouter model fallback chain.
 *
 * SETU priorities:
 * 1. Very low latency
 * 2. Free inference
 * 3. Tool/function calling
 * 4. Strong general reasoning
 * 5. Large-context support
 *
 * Current primary:
 *   NVIDIA Nemotron 3 Nano 30B A3B (free)
 *
 * OpenRouter currently reports approximately:
 *   - 0.51s P50 latency
 *   - 142 tokens/sec throughput
 *   - 256K context
 *
 * Secondary:
 *   Google Gemma 4 26B A4B IT (free)
 *
 * Tertiary:
 *   NVIDIA Nemotron 3 Ultra (free)
 *
 * Final:
 *   OpenRouter dynamic free router
 *
 * IMPORTANT:
 * Free OpenRouter endpoints can have provider availability/rate limits.
 * The request layer should therefore continue to the next model on
 * 402/404/408/429/5xx/network failures.
 */
const DEFAULT_OPENROUTER_CHAIN = [
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'openrouter/free',
  'openai/gpt-oss-20b:free',
];

/**
 * Legacy or defunct model IDs to remove from the automatic default fallback chain.
 * Note: If a model is explicitly specified in user environment variables (OPENROUTER_MODEL or
 * OPENROUTER_MODEL_CHAIN), the user's explicit preference is always honored.
 */
const LEGACY_OPENROUTER_MODELS = new Set([
  'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash',
  'google/gemini-2.5-flash',
]);

/**
 * Normalise and de-duplicate an OpenRouter model chain.
 */
function normalizeOpenRouterChain(models, filterLegacy = true) {
  return [
    ...new Set(
      models
        .map((model) => clean(model))
        .filter(Boolean)
        .filter((model) => !filterLegacy || !LEGACY_OPENROUTER_MODELS.has(model))
    ),
  ];
}

/** Comma-separated list of web origins permitted to call the API. */
const allowedOrigins = (clean(process.env.CORS_ORIGINS) || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

/**
 * Optional explicit primary model.
 * If OPENROUTER_MODEL is not supplied, SETU dynamically uses the first model
 * from the constructed chain.
 */
const customOpenRouterModel = clean(process.env.OPENROUTER_MODEL);

/**
 * Optional user-defined fallback chain.
 */
const customOpenRouterChain = clean(process.env.OPENROUTER_MODEL_CHAIN)
  ? process.env.OPENROUTER_MODEL_CHAIN
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

/**
 * Build final OpenRouter chain dynamically:
 * Explicit user models are prioritized first, followed by default free fallback chain.
 */
const explicitUserChain = normalizeOpenRouterChain([
  ...(customOpenRouterModel ? [customOpenRouterModel] : []),
  ...customOpenRouterChain,
], false);

const cleanedDefaultChain = normalizeOpenRouterChain(DEFAULT_OPENROUTER_CHAIN, true);

const OPENROUTER_MODEL_CHAIN = [
  ...new Set([...explicitUserChain, ...cleanedDefaultChain]),
];

/**
 * Direct Gemini model fallback chain (secondary provider).
 *
 * This is independent from OpenRouter.
 */
const GEMINI_MODEL_CHAIN = (process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL.trim()]
  : []
).concat([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
]);

module.exports = {
  port: Number(process.env.PORT || 3000),

  nodeEnv: process.env.NODE_ENV || 'development',

  // ---------------------------------------------------------------------------
  // OpenRouter - Primary AI Provider
  // ---------------------------------------------------------------------------

  openRouterApiKey: clean(process.env.OPENROUTER_API_KEY),

  /**
   * Primary SETU model resolved dynamically from environment or top of chain.
   */
  openRouterModel:
    customOpenRouterModel ||
    OPENROUTER_MODEL_CHAIN[0] ||
    'google/gemma-4-26b-a4b-it:free',

  /**
   * Complete fallback chain.
   */
  openRouterModelChain: OPENROUTER_MODEL_CHAIN,

  /**
   * OpenRouter API endpoint.
   */
  openRouterBaseUrl:
    clean(process.env.OPENROUTER_BASE_URL) ||
    'https://openrouter.ai/api/v1',

  /**
   * Used by OpenRouter for rankings/identification.
   */
  openRouterSiteUrl:
    clean(process.env.OPENROUTER_SITE_URL) ||
    'https://setu-sanctuary.app',

  openRouterAppName:
    clean(process.env.OPENROUTER_APP_NAME) ||
    'SETU Cognitive Sanctuary',

  /**
   * Web search support.
   */
  openRouterWebSearchEnabled:
    process.env.OPENROUTER_WEB_SEARCH !== 'false',

  openRouterWebFetchEnabled:
    process.env.OPENROUTER_WEB_FETCH !== 'false',

  /**
   * Centralized web-search & fetch tool configuration.
   */
  openRouterWebTools: {
    search: {
      type: 'openrouter:web_search',
      parameters: {
        engine: clean(process.env.OPENROUTER_SEARCH_ENGINE) || 'native',
        max_results: Number(process.env.OPENROUTER_SEARCH_MAX_RESULTS || 5)
      }
    },
    fetch: {
      type: 'openrouter:web_fetch',
    },
  },

  // ---------------------------------------------------------------------------
  // Direct AI providers - Secondary / Tertiary fallbacks
  // ---------------------------------------------------------------------------

  geminiApiKey: clean(process.env.GEMINI_API_KEY),

  geminiModelChain: [...new Set(GEMINI_MODEL_CHAIN)],

  openAiApiKey: clean(process.env.OPENAI_API_KEY),

  openAiModel:
    clean(process.env.OPENAI_MODEL) || 'gpt-4o-mini',

  // ---------------------------------------------------------------------------
  // Speech - Sarvam AI
  // ---------------------------------------------------------------------------

  /**
   * Sarvam AI powers read-aloud.
   *
   * Without a key the application silently falls back to browser speech.
   */
  sarvamApiKey: clean(process.env.SARVAM_API_KEY),

  sarvamBaseUrl:
    clean(process.env.SARVAM_BASE_URL) ||
    'https://api.sarvam.ai',

  /**
   * bulbul:v3 is the natural-prosody model.
   */
  sarvamTtsModel:
    clean(process.env.SARVAM_TTS_MODEL) ||
    'bulbul:v3',

  sarvamTtsSpeaker:
    clean(process.env.SARVAM_TTS_SPEAKER) ||
    'priya',

  sarvamTtsLanguage:
    clean(process.env.SARVAM_TTS_LANGUAGE) ||
    'en-IN',

  /**
   * saaras:v3 is the state-of-the-art speech-to-text model.
   */
  sarvamSttModel:
    clean(process.env.SARVAM_STT_MODEL) ||
    'saaras:v3',

  sarvamTimeoutMs:
    Number(process.env.SARVAM_TIMEOUT_MS || 30000),

  // ---------------------------------------------------------------------------
  // Request shaping & limits
  // ---------------------------------------------------------------------------

  maxTextLength: 64000,

  maxFileUploadSizeBytes:
    25 * 1024 * 1024,

  /**
   * AI requests can take longer when reasoning or web search is used.
   */
  aiTimeoutMs:
    Number(process.env.AI_TIMEOUT_MS || 60000),

  /**
   * Number of retries handled by the AI service.
   */
  aiMaxRetries:
    Number(process.env.AI_MAX_RETRIES || 3),

  /**
   * Maximum wait between retries.
   */
  maxRetryWaitMs:
    Number(process.env.AI_MAX_RETRY_WAIT_MS || 15000),

  // ---------------------------------------------------------------------------
  // MongoDB
  // ---------------------------------------------------------------------------

  /**
   * MongoDB is opt-in.
   *
   * The API can still run in degraded/offline mode when MongoDB
   * is unavailable.
   */
  mongoUri:
    normalizeMongoUri(process.env.MONGODB_URI),

  mongoDbName:
    MONGO_DB_NAME,

  /**
   * Resolvers used for SRV/TXT lookup required by mongodb+srv://.
   */
  dnsFallbackServers:
    (process.env.DNS_SERVERS === undefined
      ? '8.8.8.8,1.1.1.1'
      : process.env.DNS_SERVERS
    )
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean),

  /**
   * Credentials stripped — safe to print in logs and health payloads.
   */
  get safeMongoUri() {
    if (!this.mongoUri) return null;

    return this.mongoUri.replace(
      /:\/\/[^@/]+@/,
      '://***:***@'
    );
  },

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------

  /**
   * Browser origins allowed to call the API.
   *
   * Chrome and Firefox extensions are first-class clients.
   */
  corsOptions: {
    origin(origin, callback) {
      // Server-to-server / curl / extension service worker requests.
      if (!origin) {
        return callback(null, true);
      }

      // Chrome extension.
      if (origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      // Firefox extension.
      if (origin.startsWith('moz-extension://')) {
        return callback(null, true);
      }

      // Development mode / unrestricted configuration.
      if (!allowedOrigins.length) {
        return callback(null, true);
      }

      // Explicitly allowed website.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Origin ${origin} is not allowed by CORS.`
        )
      );
    },

    credentials: false,

    maxAge: 86400,

    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-conversation-id',
    ],
  },

  allowedOrigins,

  // ---------------------------------------------------------------------------
  // Static SPA
  // ---------------------------------------------------------------------------

  /**
   * Serve the built SPA from the API process.
   */
  serveStatic:
    clean(process.env.SERVE_STATIC) !== 'false',

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  rateLimit: {
    /**
     * AI calls are quota-bound.
     */
    aiWindowMs:
      Number(
        process.env.RATE_LIMIT_AI_WINDOW_MS ||
          60000
      ),

    aiMax:
      Number(
        process.env.RATE_LIMIT_AI_MAX ||
          30
      ),

    /**
     * General API calls.
     */
    generalWindowMs:
      Number(
        process.env.RATE_LIMIT_WINDOW_MS ||
          60000
      ),

    generalMax:
      Number(
        process.env.RATE_LIMIT_MAX ||
          240
      ),

    /**
     * Read-aloud.
     */
    speechWindowMs:
      Number(
        process.env.RATE_LIMIT_SPEECH_WINDOW_MS ||
          60000
      ),

    speechMax:
      Number(
        process.env.RATE_LIMIT_SPEECH_MAX ||
          200
      ),
  },

  // ---------------------------------------------------------------------------
  // Feature state
  // ---------------------------------------------------------------------------

  get aiEnabled() {
    return Boolean(
      this.openRouterApiKey ||
        this.geminiApiKey ||
        this.openAiApiKey
    );
  },

  /**
   * Natural-voice read-aloud.
   * False = browser speech fallback.
   */
  get speechEnabled() {
    return Boolean(this.sarvamApiKey);
  },

  /**
   * Speech-to-Text transcription.
   */
  get sttEnabled() {
    return Boolean(this.sarvamApiKey);
  },

  /**
   * Determine primary AI provider.
   */
  get primaryProvider() {
    if (this.openRouterApiKey) {
      return 'openrouter';
    }

    if (this.geminiApiKey) {
      return 'gemini';
    }

    if (this.openAiApiKey) {
      return 'openai';
    }

    return 'offline_l0';
  },

  // ---------------------------------------------------------------------------
  // Startup warnings
  // ---------------------------------------------------------------------------

  /**
   * Configuration problems worth printing at boot.
   *
   * Never throws. SETU is designed to degrade gracefully.
   */
  warnings() {
    const notes = [];

    if (!this.aiEnabled) {
      notes.push(
        'No AI key set (OPENROUTER_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY). ' +
          'Running on the deterministic offline engine only.'
      );
    }

    if (
      this.nodeEnv === 'production' &&
      !allowedOrigins.length
    ) {
      notes.push(
        'CORS_ORIGINS is unset in production — ' +
          'the API will accept any web origin.'
      );
    }

    if (
      !Number.isFinite(this.port) ||
      this.port <= 0
    ) {
      notes.push(
        `PORT "${process.env.PORT}" is not a valid port number.`
      );
    }

    if (!this.openRouterApiKey) {
      notes.push(
        'OPENROUTER_API_KEY is not configured. ' +
          'OpenRouter models will be unavailable.'
      );
    }

    if (
      this.openRouterWebSearchEnabled &&
      !this.openRouterApiKey
    ) {
      notes.push(
        'OpenRouter web search is enabled but OPENROUTER_API_KEY is missing.'
      );
    }

    return notes;
  },
};