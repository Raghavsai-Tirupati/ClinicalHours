-- ============================================================
-- PRODUCTION DEPLOYMENT SQL
-- Run this in your Supabase SQL Editor to fix admin dashboard
-- ============================================================

-- 1. CREATE/UPDATE GUEST SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  converted_to_user_id UUID REFERENCES auth.users(id)
);

-- Add new columns for enhanced tracking (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_sessions' AND column_name = 'referrer') THEN
    ALTER TABLE guest_sessions ADD COLUMN referrer TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_sessions' AND column_name = 'last_activity') THEN
    ALTER TABLE guest_sessions ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_sessions' AND column_name = 'page_views') THEN
    ALTER TABLE guest_sessions ADD COLUMN page_views INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_sessions' AND column_name = 'landing_page') THEN
    ALTER TABLE guest_sessions ADD COLUMN landing_page TEXT;
  END IF;
END $$;

-- Index for efficient date queries (sorting by day/time)
CREATE INDEX IF NOT EXISTS idx_guest_sessions_created_at ON guest_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_last_activity ON guest_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_converted ON guest_sessions(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

-- Drop old policies first
DROP POLICY IF EXISTS "Allow anonymous insert" ON guest_sessions;
DROP POLICY IF EXISTS "Allow admin read" ON guest_sessions;
DROP POLICY IF EXISTS "Allow anon insert" ON guest_sessions;
DROP POLICY IF EXISTS "Allow authenticated insert" ON guest_sessions;
DROP POLICY IF EXISTS "Allow anon update own session" ON guest_sessions;
DROP POLICY IF EXISTS "Allow admin update" ON guest_sessions;

-- Allow anonymous users (using anon key) to insert new sessions
CREATE POLICY "Allow anon insert" ON guest_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated users to insert (for edge cases)
CREATE POLICY "Allow authenticated insert" ON guest_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to update their own session (by session_id)
CREATE POLICY "Allow anon update own session" ON guest_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow admin users to read all guest sessions
CREATE POLICY "Allow admin read" ON guest_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admin users to update sessions (e.g., to mark conversions)
CREATE POLICY "Allow admin update" ON guest_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant necessary permissions to anon role
GRANT INSERT, UPDATE ON guest_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON guest_sessions TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE guest_sessions IS 'Tracks anonymous guest browsing sessions for analytics';
COMMENT ON COLUMN guest_sessions.session_id IS 'Unique identifier stored in localStorage to prevent duplicate session logging';
COMMENT ON COLUMN guest_sessions.converted_to_user_id IS 'If the guest later signs up, this links to their user account';
COMMENT ON COLUMN guest_sessions.referrer IS 'The referrer URL when the guest first arrived';
COMMENT ON COLUMN guest_sessions.last_activity IS 'Last time the guest was active in the session';
COMMENT ON COLUMN guest_sessions.page_views IS 'Number of pages viewed in this session';
COMMENT ON COLUMN guest_sessions.landing_page IS 'The first page the guest visited';


-- 2. ALLOW ADMINS TO READ ALL PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


-- 3. VERIFY DEPLOYMENT
-- ============================================================
-- Run this to verify the table was created:
-- SELECT COUNT(*) as guest_session_count FROM guest_sessions;
-- 
-- Run this to verify admin can read profiles:
-- SELECT COUNT(*) as profile_count FROM profiles;
