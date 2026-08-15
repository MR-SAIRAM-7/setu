/**
 * SETU Backend — Cognitive Operating System API
 * ---------------------------------------------
 * Shared AI orchestration, MongoDB persistence, and document processing for
 * both the Sanctuary web app and the Lens browser extension.
 *
 * The process is designed to start and stay useful in a degraded state: with no
 * AI key it falls back to the deterministic offline engine, and with no database
 * it serves clients that keep their own local copy. Missing configuration is
 * reported at boot rather than treated as fatal.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { connectDB, closeDB } = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');
const errorHandler = require('./middleware/errorHandler');
const { securityHeaders, createRateLimiter } = require('./middleware/security');

const app = express();

app.disable('x-powered-by');
// Behind Vercel, Render, or any reverse proxy, req.ip must come from
// X-Forwarded-For or every client shares the proxy's address in the rate limiter.
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(cors(config.corsOptions));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request logger — skipped in tests to keep output clean.
if (config.nodeEnv !== 'test') {
  app.use((req, _res, next) => {
    if (req.path !== '/api/health') {
      console.log(`[SETU] ${req.method} ${req.path}`);
    }
    next();
  });
}

// Connect to MongoDB in the background; the API serves requests either way.
connectDB();

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

const generalLimiter = createRateLimiter({
  windowMs: config.rateLimit.generalWindowMs,
  max: config.rateLimit.generalMax,
  keyPrefix: 'general'
});

const aiLimiter = createRateLimiter({
  windowMs: config.rateLimit.aiWindowMs,
  max: config.rateLimit.aiMax,
  keyPrefix: 'ai',
  message:
    'You are researching faster than the AI quota allows. Give it a minute and try again.'
});

/** Routes that cost a model call, and so are worth protecting from a hot loop. */
const AI_ROUTES = [
  '/api/chat',
  '/api/research/mindmap',
  '/api/research/expand',
  '/api/start',
  '/api/simplify',
  '/api/learn',
  '/api/meet',
  '/api/practice',
  '/api/write',
  '/api/guide',
  '/api/summarize',
  '/api/explain',
  '/api/agent/plan',
  '/api/agent/navigate',
  '/api/agent/explain',
  '/api/agent/chunk',
  '/api/agent/describe-image',
  '/api/files/upload'
];

app.use('/api', generalLimiter);
app.use(AI_ROUTES, aiLimiter);
// Mind maps built from a document also run the full research pipeline.
app.use('/api/files/:id/mindmap', aiLimiter);
app.use('/api/files/:id/query', aiLimiter);

app.use('/api', apiRoutes);

app.get('/api', (_req, res) => {
  res.json({
    product: 'SETU API',
    version: '3.0.0',
    primaryProvider: config.primaryProvider,
    database: 'MongoDB',
    docs: '/api/health'
  });
});

// Anything under /api that reached here has no route.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

/* -------------------------------------------------------------------------- */
/* Static SPA (single-service deploy)                                         */
/* -------------------------------------------------------------------------- */

const distDir = path.resolve(__dirname, '../frontend/dist');
const hasBuiltFrontend = config.serveStatic && fs.existsSync(path.join(distDir, 'index.html'));

if (hasBuiltFrontend) {
  // Hashed assets are immutable; index.html must never be cached or a deploy
  // leaves clients pointing at asset filenames that no longer exist.
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1y',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      }
    })
  );

  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      product: 'SETU API',
      version: '3.0.0',
      primaryProvider: config.primaryProvider,
      database: 'MongoDB',
      docs: '/api/health',
      note: 'No built frontend found. Run "npm run build" in /frontend to serve the web app from here.'
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });
}

app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

// Vercel imports the app; only bind a port when run directly.
if (require.main === module) {
  const aiProviderInfo = config.openRouterApiKey
    ? `OpenRouter (${config.openRouterModel}) [fallback chain active]`
    : config.geminiApiKey
      ? 'Google Gemini Direct'
      : config.openAiApiKey
        ? 'OpenAI Direct'
        : 'Deterministic L0 offline rule engine';

  const server = app.listen(config.port, () => {
    console.log('\n  ======================================================');
    console.log(`  SETU API Server → http://localhost:${config.port}`);
    console.log(`  Database        : MongoDB (${config.safeMongoUri})`);
    console.log(`  AI Engine       : ${aiProviderInfo}`);
    console.log(`  Web app         : ${hasBuiltFrontend ? 'served from /frontend/dist' : 'run separately (npm run dev)'}`);
    console.log(`  Health Check    : http://localhost:${config.port}/api/health`);
    console.log('  ======================================================\n');

    for (const warning of config.warnings()) {
      console.warn(`  [SETU config] ${warning}`);
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n  Port ${config.port} is already in use. Stop the other process or set PORT to a free port.\n`
      );
      process.exit(1);
    }
    throw error;
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down gracefully.`);

    // Force exit if connections refuse to drain, so a container restart is not blocked.
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref?.();

    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => shutdown(signal));
  }

  // A rejected promise must not take the engine down mid-demo.
  process.on('unhandledRejection', (reason) => {
    console.error('[SETU] Unhandled promise rejection:', reason);
  });
}

module.exports = app;
