-- Temporary testing override:
-- Allow duplicate applications for BCS Free Health Clinic only.
-- Keep duplicate protection in place for all other hospitals.

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
  v_email                text;
  v_name                 text;
  v_app_id               uuid;
  v_allow_repeat_apply   boolean := false;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF NOT (v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  v_name := trim(COALESCE(p_name, ''));
  IF v_name = '' AND p_student_id IS NOT NULL THEN
    SELECT trim(COALESCE(full_name, ''))
      INTO v_name
    FROM profiles
    WHERE id = p_student_id;
  END IF;
  IF v_name = '' THEN
    v_name := split_part(v_email, '@', 1);
  END IF;

  -- Temporary testing gate: allow repeats for BCS Free Health Clinic.
  SELECT EXISTS (
    SELECT 1
    FROM hospital_accounts ha
    JOIN hospitals h ON h.id = ha.hospital_id
    WHERE ha.id = p_account_id
      AND lower(trim(h.name)) = 'bcs free health clinic'
  )
  INTO v_allow_repeat_apply;

  IF NOT v_allow_repeat_apply THEN
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
  END IF;

  INSERT INTO hospital_applications (
    account_id, student_id, applicant_name, applicant_email, status, opportunity_id
  ) VALUES (
    p_account_id, p_student_id, v_name, v_email, 'submitted', p_opportunity_id
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
