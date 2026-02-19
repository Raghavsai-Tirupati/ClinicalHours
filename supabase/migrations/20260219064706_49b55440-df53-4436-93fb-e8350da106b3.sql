-- Guest Application Support (migration 20260220000002)

-- 1. Allow NULL student_id (guests have no auth account)
ALTER TABLE public.hospital_applications
  ALTER COLUMN student_id DROP NOT NULL;

-- 2. Guest identity columns
ALTER TABLE public.hospital_applications
  ADD COLUMN IF NOT EXISTS applicant_email text,
  ADD COLUMN IF NOT EXISTS applicant_name  text;

-- 3. Drop the old table-level UNIQUE constraint if it exists
ALTER TABLE public.hospital_applications
  DROP CONSTRAINT IF EXISTS hospital_applications_account_id_student_id_key;

-- 4. One application per authenticated student per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_student
  ON public.hospital_applications (account_id, student_id)
  WHERE student_id IS NOT NULL;

-- 5. One application per guest email per account (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_happs_unique_guest_email
  ON public.hospital_applications (account_id, lower(applicant_email))
  WHERE student_id IS NULL AND applicant_email IS NOT NULL;

-- 6. At least one identifier must be present
ALTER TABLE public.hospital_applications
  ADD CONSTRAINT application_requires_identifier
  CHECK (student_id IS NOT NULL OR applicant_email IS NOT NULL);

-- 7. SECURITY DEFINER RPC for guest submissions
CREATE OR REPLACE FUNCTION public.submit_guest_hospital_application(
  p_account_id uuid,
  p_name       text,
  p_email      text,
  p_answers    jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  text;
  v_app_id uuid;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF NOT (v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  IF EXISTS (
    SELECT 1 FROM hospital_applications
    WHERE account_id      = p_account_id
      AND student_id      IS NULL
      AND lower(applicant_email) = v_email
  ) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;

  INSERT INTO hospital_applications (
    account_id, student_id, applicant_name, applicant_email, status
  ) VALUES (
    p_account_id, NULL, trim(p_name), v_email, 'submitted'
  )
  RETURNING id INTO v_app_id;

  IF jsonb_typeof(p_answers) = 'array' AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO hospital_application_answers
      (application_id, question_id, answer_text, answer_options)
    SELECT
      v_app_id,
      (elem->>'question_id')::uuid,
      NULLIF(trim(elem->>'answer_text'), ''),
      CASE
        WHEN jsonb_typeof(elem->'answer_options') = 'array'
          THEN elem->'answer_options'
        ELSE NULL
      END
    FROM jsonb_array_elements(p_answers) AS elem;
  END IF;

  RETURN v_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_hospital_application TO anon, authenticated;