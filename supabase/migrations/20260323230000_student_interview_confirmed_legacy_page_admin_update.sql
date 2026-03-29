-- Confirmed interview time for position applications (hospital dashboard / Interviews tab)
ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS interview_confirmed_at timestamptz;

COMMENT ON COLUMN public.student_applications.interview_confirmed_at IS
  'Interview start time confirmed by clinic admin (optional; complements Calendly self-schedule).';

CREATE INDEX IF NOT EXISTS idx_student_applications_interview_confirmed_at
  ON public.student_applications (interview_confirmed_at)
  WHERE interview_confirmed_at IS NOT NULL;

-- Hospital page admins (hospital_pages.admin_email) could read legacy applications but not update them.
-- Allow updates for rows tied to their page so Interviews quick actions work without hospital_members.
DROP POLICY IF EXISTS "Hospital page admins can update legacy applications" ON public.hospital_applications;
CREATE POLICY "Hospital page admins can update legacy applications"
  ON public.hospital_applications
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT hac.id
      FROM public.hospital_accounts hac
      JOIN public.opportunities o ON o.hospital_id = hac.hospital_id
      JOIN public.hospital_pages hpg ON hpg.hospital_id = o.id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
