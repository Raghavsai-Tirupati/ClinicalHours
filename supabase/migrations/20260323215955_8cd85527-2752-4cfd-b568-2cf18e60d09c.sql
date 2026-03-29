ALTER TABLE public.hospital_pages
  ADD COLUMN IF NOT EXISTS is_showcase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloned_from_page_id uuid REFERENCES public.hospital_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clone_version integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cloned_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.hospital_pages.is_showcase IS 'Marks this page as a business/showcase admin page';
COMMENT ON COLUMN public.hospital_pages.cloned_from_page_id IS 'Source hospital_page this was cloned from (point-in-time snapshot, no auto-sync)';
COMMENT ON COLUMN public.hospital_pages.clone_version IS 'Schema version of the clone template used';
COMMENT ON COLUMN public.hospital_pages.cloned_at IS 'Timestamp of the last clone/force-update operation';