-- Add interview columns to hospital_applications (mirrors applications table)
ALTER TABLE public.hospital_applications
  ADD COLUMN IF NOT EXISTS interview_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_confirmed_at timestamptz;

COMMENT ON COLUMN public.hospital_applications.interview_requested_at IS 'When hospital requested interview from applicant';
COMMENT ON COLUMN public.hospital_applications.interview_confirmed_at IS 'Chosen interview datetime (set when hospital confirms)';

-- RPC: hospital requests interview for a hospital_application
CREATE OR REPLACE FUNCTION public.hospital_request_interview_ha(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM hospital_applications ha
    JOIN hospital_members hm ON hm.account_id = ha.account_id
    WHERE ha.id = p_application_id
      AND hm.user_id = auth.uid()
      AND hm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage this application';
  END IF;

  UPDATE hospital_applications
  SET interview_requested_at = now()
  WHERE id = p_application_id;
END;
$$;

COMMENT ON FUNCTION public.hospital_request_interview_ha(uuid) IS 'Mark that hospital requested interview from applicant (hospital_applications)';

-- RPC: hospital confirms interview with chosen datetime
CREATE OR REPLACE FUNCTION public.hospital_confirm_interview_ha(p_application_id uuid, p_slot timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM hospital_applications ha
    JOIN hospital_members hm ON hm.account_id = ha.account_id
    WHERE ha.id = p_application_id
      AND hm.user_id = auth.uid()
      AND hm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage this application';
  END IF;

  UPDATE hospital_applications
  SET interview_confirmed_at = p_slot
  WHERE id = p_application_id;
END;
$$;

COMMENT ON FUNCTION public.hospital_confirm_interview_ha(uuid, timestamptz) IS 'Set confirmed interview datetime for hospital_applications';
