-- ==============================================================================
-- SUPABASE COMPLETE TOURNAMENT DATABASE SETUP
-- Copy and run this script in your Supabase Project -> SQL Editor
-- This creates 3 sheets in your Table Editor:
--   1. teams       -> Manage team names and passwords (used for website login)
--   2. admins      -> Manage admin/host credentials (used for host login)
--   3. leaderboard -> Real-time quiz leaderboard, marks, and rankings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TEAMS TABLE (Credentials & Profile)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
    team_id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. ADMINS TABLE (Host Organizer Credentials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. LEADERBOARD TABLE (Live Scores, Marks, and Speed)
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
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- TEAMS POLICIES
DROP POLICY IF EXISTS "Allow public read teams" ON public.teams;
CREATE POLICY "Allow public read teams" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write teams" ON public.teams;
CREATE POLICY "Allow public write teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);

-- ADMINS POLICIES
DROP POLICY IF EXISTS "Allow public read admins" ON public.admins;
CREATE POLICY "Allow public read admins" ON public.admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write admins" ON public.admins;
CREATE POLICY "Allow public write admins" ON public.admins FOR ALL USING (true) WITH CHECK (true);

-- LEADERBOARD POLICIES
DROP POLICY IF EXISTS "Allow public read leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public read leaderboard" ON public.leaderboard FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public write leaderboard" ON public.leaderboard FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. STARTER DATA (Edit, add, or delete these rows directly in Supabase Table Editor!)
-- ------------------------------------------------------------------------------

-- Insert Starter Teams
INSERT INTO public.teams (team_id, team_name, password) VALUES
('TEAM001', 'Quantum Voyagers', 'pass123'),
('TEAM002', 'Cyber Knights', 'pass123'),
('TEAM003', 'Binary Bandits', 'pass123'),
('TEAM004', 'Neural Ninjas', 'pass123'),
('TEAM005', 'Apex Legends', 'pass123')
ON CONFLICT (team_id) DO NOTHING;

-- Insert Starter Admin/Host Credentials
INSERT INTO public.admins (username, password, role) VALUES
('admin', 'admin123', 'admin'),
('organizer', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;
