/**
 * SETU Backend — Cognitive Operating System API
 * ---------------------------------------------
 * OpenRouter AI Agent + MongoDB Persistence + File Processing Engine
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { connectDB, closeDB } = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
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

// Connect to MongoDB asynchronously
connectDB();

app.use('/api', apiRoutes);

app.get('/', (_req, res) => {
  res.json({
    product: 'SETU API',
    version: '3.0.0',
    primaryProvider: config.primaryProvider,
    database: 'MongoDB',
    docs: '/api/health'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use(errorHandler);

// Vercel imports the app; only bind a port when run directly.
if (require.main === module) {
  const server = app.listen(config.port, () => {
    const aiProviderInfo = config.openRouterApiKey
      ? `OpenRouter (${config.openRouterModel}) [Fallback Chain Active]`
      : config.geminiApiKey
        ? 'Google Gemini Direct'
        : config.openAiApiKey
          ? 'OpenAI Direct'
          : 'Deterministic L0 Offline Rule Engine';

    console.log(`\n  ======================================================`);
    console.log(`  SETU API Server → http://localhost:${config.port}`);
    console.log(`  Database        : MongoDB (${config.mongoUri})`);
    console.log(`  AI Engine       : ${aiProviderInfo}`);
    console.log(`  Health Check    : http://localhost:${config.port}/api/health`);
    console.log(`  ======================================================\n`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully.`);
      await closeDB();
      server.close(() => process.exit(0));
    });
  }
}

module.exports = app;
