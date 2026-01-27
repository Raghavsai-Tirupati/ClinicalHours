-- Create verification_sessions table for auto-login after email verification
CREATE TABLE IF NOT EXISTS verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_verification_sessions_token ON verification_sessions(token);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires_at ON verification_sessions(expires_at);

-- Enable RLS
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

-- No direct access from client - only edge functions with service role can access
-- This is intentional for security
