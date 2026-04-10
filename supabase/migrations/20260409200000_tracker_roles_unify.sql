-- ─── Unify tracker categories as the single source of truth for roles ──────
--
-- clinic_roles is now obsolete.  Tracker categories (volunteer_tracker_categories)
-- are the ONLY place roles are defined.  This migration adds a FK from
-- clinic_members → volunteer_tracker_categories so we know which role (category)
-- a staff member belongs to.  The old role_id column is left in place for
-- backward-compat but the UI no longer writes to it.

-- 1. New FK column
ALTER TABLE clinic_members
  ADD COLUMN IF NOT EXISTS tracker_category_id UUID
    REFERENCES volunteer_tracker_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_tracker_category
  ON clinic_members(tracker_category_id);
