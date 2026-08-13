# NeuroRead — Production Deployment & Hackathon Presentation Guide

This guide outlines how to deploy NeuroRead to production on **Vercel**, **Render**, and **Supabase**, and how to showcase it to hackathon judges.

---

## 🚀 1-Click Vercel Deployment (Unified Web & API)

NeuroRead includes a root `vercel.json` configuration for single-command deployment:

1. Install Vercel CLI (or connect GitHub repository to Vercel):
   ```bash
   npm i -g vercel
   vercel
   ```
2. Set Environment Variables in Vercel Dashboard:
   - `REACT_APP_SUPABASE_URL` = `https://your-project.supabase.co`
   - `REACT_APP_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
   - `GEMINI_API_KEY` = `your-gemini-api-key` (Optional for AI Cloud generation)

---

## 🗄️ Supabase Cloud Database Deployment

1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new database project.
3. Open **SQL Editor** -> Paste `supabase/schema.sql` -> Click **Run**.
4. The database is live with Row-Level Security (RLS) enabled.

---

## 🧩 Chrome Extension Loading & Web Store Deployment

1. Open Google Chrome -> Go to `chrome://extensions`.
2. Enable **Developer mode** toggle in top-right.
3. Click **Load unpacked** -> Select `chrome-extension/` folder.
4. Click the NeuroRead puzzle icon and pin it to Chrome toolbar!

---

## 🏆 Hackathon Judge Review Walkthrough (Winning Presentation Steps)

### Step 1: Launch Web Application
Run `npm start` in `frontend/` (or open deployed Vercel URL).

### Step 2: Use the Hackathon Judge Quick Preset Bar
Click any preset on top of the dashboard:
- ⚡ **Complex EPFO Portal Notice** -> See instant simplification to Grade 6.0 plain text.
- ⚡ **ADHD Thesis Task** -> See Start Mode break executive dysfunction freeze into 10-min action items.
- ⚡ **Neuroscience Paper** -> Click "Open Interactive Mindmap Canvas" to view draggable node trees.

### Step 3: Interactive Mindmap Canvas (`/canvas`)
- Drag nodes around, edit notes, change color swatches.
- Type any topic in the AI Prompt box (e.g., *"Photosynthesis"* or *"ADHD Focus"*) and click **AI Generate**.
- Click **Save to Supabase** to verify cloud persistence.

### Step 4: AI Chat Application Form (`/chat`)
- Use quick prompt pills or click the **Microphone icon** to speak.
- Listen to AI responses via **Read Aloud (TTS)**.
- Click **Turn to Mindmap** to send AI responses straight to the Mindmap Canvas!

### Step 5: Live Reading Playground (`/playground`)
- Test Bionic Reading bolding, Reading Line Ruler spotlight, OpenDyslexic typography, and WPM auto-scrolling live.

---

## 🔒 Security & Privacy Checklist
- Zero telemetry tracking.
- Local deterministic engine fallback (L0) works 100% offline.
- Supabase Row Level Security (RLS) protects user data.
