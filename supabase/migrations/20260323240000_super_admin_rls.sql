-- Super-admin: clinicalhours.org@gmail.com can access and edit any clinic's data.
-- Adds is_super_admin() helper and extends all hospital-admin RLS policies.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT lower(coalesce(auth.email(), '')) = 'clinicalhours.org@gmail.com';
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Returns true when the authenticated user is the super-admin (clinicalhours.org@gmail.com).';

-- ── hospital_pages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can read own page" ON public.hospital_pages;
DROP POLICY IF EXISTS "Hospital admins can read own page by email" ON public.hospital_pages;
CREATE POLICY "Hospital admins can read own page"
  ON public.hospital_pages FOR SELECT
  TO authenticated
  USING (lower(admin_email) = lower(auth.email()) OR public.is_super_admin());

-- hospital_pages INSERT: super-admin can create pages (e.g. for new clinics)
DROP POLICY IF EXISTS "Hospital members can create own page" ON public.hospital_pages;
CREATE POLICY "Hospital members can create own page"
  ON public.hospital_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      hospital_id IN (
        SELECT o.id
        FROM public.opportunities o
        JOIN public.hospital_accounts ha ON ha.hospital_id = o.hospital_id
        JOIN public.hospital_members hm ON hm.account_id = ha.id
        WHERE hm.user_id = auth.uid()
      )
      AND lower(admin_email) = lower(auth.email())
    )
  );

-- hospital_pages UPDATE
DROP POLICY IF EXISTS "Hospital admins can update own page" ON public.hospital_pages;
CREATE POLICY "Hospital admins can update own page"
  ON public.hospital_pages FOR UPDATE
  TO authenticated
  USING (lower(admin_email) = lower(auth.email()) OR public.is_super_admin());

-- ── hospital_positions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can manage own positions" ON public.hospital_positions;
CREATE POLICY "Hospital admins can manage own positions"
  ON public.hospital_positions FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

-- ── position_questions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can manage own questions" ON public.position_questions;
CREATE POLICY "Hospital admins can manage own questions"
  ON public.position_questions FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── application_answers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can view answers for own positions" ON public.application_answers;
CREATE POLICY "Hospital admins can view answers for own positions"
  ON public.application_answers FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR application_id IN (
      SELECT sa.id FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── student_applications ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can view applications for own positions" ON public.student_applications;
CREATE POLICY "Hospital admins can view applications for own positions"
  ON public.student_applications FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "Hospital admins can update application status" ON public.student_applications;
CREATE POLICY "Hospital admins can update application status"
  ON public.student_applications FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "Hospital admins can update application notes" ON public.student_applications;
CREATE POLICY "Hospital admins can update application notes"
  ON public.student_applications FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_application_answers ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital page admins can view legacy application answers" ON public.hospital_application_answers;
CREATE POLICY "Hospital page admins can view legacy application answers"
  ON public.hospital_application_answers FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR application_id IN (
      SELECT ha.id
      FROM public.hospital_applications ha
      JOIN public.hospital_accounts hac ON hac.id = ha.account_id
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_applications ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital page admins can view legacy applications" ON public.hospital_applications;
CREATE POLICY "Hospital page admins can view legacy applications"
  ON public.hospital_applications FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "Hospital page admins can update legacy applications" ON public.hospital_applications;
CREATE POLICY "Hospital page admins can update legacy applications"
  ON public.hospital_applications FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_application_questions ────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital page admins can view legacy questions" ON public.hospital_application_questions;
CREATE POLICY "Hospital page admins can view legacy questions"
  ON public.hospital_application_questions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── admin_activity_log ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can read own activity" ON public.admin_activity_log;
CREATE POLICY "Hospital admins can read own activity"
  ON public.admin_activity_log FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "Hospital admins can insert own activity" ON public.admin_activity_log;
CREATE POLICY "Hospital admins can insert own activity"
  ON public.admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

-- ── profiles (hospital admins view applicant profiles) ────────────────────────
DROP POLICY IF EXISTS "Hospital admins can view applicant profiles" ON public.profiles;
CREATE POLICY "Hospital admins can view applicant profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR id IN (
      SELECT sa.student_id
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
