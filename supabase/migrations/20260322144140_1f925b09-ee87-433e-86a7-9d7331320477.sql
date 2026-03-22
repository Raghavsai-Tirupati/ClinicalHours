
ALTER TABLE hospital_pages
  ADD COLUMN IF NOT EXISTS gmail_refresh_token  text,
  ADD COLUMN IF NOT EXISTS gmail_email          text,
  ADD COLUMN IF NOT EXISTS gmail_connected_at   timestamptz;

COMMENT ON COLUMN hospital_pages.gmail_refresh_token IS 'Written only by edge functions using the service role';
COMMENT ON COLUMN hospital_pages.gmail_email IS 'The Gmail address that was authorised';
COMMENT ON COLUMN hospital_pages.gmail_connected_at IS 'Timestamp when Gmail was last successfully connected';
