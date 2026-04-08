-- ─── Migration 1: Multi-Waitlist Redesign ──────────────────────────────────

-- 1. waitlists table
CREATE TABLE IF NOT EXISTS waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  position_id UUID REFERENCES hospital_positions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlists_clinic ON waitlists(clinic_id);
CREATE INDEX IF NOT EXISTS idx_waitlists_status ON waitlists(status);
CREATE INDEX IF NOT EXISTS idx_waitlists_position ON waitlists(position_id);

CREATE TRIGGER update_waitlists_updated_at
  BEFORE UPDATE ON waitlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read waitlists"
  ON waitlists FOR SELECT
  USING (true);

CREATE POLICY "Clinic admins manage own waitlists"
  ON waitlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlists.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = waitlists.clinic_id
        AND hospital_pages.admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all waitlists"
  ON waitlists FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. Add waitlist_id FK to waitlist_submissions
ALTER TABLE waitlist_submissions
  ADD COLUMN IF NOT EXISTS waitlist_id UUID REFERENCES waitlists(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_waitlist_submissions_waitlist
  ON waitlist_submissions(waitlist_id);

-- 3. Backfill default waitlist per clinic
DO $$
DECLARE
  c RECORD;
  new_wl_id UUID;
BEGIN
  FOR c IN
    SELECT DISTINCT clinic_id
    FROM waitlist_submissions
    WHERE waitlist_id IS NULL
  LOOP
    INSERT INTO waitlists (clinic_id, title, description, status)
    VALUES (
      c.clinic_id,
      'General Waitlist',
      'Default waitlist migrated from legacy waitlist module.',
      'open'
    )
    RETURNING id INTO new_wl_id;

    UPDATE waitlist_submissions
       SET waitlist_id = new_wl_id
     WHERE clinic_id = c.clinic_id
       AND waitlist_id IS NULL;
  END LOOP;
END $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE waitlists;

-- ─── Migration 2: Position-level scheduling questions ─────────────────────

ALTER TABLE clinic_scheduling_questions
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES hospital_positions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clinic_scheduling_questions_position
  ON clinic_scheduling_questions(position_id);