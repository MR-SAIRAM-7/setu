-- ==========================================================
-- NeuroRead / SETU — Supabase Database Schema
-- Problem Statement 01: NeuroInclusive Tech
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES / ACCESSIBILITY MEMORY TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL DEFAULT 'anonymous_user',
    reading_wpm INT DEFAULT 240,
    preferred_theme TEXT DEFAULT 'default',
    font_family TEXT DEFAULT 'OpenDyslexic',
    sensory_calm BOOLEAN DEFAULT false,
    bionic_reading_enabled BOOLEAN DEFAULT true,
    focus_mode_defaults JSONB DEFAULT '{"contrast": "standard", "hideAds": true, "fontSize": "18px"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SAVED ACCESSIBILITY SUMMARIES TABLE
CREATE TABLE IF NOT EXISTS public.saved_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'anonymous_user',
    title TEXT NOT NULL,
    source_url TEXT,
    content TEXT,
    summary_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    mode TEXT NOT NULL DEFAULT 'simplify',
    readability_before NUMERIC(4, 1),
    readability_after NUMERIC(4, 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MINDMAPS CANVAS TABLE
CREATE TABLE IF NOT EXISTS public.mindmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'anonymous_user',
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI CHAT ASSISTANT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'anonymous_user',
    session_id TEXT NOT NULL DEFAULT 'default_session',
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    mode TEXT DEFAULT 'general',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXECUTIVE DYSFUNCTION TASK CHUNKS TABLE (Start Mode)
CREATE TABLE IF NOT EXISTS public.task_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'anonymous_user',
    title TEXT NOT NULL,
    original_task TEXT NOT NULL,
    anxiety_level TEXT DEFAULT 'Low',
    effort_level TEXT DEFAULT 'Low',
    steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed')),
    completed_steps INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated access policies for hackathon demo
CREATE POLICY "Allow public read profile" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update profile" ON public.profiles FOR ALL USING (true);

CREATE POLICY "Allow public read summaries" ON public.saved_summaries FOR SELECT USING (true);
CREATE POLICY "Allow public insert summaries" ON public.saved_summaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete summaries" ON public.saved_summaries FOR DELETE USING (true);

CREATE POLICY "Allow public read mindmaps" ON public.mindmaps FOR SELECT USING (true);
CREATE POLICY "Allow public write mindmaps" ON public.mindmaps FOR ALL USING (true);

CREATE POLICY "Allow public read chat" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow public write chat" ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read tasks" ON public.task_items FOR SELECT USING (true);
CREATE POLICY "Allow public write tasks" ON public.task_items FOR ALL USING (true);
