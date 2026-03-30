-- Volunteer Management Module
-- Tables: clinic_roles, clinic_members, onboarding_steps, onboarding_progress, clinic_files

-- ============================================================
-- 1. clinic_roles — custom roles per clinic (hospital_page)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  role_name  TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',  -- hex color
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_roles_clinic ON clinic_roles(clinic_id, sort_order);

ALTER TABLE clinic_roles ENABLE ROW LEVEL SECURITY;

-- Hospital admins can manage their own clinic's roles
CREATE POLICY "Clinic admins can manage roles"
  ON clinic_roles FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

-- Platform admins can manage all
CREATE POLICY "Platform admins manage all roles"
  ON clinic_roles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. clinic_members — volunteers/staff roster
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  role_id           UUID REFERENCES clinic_roles(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  onboarding_source TEXT NOT NULL DEFAULT 'new_applicant' CHECK (onboarding_source IN ('new_applicant', 'existing_staff')),
  hours_logged      NUMERIC(8,1) NOT NULL DEFAULT 0,
  join_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_members_clinic ON clinic_members(clinic_id);
CREATE INDEX idx_clinic_members_user ON clinic_members(user_id);

ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage members"
  ON clinic_members FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all members"
  ON clinic_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Members can view their own record
CREATE POLICY "Members can view own record"
  ON clinic_members FOR SELECT
  USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_clinic_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinic_members_updated_at
  BEFORE UPDATE ON clinic_members
  FOR EACH ROW EXECUTE FUNCTION update_clinic_members_updated_at();

-- ============================================================
-- 3. onboarding_steps — template steps per clinic
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_steps_clinic ON onboarding_steps(clinic_id, sort_order);

ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage onboarding steps"
  ON onboarding_steps FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all onboarding steps"
  ON onboarding_steps FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 4. onboarding_progress — per-member step completion
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES clinic_members(id) ON DELETE CASCADE,
  step_id     UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  notes       TEXT,
  completed_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, step_id)
);

CREATE INDEX idx_onboarding_progress_member ON onboarding_progress(member_id);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage onboarding progress"
  ON onboarding_progress FOR ALL
  USING (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE hp.admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE hp.admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all onboarding progress"
  ON onboarding_progress FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE TRIGGER trg_onboarding_progress_updated_at
  BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_clinic_members_updated_at();

-- ============================================================
-- 5. clinic_files — file metadata (per-member or shared)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES clinic_members(id) ON DELETE CASCADE,  -- NULL = shared/clinic-wide
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,  -- path in Supabase Storage
  file_size   BIGINT,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_files_clinic ON clinic_files(clinic_id);
CREATE INDEX idx_clinic_files_member ON clinic_files(member_id);

ALTER TABLE clinic_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage files"
  ON clinic_files FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all files"
  ON clinic_files FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 6. Supabase Storage bucket for clinic files
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-files', 'clinic-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: clinic admins can upload/read/delete
CREATE POLICY "Clinic admins can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'clinic-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Clinic admins can read files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'clinic-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Clinic admins can delete files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'clinic-files'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- 7. Seed default onboarding steps function
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_onboarding_steps(p_clinic_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO onboarding_steps (clinic_id, step_name, description, sort_order)
  VALUES
    (p_clinic_id, 'Application Submitted',  'Initial application has been received', 0),
    (p_clinic_id, 'Documents Submitted',    'Required documents (ID, certifications) uploaded', 1),
    (p_clinic_id, 'Background Check',       'Background check initiated and cleared', 2),
    (p_clinic_id, 'Orientation Complete',    'Attended orientation session', 3),
    (p_clinic_id, 'Training Complete',       'Completed required training modules', 4),
    (p_clinic_id, 'Ready to Start',         'Fully onboarded and ready for first shift', 5)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Seed default roles function
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_clinic_roles(p_clinic_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO clinic_roles (clinic_id, role_name, color, sort_order)
  VALUES
    (p_clinic_id, 'MD',        '#ef4444', 0),
    (p_clinic_id, 'RN',        '#3b82f6', 1),
    (p_clinic_id, 'Volunteer', '#22c55e', 2),
    (p_clinic_id, 'Intern',    '#f59e0b', 3)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
