-- ─── Position-level scheduling questions ─────────────────────────────────────
-- Scheduling questions were previously a single set per clinic. They now
-- belong to a specific position so each position can have its own custom
-- scheduling questions.

ALTER TABLE clinic_scheduling_questions
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES hospital_positions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clinic_scheduling_questions_position
  ON clinic_scheduling_questions(position_id);

-- NOTE: existing clinic-level rows (where position_id is NULL) are left in
-- place but no longer queried by the app. Admins wanting to keep them should
-- re-create the questions under each relevant position in the new UI.
