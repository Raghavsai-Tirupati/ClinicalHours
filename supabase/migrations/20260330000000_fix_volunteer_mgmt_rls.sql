-- Fix volunteer management RLS policies
-- Replace auth.users table access with auth.jwt()->>'email' to avoid permission errors

-- ============================================================
-- 1. clinic_roles policies
-- ============================================================
DROP POLICY IF EXISTS "Clinic admins can manage roles" ON clinic_roles;
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

-- ============================================================
-- 2. clinic_members policies
-- ============================================================
DROP POLICY IF EXISTS "Clinic admins can manage members" ON clinic_members;
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

-- ============================================================
-- 3. onboarding_steps policies
-- ============================================================
DROP POLICY IF EXISTS "Clinic admins can manage onboarding steps" ON onboarding_steps;
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

-- ============================================================
-- 4. onboarding_progress policies
-- ============================================================
DROP POLICY IF EXISTS "Clinic admins can manage onboarding progress" ON onboarding_progress;
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

-- ============================================================
-- 5. clinic_files policies
-- ============================================================
DROP POLICY IF EXISTS "Clinic admins can manage files" ON clinic_files;
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

-- ============================================================
-- 6. Fix Members can view own record policy too
-- ============================================================
DROP POLICY IF EXISTS "Members can view own record" ON clinic_members;
CREATE POLICY "Members can view own record"
  ON clinic_members FOR SELECT
  USING (user_id = auth.uid());
