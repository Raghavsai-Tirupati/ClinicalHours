-- Fix 1: Add missing answer_options column to application_answers.
-- The column was referenced in frontend queries but never existed in the schema,
-- causing the entire answers fetch to fail with a "column does not exist" error.
ALTER TABLE public.application_answers
  ADD COLUMN IF NOT EXISTS answer_options JSONB;

-- Fix 2: Allow hospital admins to read profiles of students who applied to their positions.
-- Without this policy, the profiles query returned 0 rows (RLS silently blocked all reads),
-- so no student profile data (GPA, university, major, etc.) ever appeared in the admin view.
DROP POLICY IF EXISTS "Hospital admins can view applicant profiles" ON public.profiles;
CREATE POLICY "Hospital admins can view applicant profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT sa.student_id
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(
        (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );
