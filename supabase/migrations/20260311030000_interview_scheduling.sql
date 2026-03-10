-- Interview scheduling: students propose times, hospitals confirm and send
-- Flow: Hospital requests interview → student submits preferred slots → hospital picks one → (optionally) sends confirmation

-- 1. Add interview columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_confirmed_at timestamptz;

COMMENT ON COLUMN public.applications.interview_requested_at IS 'When hospital requested interview times from student';
COMMENT ON COLUMN public.applications.interview_confirmed_at IS 'Chosen interview datetime (set when hospital confirms)';

-- 2. Create application_interview_slots (student's preferred times)
CREATE TABLE IF NOT EXISTS public.application_interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  preference_rank int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_end_after_start CHECK (slot_end > slot_start)
);

CREATE INDEX IF NOT EXISTS idx_application_interview_slots_application_id
  ON public.application_interview_slots (application_id);

ALTER TABLE public.application_interview_slots ENABLE ROW LEVEL SECURITY;

-- Students can insert/read slots for their own applications
CREATE POLICY "Students can insert interview slots for own applications"
  ON public.application_interview_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can read interview slots for own applications"
  ON public.application_interview_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can delete interview slots for own applications"
  ON public.application_interview_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.student_id = auth.uid()
    )
  );

-- Opportunity owners (hospitals) can read slots for their applications
CREATE POLICY "Opportunity owners can read interview slots"
  ON public.application_interview_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.opportunities o ON o.id = a.opportunity_id
      WHERE a.id = application_id
        AND (o.created_by = auth.uid() OR o.hospital_id IN (
          SELECT ha.hospital_id FROM public.hospital_members hm
          JOIN public.hospital_accounts ha ON ha.id = hm.account_id
          WHERE hm.user_id = auth.uid()
        ))
    )
  );

-- Opportunity owners can delete slots (e.g. when confirming - we don't delete, we just set interview_confirmed_at)
-- No hospital INSERT/UPDATE on slots; hospital only reads and updates application.interview_confirmed_at

-- 3. Students can read their own applications (for My Applications page)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'applications' AND policyname = 'Students can read own applications'
  ) THEN
    CREATE POLICY "Students can read own applications"
      ON public.applications
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END $$;

-- 4. RPCs for hospital interview actions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.hospital_request_interview(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM applications a
    JOIN opportunities o ON o.id = a.opportunity_id
    LEFT JOIN hospital_accounts ha ON ha.hospital_id = o.hospital_id
    LEFT JOIN hospital_members hm ON hm.account_id = ha.id
    WHERE a.id = p_application_id
      AND (o.created_by = auth.uid() OR (o.hospital_id IS NOT NULL AND hm.user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage this application';
  END IF;

  UPDATE applications
  SET interview_requested_at = now()
  WHERE id = p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hospital_confirm_interview(
  p_application_id uuid,
  p_confirmed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM applications a
    JOIN opportunities o ON o.id = a.opportunity_id
    LEFT JOIN hospital_accounts ha ON ha.hospital_id = o.hospital_id
    LEFT JOIN hospital_members hm ON hm.account_id = ha.id
    WHERE a.id = p_application_id
      AND (o.created_by = auth.uid() OR (o.hospital_id IS NOT NULL AND hm.user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage this application';
  END IF;

  UPDATE applications
  SET interview_confirmed_at = p_confirmed_at
  WHERE id = p_application_id;
END;
$$;

COMMENT ON FUNCTION public.hospital_request_interview(uuid) IS
  'Request interview times from student. Caller must be opportunity owner or hospital member.';
COMMENT ON FUNCTION public.hospital_confirm_interview(uuid, timestamptz) IS
  'Confirm interview at given datetime. Caller must be opportunity owner or hospital member.';
