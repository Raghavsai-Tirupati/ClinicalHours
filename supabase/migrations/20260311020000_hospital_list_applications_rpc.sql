-- Hospital applicant list RPC: backend structure for sortable applicant listing
-- Callable by hospital members only. Accepts sort params for future server-side sorting.
-- Frontend can switch to this RPC when ready; for now client-side sort remains in use.

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
  -- Ensure caller is a hospital member for this hospital
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
    a.student_name,
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
    CASE WHEN p_sort_by = 'student_name' AND p_sort_dir = 'asc'  THEN a.student_name END ASC,
    CASE WHEN p_sort_by = 'student_name' AND p_sort_dir = 'desc' THEN a.student_name END DESC,
    CASE WHEN p_sort_by = 'created_at'  AND p_sort_dir = 'asc'  THEN a.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at'  AND p_sort_dir = 'desc' THEN a.created_at END DESC,
    CASE WHEN p_sort_by = 'status'      AND p_sort_dir = 'asc'  THEN a.status END ASC,
    CASE WHEN p_sort_by = 'status'      AND p_sort_dir = 'desc' THEN a.status END DESC,
    CASE WHEN p_sort_by = 'gpa'         AND p_sort_dir = 'asc'  THEN COALESCE(p.gpa, -1) END ASC,
    CASE WHEN p_sort_by = 'gpa'         AND p_sort_dir = 'desc' THEN COALESCE(p.gpa, -1) END DESC,
    -- default: created_at desc
    a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.hospital_list_applications(uuid, text, text) IS
  'List applications for a hospital with server-side sorting. Valid sort_by: student_name, created_at, status, gpa. Valid sort_dir: asc, desc.';
