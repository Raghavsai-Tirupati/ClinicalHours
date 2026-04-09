-- ─── People / Members refactor ────────────────────────────────────────────────
-- Links clinic_members to the application that produced them, allows the
-- "alumni" status (a former member who keeps their original role label),
-- and adds a dated admin notes table tied to applications so reviewers can
-- track conversations over time.
--
-- Existing manually-created clinic_members rows are untouched: their new
-- application_id stays NULL and the UI labels them "Manually added".

-- ============================================================
-- 1. clinic_members.application_id  +  'alumni' status
-- ============================================================
ALTER TABLE clinic_members
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES student_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_application
  ON clinic_members(application_id);

-- Extend the status CHECK constraint to allow 'alumni'. We have to drop and
-- re-create because Postgres has no "ALTER CHECK" in place.
ALTER TABLE clinic_members
  DROP CONSTRAINT IF EXISTS clinic_members_status_check;

ALTER TABLE clinic_members
  ADD CONSTRAINT clinic_members_status_check
  CHECK (status IN ('active', 'inactive', 'on_leave', 'alumni'));

-- ============================================================
-- 2. application_notes — dated admin notes per applicant
-- ============================================================
-- Each note is its own row so we get free history (created_at) and the UI
-- can render a chronological feed without diffing a single TEXT blob.
CREATE TABLE IF NOT EXISTS application_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES student_applications(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_application
  ON application_notes(application_id, created_at DESC);

ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

-- Clinic admins can manage notes on applications to their own positions.
CREATE POLICY "Clinic admins manage own application notes"
  ON application_notes FOR ALL TO authenticated
  USING (
    application_id IN (
      SELECT sa.id FROM student_applications sa
      JOIN hospital_positions hp ON sa.position_id = hp.id
      JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT sa.id FROM student_applications sa
      JOIN hospital_positions hp ON sa.position_id = hp.id
      JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

-- Platform admins can manage every note.
CREATE POLICY "Platform admins manage all application notes"
  ON application_notes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at on edit
CREATE TRIGGER trg_application_notes_updated_at
  BEFORE UPDATE ON application_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime so the notes feed updates live across admin sessions
ALTER PUBLICATION supabase_realtime ADD TABLE application_notes;
