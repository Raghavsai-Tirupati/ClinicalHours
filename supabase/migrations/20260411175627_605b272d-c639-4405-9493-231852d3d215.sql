-- Stores a record each time a new-application email is sent to a hospital admin
CREATE TABLE IF NOT EXISTS admin_notification_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_page_id UUID REFERENCES hospital_pages(id) ON DELETE SET NULL,
  admin_email   TEXT NOT NULL,
  applicant_name  TEXT,
  applicant_email TEXT,
  position_title  TEXT,
  status        TEXT NOT NULL DEFAULT 'sent'
);

ALTER TABLE admin_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read notification log"
  ON admin_notification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can insert notification log"
  ON admin_notification_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_admin_notification_log_sent_at ON admin_notification_log(sent_at DESC);
CREATE INDEX idx_admin_notification_log_hospital_page_id ON admin_notification_log(hospital_page_id);