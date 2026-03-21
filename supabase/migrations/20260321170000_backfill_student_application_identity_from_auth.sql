-- Backfill applicant identity for existing position applications using
-- profile and auth metadata so admin tables can show real names.

UPDATE public.student_applications sa
SET
  applicant_name = COALESCE(
    NULLIF(trim(sa.applicant_name), ''),
    CASE
      WHEN NULLIF(trim(p.full_name), '') ~* '^student\s+[a-f0-9]{8}$' THEN NULL
      ELSE NULLIF(trim(p.full_name), '')
    END,
    NULLIF(trim(au.raw_user_meta_data ->> 'full_name'), '')
  ),
  applicant_email = COALESCE(
    NULLIF(trim(lower(sa.applicant_email)), ''),
    NULLIF(trim(lower(au.email)), '')
  )
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = sa.student_id
  AND (
    COALESCE(trim(sa.applicant_name), '') = ''
    OR COALESCE(trim(sa.applicant_name), '') ~* '^student\s+[a-f0-9]{8}$'
    OR COALESCE(trim(sa.applicant_email), '') = ''
  );
