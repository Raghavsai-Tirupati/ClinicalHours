-- Temporary testing override for BCS Free Health Clinic:
-- keep uniqueness for all accounts except BCS account.
-- This allows repeated applications (including same opportunity) for BCS only.

DROP INDEX IF EXISTS public.idx_happs_unique_student;
DROP INDEX IF EXISTS public.idx_happs_unique_guest_email;

DO $$
DECLARE
  v_bcs_account_id uuid;
BEGIN
  SELECT ha.id
    INTO v_bcs_account_id
  FROM public.hospital_accounts ha
  JOIN public.hospitals h ON h.id = ha.hospital_id
  WHERE lower(trim(h.name)) = 'bcs free health clinic'
  LIMIT 1;

  IF v_bcs_account_id IS NOT NULL THEN
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_student
         ON public.hospital_applications (account_id, student_id)
       WHERE student_id IS NOT NULL
         AND account_id <> %L::uuid',
      v_bcs_account_id
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_guest_email
         ON public.hospital_applications (account_id, lower(applicant_email))
       WHERE student_id IS NULL
         AND applicant_email IS NOT NULL
         AND account_id <> %L::uuid',
      v_bcs_account_id
    );
  ELSE
    -- Safe fallback if BCS account does not exist yet in this environment.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_student
      ON public.hospital_applications (account_id, student_id)
      WHERE student_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_guest_email
      ON public.hospital_applications (account_id, lower(applicant_email))
      WHERE student_id IS NULL AND applicant_email IS NOT NULL;
  END IF;
END $$;
