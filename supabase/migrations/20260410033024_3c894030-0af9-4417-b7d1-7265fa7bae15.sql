ALTER TABLE public.clinic_members
  ADD COLUMN IF NOT EXISTS tracker_category_id UUID
    REFERENCES volunteer_tracker_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_tracker_category
  ON public.clinic_members(tracker_category_id);