-- Add Gmail OAuth credentials storage to hospital_pages
-- Refresh tokens are encrypted at rest by Supabase (column-level encryption not used here,
-- but the table is protected by RLS and the service-role key controls writes).

ALTER TABLE hospital_pages
  ADD COLUMN IF NOT EXISTS gmail_refresh_token  text,
  ADD COLUMN IF NOT EXISTS gmail_email          text,
  ADD COLUMN IF NOT EXISTS gmail_connected_at   timestamptz;

-- Only the row owner (admin) and service role may read/write these columns.
-- The existing RLS policies already restrict hospital_pages access to the admin_email holder,
-- so no additional policies are needed.  We do, however, want to make sure the refresh token
-- is never exposed via the anon/authenticated select policies.  We achieve this by having the
-- frontend query exclude that column (the hook only selects named fields), and by ensuring
-- the service-role key (used only in edge functions) is the only writer.

COMMENT ON COLUMN hospital_pages.gmail_refresh_token IS
  'Google OAuth 2.0 refresh token for Gmail send-on-behalf. Written only by edge functions using the service role.';
COMMENT ON COLUMN hospital_pages.gmail_email IS
  'The Gmail address that was authorised (used as display info in the UI).';
COMMENT ON COLUMN hospital_pages.gmail_connected_at IS
  'Timestamp when Gmail was last successfully connected.';
