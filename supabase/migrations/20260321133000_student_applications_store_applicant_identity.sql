-- Persist applicant identity for position applications so hospital admins
-- can always see names/emails even when profile joins are unavailable.

ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS applicant_name text,
  ADD COLUMN IF NOT EXISTS applicant_email text;

CREATE INDEX IF NOT EXISTS idx_student_applications_applicant_email
  ON public.student_applications (applicant_email);

-- Backfill from profiles where possible for existing applications.
UPDATE public.student_applications sa
SET
  applicant_name = COALESCE(
    NULLIF(trim(sa.applicant_name), ''),
    NULLIF(trim(p.full_name), '')
  ),
  applicant_email = COALESCE(
    NULLIF(trim(lower(sa.applicant_email)), ''),
    NULLIF(trim(lower(p.email)), '')
  )
FROM public.profiles p
WHERE p.id = sa.student_id
  AND (
    COALESCE(trim(sa.applicant_name), '') = ''
    OR COALESCE(trim(sa.applicant_email), '') = ''
  );
