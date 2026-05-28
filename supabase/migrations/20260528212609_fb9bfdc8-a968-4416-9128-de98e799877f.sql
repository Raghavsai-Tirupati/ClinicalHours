CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_opportunities_name_trgm
  ON public.opportunities USING gin(name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_opportunities_location_trgm
  ON public.opportunities USING gin(location extensions.gin_trgm_ops);