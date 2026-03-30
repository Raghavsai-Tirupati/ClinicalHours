-- Volunteer Management Module

-- 1. clinic_roles
CREATE TABLE IF NOT EXISTS clinic_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  role_name  TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_roles_clinic ON clinic_roles(clinic_id, sort_order);
ALTER TABLE clinic_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage roles"
  ON clinic_roles FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Platform admins manage all roles"
  ON clinic_roles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. clinic_members
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

CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic ON clinic_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_user ON clinic_members(user_id);
ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage members"
  ON clinic_members FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

CREATE POLICY "Members can view own record"
  ON clinic_members FOR SELECT
  USING (user_id = auth.uid());

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

-- 3. onboarding_steps
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_clinic ON onboarding_steps(clinic_id, sort_order);
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage onboarding steps"
  ON onboarding_steps FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

-- 4. onboarding_progress
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

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_member ON onboarding_progress(member_id);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage onboarding progress"
  ON onboarding_progress FOR ALL
  USING (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE hp.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE hp.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

CREATE TRIGGER trg_onboarding_progress_updated_at
  BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_clinic_members_updated_at();

-- 5. clinic_files
CREATE TABLE IF NOT EXISTS clinic_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES clinic_members(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   BIGINT,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_files_clinic ON clinic_files(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_files_member ON clinic_files(member_id);
ALTER TABLE clinic_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage files"
  ON clinic_files FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-files', 'clinic-files', false)
ON CONFLICT (id) DO NOTHING;

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

-- 7. Seed functions
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