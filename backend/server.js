/**
 * NeuroBridge One Backend Application Entrypoint
 * Enterprise Modular Architecture
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const apiRoutes = require('./routes/apiRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors(config.corsOptions));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Mount Modular API Router
app.use('/api', apiRoutes);

// Global Centralized Error Handling
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[NeuroBridge One Engine] Listening on http://localhost:${config.port}`);
});

module.exports = app;
