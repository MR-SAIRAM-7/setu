/**
 * SETU Backend — Cognitive Operating System API
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
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Lightweight request log — skipped in tests to keep output clean.
if (config.nodeEnv !== 'test') {
  app.use((req, _res, next) => {
    if (req.path !== '/api/health') {
      console.log(`${req.method} ${req.path}`);
    }
    next();
  });
}

// Connect to MongoDB asynchronously
connectDB();

app.use('/api', apiRoutes);

app.get('/', (_req, res) => {
  res.json({ product: 'SETU API', version: '3.0.0', database: 'MongoDB', docs: '/api/health' });
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use(errorHandler);

// Vercel imports the app; only bind a port when run directly.
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`\n  SETU API  →  http://localhost:${config.port}`);
    console.log(`  Database  :  MongoDB (${config.mongoUri})`);
    console.log(`  AI provider: ${config.geminiApiKey ? 'Gemini' : config.openAiApiKey ? 'OpenAI' : 'NONE — set GEMINI_API_KEY'}\n`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down.`);
      await closeDB();
      server.close(() => process.exit(0));
    });
  }
}

module.exports = app;
