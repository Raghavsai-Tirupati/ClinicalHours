-- Add opportunity_id to hospital_applications for linking submissions to specific positions
ALTER TABLE public.hospital_applications
  ADD COLUMN IF NOT EXISTS opportunity_id uuid
  REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hospital_applications_opportunity_id
  ON public.hospital_applications (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

COMMENT ON COLUMN public.hospital_applications.opportunity_id IS 'Links application to a specific opportunity when applied from opportunities page';
