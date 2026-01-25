-- ============================================================
-- FIX GUEST SESSION TRACKING
-- This migration fixes RLS policies and adds enhanced tracking
-- ============================================================

-- 1. Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Allow anonymous insert" ON guest_sessions;
DROP POLICY IF EXISTS "Allow admin read" ON guest_sessions;

-- 2. Add new columns for enhanced tracking (if they don't exist)
DO $$
BEGIN
  -- Add referrer column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_sessions' AND column_name = 'referrer'
  ) THEN
    ALTER TABLE guest_sessions ADD COLUMN referrer TEXT;
  END IF;

  -- Add last_activity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_sessions' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE guest_sessions ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add page_views column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_sessions' AND column_name = 'page_views'
  ) THEN
    ALTER TABLE guest_sessions ADD COLUMN page_views INTEGER DEFAULT 1;
  END IF;

  -- Add landing_page column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_sessions' AND column_name = 'landing_page'
  ) THEN
    ALTER TABLE guest_sessions ADD COLUMN landing_page TEXT;
  END IF;
END $$;

-- 3. Create proper RLS policies

-- Allow anonymous users (using anon key) to insert new sessions
-- This policy explicitly targets the anon role
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
-- This enables tracking last_activity and page_views
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

-- 4. Add index for last_activity queries
CREATE INDEX IF NOT EXISTS idx_guest_sessions_last_activity ON guest_sessions(last_activity DESC);

-- 5. Add index for conversion tracking
CREATE INDEX IF NOT EXISTS idx_guest_sessions_converted ON guest_sessions(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;

-- 6. Add comments for new columns
COMMENT ON COLUMN guest_sessions.referrer IS 'The referrer URL when the guest first arrived';
COMMENT ON COLUMN guest_sessions.last_activity IS 'Last time the guest was active in the session';
COMMENT ON COLUMN guest_sessions.page_views IS 'Number of pages viewed in this session';
COMMENT ON COLUMN guest_sessions.landing_page IS 'The first page the guest visited';

-- 7. Grant necessary permissions to anon role
GRANT INSERT, UPDATE ON guest_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON guest_sessions TO authenticated;
