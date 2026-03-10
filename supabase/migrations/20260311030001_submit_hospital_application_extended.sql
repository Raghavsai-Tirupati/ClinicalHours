-- Extend submit_guest_hospital_application to accept optional opportunity_id and student_id
-- Existing 4-arg callers remain supported via DEFAULTs
CREATE OR REPLACE FUNCTION public.submit_guest_hospital_application(
  p_account_id     uuid,
  p_name           text,
  p_email          text,
  p_answers        jsonb,
  p_opportunity_id uuid DEFAULT NULL,
  p_student_id     uuid DEFAULT NULL
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

  -- Duplicate check: guest (same account + email) or authenticated (same account + student)
  IF p_student_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM hospital_applications
      WHERE account_id = p_account_id AND student_id = p_student_id
        AND (p_opportunity_id IS NULL OR opportunity_id IS NOT DISTINCT FROM p_opportunity_id)
    ) THEN
      RAISE EXCEPTION 'already_applied';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM hospital_applications
      WHERE account_id = p_account_id AND student_id IS NULL
        AND lower(applicant_email) = v_email
        AND (p_opportunity_id IS NULL OR opportunity_id IS NOT DISTINCT FROM p_opportunity_id)
    ) THEN
      RAISE EXCEPTION 'already_applied';
    END IF;
  END IF;

  INSERT INTO hospital_applications (
    account_id, student_id, applicant_name, applicant_email, status, opportunity_id
  ) VALUES (
    p_account_id, p_student_id, trim(p_name), v_email, 'submitted', p_opportunity_id
  )
  RETURNING id INTO v_app_id;

  IF jsonb_typeof(p_answers) = 'array' AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO hospital_application_answers
      (application_id, question_id, answer_text, answer_options)
    SELECT
      v_app_id,
      (elem->>'question_id')::uuid,
      NULLIF(trim(elem->>'answer_text'), ''),
      CASE WHEN jsonb_typeof(elem->'answer_options') = 'array' THEN elem->'answer_options' ELSE NULL END
    FROM jsonb_array_elements(p_answers) AS elem;
  END IF;

  RETURN v_app_id;
END;
$$;

COMMENT ON FUNCTION public.submit_guest_hospital_application IS
  'Submit hospital application. Optional p_opportunity_id, p_student_id. Works for guest (4 args) and authenticated (6 args).';
