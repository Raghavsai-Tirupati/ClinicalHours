
CREATE TABLE IF NOT EXISTS volunteer_tracker_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vt_categories_clinic ON volunteer_tracker_categories(clinic_id, sort_order);
ALTER TABLE volunteer_tracker_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage tracker categories"
  ON volunteer_tracker_categories FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all tracker categories"
  ON volunteer_tracker_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DO $$ BEGIN
  CREATE TYPE volunteer_tracker_column_type AS ENUM ('number','percentage','rating_1_5','text','boolean');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS volunteer_tracker_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  column_type volunteer_tracker_column_type NOT NULL DEFAULT 'text',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vt_columns_clinic ON volunteer_tracker_columns(clinic_id, sort_order);
ALTER TABLE volunteer_tracker_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage tracker columns"
  ON volunteer_tracker_columns FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all tracker columns"
  ON volunteer_tracker_columns FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE TABLE IF NOT EXISTS volunteer_tracker_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  category_id       UUID NOT NULL REFERENCES volunteer_tracker_categories(id) ON DELETE CASCADE,
  volunteer_name    TEXT NOT NULL,
  volunteer_user_id UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vt_entries_clinic ON volunteer_tracker_entries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_vt_entries_category ON volunteer_tracker_entries(category_id, sort_order);
ALTER TABLE volunteer_tracker_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage tracker entries"
  ON volunteer_tracker_entries FOR ALL
  USING (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all tracker entries"
  ON volunteer_tracker_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE TABLE IF NOT EXISTS volunteer_tracker_values (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id  UUID NOT NULL REFERENCES volunteer_tracker_entries(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES volunteer_tracker_columns(id) ON DELETE CASCADE,
  value     TEXT,
  UNIQUE(entry_id, column_id)
);

CREATE INDEX IF NOT EXISTS idx_vt_values_entry ON volunteer_tracker_values(entry_id);
CREATE INDEX IF NOT EXISTS idx_vt_values_column ON volunteer_tracker_values(column_id);
ALTER TABLE volunteer_tracker_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can manage tracker values"
  ON volunteer_tracker_values FOR ALL
  USING (
    entry_id IN (
      SELECT e.id FROM volunteer_tracker_entries e
      JOIN hospital_pages hp ON hp.id = e.clinic_id
      WHERE hp.admin_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT e.id FROM volunteer_tracker_entries e
      JOIN hospital_pages hp ON hp.id = e.clinic_id
      WHERE hp.admin_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Platform admins manage all tracker values"
  ON volunteer_tracker_values FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
