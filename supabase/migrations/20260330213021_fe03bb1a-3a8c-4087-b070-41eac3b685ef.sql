-- Fix volunteer management RLS: replace auth.users queries with auth.jwt()->>'email'

-- 1. clinic_roles
DROP POLICY IF EXISTS "Clinic admins can manage roles" ON clinic_roles;
CREATE POLICY "Clinic admins can manage roles"
  ON clinic_roles FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  );

-- 2. clinic_members
DROP POLICY IF EXISTS "Clinic admins can manage members" ON clinic_members;
CREATE POLICY "Clinic admins can manage members"
  ON clinic_members FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  );

-- 3. onboarding_steps
DROP POLICY IF EXISTS "Clinic admins can manage onboarding steps" ON onboarding_steps;
CREATE POLICY "Clinic admins can manage onboarding steps"
  ON onboarding_steps FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  );

-- 4. onboarding_progress
DROP POLICY IF EXISTS "Clinic admins can manage onboarding progress" ON onboarding_progress;
CREATE POLICY "Clinic admins can manage onboarding progress"
  ON onboarding_progress FOR ALL
  USING (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE lower(hp.admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT cm.id FROM clinic_members cm
      JOIN hospital_pages hp ON hp.id = cm.clinic_id
      WHERE lower(hp.admin_email) = lower(auth.jwt()->>'email')
    )
  );

-- 5. clinic_files
DROP POLICY IF EXISTS "Clinic admins can manage files" ON clinic_files;
CREATE POLICY "Clinic admins can manage files"
  ON clinic_files FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower(auth.jwt()->>'email')
    )
  );