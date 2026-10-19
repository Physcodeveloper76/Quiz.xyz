-- ================================================================
-- SUPABASE LEADERBOARD SETUP SCRIPT
-- Copy and run this script in your Supabase Project -> SQL Editor
-- ================================================================

-- 1. Create the leaderboard table
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

-- 2. Create index on marks & total_time_ms for fast sorting
CREATE INDEX IF NOT EXISTS idx_leaderboard_marks_time 
ON public.leaderboard (quiz_id, marks DESC, total_time_ms ASC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies: Public Read Access
DROP POLICY IF EXISTS "Allow public read access to leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public read access to leaderboard"
ON public.leaderboard FOR SELECT
USING (true);

-- 5. Create Policies: Full Read/Write Access for Backend & Dashboard
DROP POLICY IF EXISTS "Allow public insert/update to leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public insert/update to leaderboard"
ON public.leaderboard FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Enable Realtime on this table (Optional, for Supabase live listener)
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
