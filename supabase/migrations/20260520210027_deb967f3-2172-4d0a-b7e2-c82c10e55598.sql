-- =====================================================================
-- 1. Fix broken RLS on legacy hospital application tables.
-- =====================================================================
DROP POLICY IF EXISTS "Hospital admins can view answers" ON hospital_application_answers;
CREATE POLICY "Hospital admins can view answers" ON hospital_application_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hospital_applications ha
      JOIN hospital_accounts acc ON acc.id = ha.account_id
      JOIN hospitals h ON h.id = acc.hospital_id
      JOIN opportunities opp ON opp.hospital_id = h.id
      JOIN hospital_pages hp ON hp.hospital_id = opp.id
      WHERE ha.id = hospital_application_answers.application_id
        AND hp.admin_email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Hospital admins can view applications" ON hospital_applications;
CREATE POLICY "Hospital admins can view applications" ON hospital_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hospital_accounts acc
      JOIN hospitals h ON h.id = acc.hospital_id
      JOIN opportunities opp ON opp.hospital_id = h.id
      JOIN hospital_pages hp ON hp.hospital_id = opp.id
      WHERE acc.id = hospital_applications.account_id
        AND hp.admin_email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Hospital admins can update applications" ON hospital_applications;
CREATE POLICY "Hospital admins can update applications" ON hospital_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM hospital_accounts acc
      JOIN hospitals h ON h.id = acc.hospital_id
      JOIN opportunities opp ON opp.hospital_id = h.id
      JOIN hospital_pages hp ON hp.hospital_id = opp.id
      WHERE acc.id = hospital_applications.account_id
        AND hp.admin_email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Hospital admins can view questions" ON hospital_application_questions;
CREATE POLICY "Hospital admins can view questions" ON hospital_application_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hospital_accounts acc
      JOIN hospitals h ON h.id = acc.hospital_id
      JOIN opportunities opp ON opp.hospital_id = h.id
      JOIN hospital_pages hp ON hp.hospital_id = opp.id
      WHERE acc.id = hospital_application_questions.account_id
        AND hp.admin_email = auth.email()
    )
  );

-- =====================================================================
-- 2. Fix remaining broken RLS patterns on hospital_pages / positions / questions.
-- =====================================================================
DROP POLICY IF EXISTS "Public read hospital_pages" ON hospital_pages;
DROP POLICY IF EXISTS "Admin insert hospital_pages" ON hospital_pages;
DROP POLICY IF EXISTS "Admin update own hospital_pages" ON hospital_pages;
DROP POLICY IF EXISTS "Admins can manage their hospital page" ON hospital_pages;
DROP POLICY IF EXISTS "Hospital admins can update their page" ON hospital_pages;
DROP POLICY IF EXISTS "Hospital admins can view their page" ON hospital_pages;

CREATE POLICY "Public read hospital_pages"
  ON hospital_pages FOR SELECT USING (true);
CREATE POLICY "Admin insert hospital_pages"
  ON hospital_pages FOR INSERT WITH CHECK (auth.email() IS NOT NULL);
CREATE POLICY "Admin update own hospital_pages"
  ON hospital_pages FOR UPDATE USING (admin_email = auth.email());

DROP POLICY IF EXISTS "Public read active positions" ON hospital_positions;
DROP POLICY IF EXISTS "Admin manage positions" ON hospital_positions;
DROP POLICY IF EXISTS "Hospital admins can manage positions" ON hospital_positions;
DROP POLICY IF EXISTS "Hospital admins can view positions" ON hospital_positions;

CREATE POLICY "Public read active positions"
  ON hospital_positions FOR SELECT USING (
    status = 'active'
    OR EXISTS (
      SELECT 1 FROM hospital_pages hp
      WHERE hp.id = hospital_positions.hospital_page_id
        AND hp.admin_email = auth.email()
    )
  );
CREATE POLICY "Admin manage positions"
  ON hospital_positions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hospital_pages hp
      WHERE hp.id = hospital_positions.hospital_page_id
        AND hp.admin_email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Public read questions for active positions" ON position_questions;
DROP POLICY IF EXISTS "Admin manage position questions" ON position_questions;
DROP POLICY IF EXISTS "Hospital admins can manage questions" ON position_questions;

CREATE POLICY "Public read questions for active positions"
  ON position_questions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hospital_positions p
      WHERE p.id = position_questions.position_id AND p.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM hospital_positions p
      JOIN hospital_pages hp ON hp.id = p.hospital_page_id
      WHERE p.id = position_questions.position_id
        AND hp.admin_email = auth.email()
    )
  );
CREATE POLICY "Admin manage position questions"
  ON position_questions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hospital_positions p
      JOIN hospital_pages hp ON hp.id = p.hospital_page_id
      WHERE p.id = position_questions.position_id
        AND hp.admin_email = auth.email()
    )
  );

-- =====================================================================
-- 3. Gmail OAuth state table for CSRF protection.
-- =====================================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_states_created_at_idx ON oauth_states(created_at);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (which bypasses RLS) should access this table.

-- =====================================================================
-- 4. Atomic position application submission.
-- =====================================================================
CREATE OR REPLACE FUNCTION submit_position_application_atomic(
  p_position_id       UUID,
  p_student_id        UUID,
  p_applicant_name    TEXT,
  p_applicant_email   TEXT,
  p_availability_json JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spots  INTEGER;
  v_filled INTEGER;
  v_app_id UUID;
BEGIN
  SELECT spots_available INTO v_spots
  FROM hospital_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF v_spots IS NOT NULL THEN
    SELECT COUNT(*) INTO v_filled
    FROM student_applications
    WHERE position_id = p_position_id
      AND status NOT IN ('rejected', 'waitlisted');

    IF v_filled >= v_spots THEN
      RAISE EXCEPTION 'SPOTS_FULL';
    END IF;
  END IF;

  INSERT INTO student_applications (
    position_id, student_id, applicant_name, applicant_email,
    availability_json, status, submitted_at
  ) VALUES (
    p_position_id, p_student_id, p_applicant_name, p_applicant_email,
    p_availability_json, 'new', now()
  )
  RETURNING id INTO v_app_id;

  RETURN v_app_id;
END;
$$;