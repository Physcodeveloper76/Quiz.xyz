-- ==============================================================================
-- SUPABASE COMPLETE TOURNAMENT DATABASE SETUP
-- Copy and run this script in your Supabase Project -> SQL Editor
-- This creates 2 primary sheets in your Table Editor:
--   1. login_credentials -> Unified table of both Team and Organizer logins
--   2. leaderboard       -> Real-time quiz scores, marks, and rankings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LOGIN CREDENTIALS TABLE (Teams + Organizers in One Sheet)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_credentials (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team', -- 'team' or 'organizer'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. LEADERBOARD TABLE (Live Scores, Marks, and Speed)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leaderboard (
    quiz_id TEXT NOT NULL DEFAULT 'default_quiz',
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    marks NUMERIC NOT NULL DEFAULT 0,
    total_score NUMERIC NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    total_time_ms NUMERIC NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quiz_id, team_id)
);

-- Index for instant leaderboard sorting
CREATE INDEX IF NOT EXISTS idx_leaderboard_marks_time 
ON public.leaderboard (quiz_id, marks DESC, total_time_ms ASC);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.login_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- LOGIN CREDENTIALS POLICIES
DROP POLICY IF EXISTS "Allow public read login_credentials" ON public.login_credentials;
CREATE POLICY "Allow public read login_credentials" ON public.login_credentials FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write login_credentials" ON public.login_credentials;
CREATE POLICY "Allow public write login_credentials" ON public.login_credentials FOR ALL USING (true) WITH CHECK (true);

-- LEADERBOARD POLICIES
DROP POLICY IF EXISTS "Allow public read leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public read leaderboard" ON public.leaderboard FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public write leaderboard" ON public.leaderboard FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. STARTER CREDENTIALS (Edit, add, or delete these in Supabase Table Editor!)
-- ------------------------------------------------------------------------------
INSERT INTO public.login_credentials (username, name, password, role) VALUES
-- Organizers (Host Login)
('admin', 'Head Organizer', 'admin123', 'organizer'),
('organizer', 'Quiz Master', 'admin123', 'organizer'),

-- Teams (Team Login)
('TEAM001', 'Quantum Voyagers', 'pass123', 'team'),
('TEAM002', 'Cyber Knights', 'pass123', 'team'),
('TEAM003', 'Binary Bandits', 'pass123', 'team'),
('TEAM004', 'Neural Ninjas', 'pass123', 'team'),
('TEAM005', 'Apex Legends', 'pass123', 'team')
ON CONFLICT (username) DO UPDATE 
SET password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role;
