-- Allow free-form hour logging (no tracked opportunity required)
ALTER TABLE public.experience_entries
  ALTER COLUMN opportunity_id DROP NOT NULL;

ALTER TABLE public.experience_entries
  ADD COLUMN IF NOT EXISTS custom_organization_name text,
  ADD COLUMN IF NOT EXISTS activity_type text DEFAULT 'clinical_volunteering',
  ADD COLUMN IF NOT EXISTS supervisor_name text;

CREATE INDEX IF NOT EXISTS idx_experience_entries_custom_org
  ON public.experience_entries (user_id, custom_organization_name)
  WHERE custom_organization_name IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experience_entries TO authenticated;
GRANT ALL ON public.experience_entries TO service_role;