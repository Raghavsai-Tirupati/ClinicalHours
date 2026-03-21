-- Ensure hospital admins see a meaningful applicant name.
-- 1) RPC list now falls back to profile.full_name when applications.student_name is blank.
-- 2) Hospital application submit function auto-fills applicant_name from profile/email when name is missing.

CREATE OR REPLACE FUNCTION public.hospital_list_applications(
  p_hospital_id uuid,
  p_sort_by text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc'
)
RETURNS TABLE (
  id uuid,
  opportunity_id uuid,
  student_name text,
  student_email text,
  student_phone text,
  student_id uuid,
  resume_url text,
  essay_responses jsonb,
  status text,
  created_at timestamptz,
  gpa numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM hospital_members hm
    JOIN hospital_accounts ha ON ha.id = hm.account_id
    WHERE ha.hospital_id = p_hospital_id
      AND hm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this hospital';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.opportunity_id,
    COALESCE(NULLIF(trim(a.student_name), ''), NULLIF(trim(p.full_name), ''), 'Unknown Applicant') AS student_name,
    a.student_email,
    a.student_phone,
    a.student_id,
    a.resume_url,
    a.essay_responses,
    a.status,
    a.created_at,
    p.gpa
  FROM applications a
  JOIN opportunities o ON o.id = a.opportunity_id
  LEFT JOIN profiles p ON p.id = a.student_id
  WHERE o.hospital_id = p_hospital_id
  ORDER BY
    CASE WHEN p_sort_by = 'student_name' AND p_sort_dir = 'asc'
      THEN COALESCE(NULLIF(trim(a.student_name), ''), NULLIF(trim(p.full_name), ''), 'Unknown Applicant') END ASC,
    CASE WHEN p_sort_by = 'student_name' AND p_sort_dir = 'desc'
      THEN COALESCE(NULLIF(trim(a.student_name), ''), NULLIF(trim(p.full_name), ''), 'Unknown Applicant') END DESC,
    CASE WHEN p_sort_by = 'created_at'  AND p_sort_dir = 'asc'  THEN a.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at'  AND p_sort_dir = 'desc' THEN a.created_at END DESC,
    CASE WHEN p_sort_by = 'status'      AND p_sort_dir = 'asc'  THEN a.status END ASC,
    CASE WHEN p_sort_by = 'status'      AND p_sort_dir = 'desc' THEN a.status END DESC,
    CASE WHEN p_sort_by = 'gpa'         AND p_sort_dir = 'asc'  THEN COALESCE(p.gpa, -1) END ASC,
    CASE WHEN p_sort_by = 'gpa'         AND p_sort_dir = 'desc' THEN COALESCE(p.gpa, -1) END DESC,
    a.created_at DESC;
END;
$$;

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
  v_name   text;
  v_app_id uuid;
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
