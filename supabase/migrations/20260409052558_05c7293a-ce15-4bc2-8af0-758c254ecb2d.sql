
-- 1. clinic_members.application_id + 'alumni' status
ALTER TABLE clinic_members
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES student_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_application
  ON clinic_members(application_id);

ALTER TABLE clinic_members
  DROP CONSTRAINT IF EXISTS clinic_members_status_check;

ALTER TABLE clinic_members
  ADD CONSTRAINT clinic_members_status_check
  CHECK (status IN ('active', 'inactive', 'on_leave', 'alumni'));

-- 2. application_notes — dated admin notes per applicant
CREATE TABLE IF NOT EXISTS application_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES student_applications(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_by      UUID,
  created_by_email TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_application
  ON application_notes(application_id, created_at DESC);

ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

-- Use auth.jwt()->>'email' instead of querying auth.users to avoid permission errors
CREATE POLICY "Clinic admins manage own application notes"
  ON application_notes FOR ALL TO authenticated
  USING (
    application_id IN (
      SELECT sa.id FROM student_applications sa
      JOIN hospital_positions hp ON sa.position_id = hp.id
      JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT sa.id FROM student_applications sa
      JOIN hospital_positions hp ON sa.position_id = hp.id
      JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "Platform admins manage all application notes"
  ON application_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TRIGGER trg_application_notes_updated_at
  BEFORE UPDATE ON application_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE application_notes;
