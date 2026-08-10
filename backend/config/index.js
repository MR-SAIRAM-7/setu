const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root and backend .env files
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openAiApiKey: process.env.OPENAI_API_KEY || null,
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  maxTextLength: 16000,
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};
