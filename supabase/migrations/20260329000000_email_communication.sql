-- ============================================================
-- Email Communication Module
-- Tables: email_templates, email_send_logs
-- ============================================================

-- ── email_templates ─────────────────────────────────────────
-- Per-clinic customizable email templates with category and
-- support for variable placeholders ({{name}}, {{role}}, etc.)

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('accepted','rejected','waitlisted','on_call','onboarding')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_templates_clinic ON email_templates(clinic_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Clinic admins (email match on hospital_pages)
CREATE POLICY email_templates_clinic_admin ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hospital_pages hp
      WHERE hp.id = email_templates.clinic_id
        AND hp.admin_email = auth.jwt()->>'email'
    )
  );

-- Platform admins
CREATE POLICY email_templates_platform_admin ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Auto-update updated_at on changes
CREATE TRIGGER trg_email_templates_updated
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── email_send_logs ─────────────────────────────────────────
-- Audit trail for every bulk email sent from the clinic dashboard.

CREATE TABLE IF NOT EXISTS email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  subject TEXT NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  sent_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','partial','failed')) DEFAULT 'sent',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_logs_clinic ON email_send_logs(clinic_id);
CREATE INDEX idx_email_send_logs_created ON email_send_logs(created_at DESC);

ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;

-- Clinic admins
CREATE POLICY email_send_logs_clinic_admin ON email_send_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hospital_pages hp
      WHERE hp.id = email_send_logs.clinic_id
        AND hp.admin_email = auth.jwt()->>'email'
    )
  );

-- Platform admins
CREATE POLICY email_send_logs_platform_admin ON email_send_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );
