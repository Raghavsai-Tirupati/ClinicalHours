-- ─── Waitlist / Interest Form Module ──────────────────────────────────────────

-- ─── 1. Feature Flags ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Optional: scope to a specific clinic
  clinic_id UUID REFERENCES hospital_pages(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX idx_feature_flags_clinic ON feature_flags(clinic_id) WHERE clinic_id IS NOT NULL;

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all flags
CREATE POLICY "Platform admins manage feature flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Clinic admins can read flags scoped to their clinic
CREATE POLICY "Clinic admins read own feature flags"
  ON feature_flags FOR SELECT
  USING (
    clinic_id IS NULL
    OR EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = feature_flags.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  );

-- Authenticated users can read global flags (for feature gating in UI)
CREATE POLICY "Authenticated users read global flags"
  ON feature_flags FOR SELECT
  USING (clinic_id IS NULL AND auth.uid() IS NOT NULL);

-- Seed BCS Free Health waitlist access flag
-- (clinic_id will be set by admin after deployment)
INSERT INTO feature_flags (flag_key, description, enabled)
VALUES ('waitlist_enabled', 'Enable waitlist / interest form module for clinics', true)
ON CONFLICT (flag_key) DO NOTHING;


-- ─── 2. Waitlist Settings (per clinic) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES hospital_pages(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT true,
  welcome_message TEXT DEFAULT 'Thank you for your interest! Please fill out this form to join our waitlist.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_settings_clinic ON waitlist_settings(clinic_id);
CREATE INDEX idx_waitlist_settings_slug ON waitlist_settings(slug);

CREATE TRIGGER update_waitlist_settings_updated_at
  BEFORE UPDATE ON waitlist_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE waitlist_settings ENABLE ROW LEVEL SECURITY;

-- Public read (need to check is_open for the public form)
CREATE POLICY "Anyone can read waitlist settings"
  ON waitlist_settings FOR SELECT
  USING (true);

-- Clinic admins can manage their own settings
CREATE POLICY "Clinic admins manage own waitlist settings"
  ON waitlist_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlist_settings.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlist_settings.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  );

-- Platform admins manage all
CREATE POLICY "Platform admins manage all waitlist settings"
  ON waitlist_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ─── 3. Waitlist Submissions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  -- Student info (mirrors real application fields)
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  university TEXT,
  major TEXT,
  gpa NUMERIC(4,2),
  graduation_year INT,
  -- Interest-specific
  role_interest TEXT CHECK (role_interest IN ('volunteer', 'internship', 'shadowing', 'paid', 'research', 'other')),
  availability_json JSONB, -- { days: [], time_pref, hours_per_week, commitment }
  message TEXT,
  -- Metadata
  converted_to_application_id UUID REFERENCES student_applications(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_submissions_clinic ON waitlist_submissions(clinic_id);
CREATE INDEX idx_waitlist_submissions_email ON waitlist_submissions(email);
CREATE INDEX idx_waitlist_submissions_submitted ON waitlist_submissions(submitted_at DESC);
CREATE INDEX idx_waitlist_submissions_role ON waitlist_submissions(role_interest);

ALTER TABLE waitlist_submissions ENABLE ROW LEVEL SECURITY;

-- Public insert (anyone can submit an interest form)
CREATE POLICY "Anyone can submit waitlist form"
  ON waitlist_submissions FOR INSERT
  WITH CHECK (true);

-- Clinic admins can read their own submissions
CREATE POLICY "Clinic admins read own waitlist submissions"
  ON waitlist_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlist_submissions.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  );

-- Clinic admins can update (for conversion tracking)
CREATE POLICY "Clinic admins update own waitlist submissions"
  ON waitlist_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlist_submissions.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlist_submissions.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  );

-- Platform admins can read all
CREATE POLICY "Platform admins read all waitlist submissions"
  ON waitlist_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Platform admins can update all
CREATE POLICY "Platform admins update all waitlist submissions"
  ON waitlist_submissions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Enable realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_submissions;
