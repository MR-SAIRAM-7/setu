# NeuroRead — Supabase Database Integration Guide

NeuroRead features cloud data synchronization powered by **Supabase**. It saves user accessibility settings, AI summaries, mindmap canvases, chat assistant histories, and executive dysfunction task chunks.

---

## ⚡ Zero-Friction Hackathon Mode (Offline Fallback)
If `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are not set, NeuroRead automatically activates its **Deterministic LocalStorage Memory Layer**. 

> **Judges can run and test 100% of the features without setting up a Supabase project or any external credentials.**

---

## 🚀 Setting Up Your Own Supabase Cloud Database

Follow these steps to connect your own Supabase instance:

### 1. Create a Supabase Project
1. Sign in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and select a database password & region.

### 2. Run the Database Schema SQL
1. Open your Supabase project dashboard.
2. Go to **SQL Editor** -> **New Query**.
3. Copy and paste the contents of `supabase/schema.sql` (located in this project root).
4. Click **Run** to execute the script and create all 5 tables (`profiles`, `saved_summaries`, `mindmaps`, `chat_messages`, `task_items`).

### 3. Add Environment Variables
In your root `.env` file or `frontend/.env` and `backend/.env`:

```env
# Frontend Environment Variables
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# Backend Environment Variables
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

Restart your backend server (`npm start` in `backend`) and frontend web app (`npm start` in `frontend`).

---

## 📊 Database Table Architecture

| Table Name | Purpose | Key Columns |
|---|---|---|
| `profiles` | Stores user reading speed (WPM), active theme, font preferences, and sensory calm toggle. | `user_id`, `reading_wpm`, `preferred_theme`, `font_family`, `sensory_calm` |
| `saved_summaries` | Stores outputs from Simplify Mode, Meet Mode, and AI Summarizer. | `id`, `user_id`, `title`, `summary_points`, `readability_after` |
| `mindmaps` | Stores node-based visual mindmap canvas data for Learn Mode. | `id`, `title`, `topic`, `nodes_json`, `edges_json` |
| `chat_messages` | Stores AI Assistant conversation transcript. | `id`, `session_id`, `role`, `content`, `mode` |
| `task_items` | Stores executive dysfunction micro-action steps for Start Mode. | `id`, `title`, `anxiety_level`, `effort_level`, `steps_json` |

---

## 🔒 Security & Row Level Security (RLS)
- Public RLS policies are enabled by default for rapid hackathon testing and demo purposes.
- For enterprise deployment, policies can be restricted using `auth.uid()` binding.
