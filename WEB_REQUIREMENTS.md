# SETU Sanctuary — Web Requirements & Production Setup Guide

See full details in [web-requirements.md](file:///D:/PROJECTS/setu/web-requirements.md).

## Quick Summary of Required Manual Steps:
1. **OpenRouter API Key**: Set `OPENROUTER_API_KEY=sk-or-v1-...` in your `.env` file ([Get key](https://openrouter.ai/keys)).
2. **MongoDB Connection String**: Set `MONGODB_URI=mongodb+srv://...` in `.env` (Atlas Cloud or Local `mongodb://127.0.0.1:27017/setu`).
3. **Start Backend**: `cd backend && npm start`
4. **Start Frontend**: `cd frontend && npm run dev`
5. **Run Smoke Test**: `cd backend && npm run smoke`
