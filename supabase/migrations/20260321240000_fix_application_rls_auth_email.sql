-- Fix RLS policies that used (SELECT email FROM auth.users WHERE id = auth.uid()).
-- That pattern requires querying auth.users which is not accessible to the
-- authenticated role, causing silent empty results.
-- Use auth.email() instead, which is a safe Supabase helper.

-- ── application_answers ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can view answers for own positions" ON public.application_answers;
CREATE POLICY "Hospital admins can view answers for own positions"
  ON public.application_answers FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT sa.id FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── student_applications ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can view applications for own positions" ON public.student_applications;
CREATE POLICY "Hospital admins can view applications for own positions"
  ON public.student_applications FOR SELECT
  TO authenticated
  USING (
    position_id IN (
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
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- Also allow admins to update notes field
DROP POLICY IF EXISTS "Hospital admins can update application notes" ON public.student_applications;
CREATE POLICY "Hospital admins can update application notes"
  ON public.student_applications FOR UPDATE
  TO authenticated
  USING (
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_application_answers: allow hospital page admins to read ──────────
-- hospital_application_answers was only readable by hospital members (old system).
-- Add a policy so hospital_pages admins (new system) can also read them.
DROP POLICY IF EXISTS "Hospital page admins can view legacy application answers" ON public.hospital_application_answers;
CREATE POLICY "Hospital page admins can view legacy application answers"
  ON public.hospital_application_answers FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT ha.id
      FROM public.hospital_applications ha
      JOIN public.hospital_accounts hac ON hac.id = ha.account_id
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_applications: allow hospital page admins to read ─────────────────
DROP POLICY IF EXISTS "Hospital page admins can view legacy applications" ON public.hospital_applications;
CREATE POLICY "Hospital page admins can view legacy applications"
  ON public.hospital_applications FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );

-- ── hospital_application_questions: allow hospital page admins to read ────────
DROP POLICY IF EXISTS "Hospital page admins can view legacy questions" ON public.hospital_application_questions;
CREATE POLICY "Hospital page admins can view legacy questions"
  ON public.hospital_application_questions FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
