-- Trust metadata columns for opportunities (powers TrustChips)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS last_verified_at   timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS application_method  text,
  ADD COLUMN IF NOT EXISTS seasonality         text,
  ADD COLUMN IF NOT EXISTS link_status         text NOT NULL DEFAULT 'unknown';

-- Constrain link_status to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_link_status_check'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_link_status_check
      CHECK (link_status IN ('unknown', 'active', 'broken', 'redirected'));
  END IF;
END $$;

-- Constrain application_method to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_application_method_check'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_application_method_check
      CHECK (application_method IS NULL OR application_method IN ('internal', 'external', 'email', 'phone', 'in_person', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_last_verified_at
  ON public.opportunities (last_verified_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_link_status
  ON public.opportunities (link_status);