-- Person-level notes (not tied to a specific application)
CREATE TABLE IF NOT EXISTS person_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_notes_lookup
  ON person_notes(clinic_id, student_id, created_at DESC);

ALTER TABLE person_notes ENABLE ROW LEVEL SECURITY;

-- Clinic admins can manage notes for people at their clinic
CREATE POLICY "Clinic admins manage person notes"
  ON person_notes FOR ALL TO authenticated
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

-- Platform admins can manage all notes
CREATE POLICY "Platform admins manage all person notes"
  ON person_notes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER trg_person_notes_updated_at
  BEFORE UPDATE ON person_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
