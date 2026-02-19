-- ─────────────────────────────────────────────────────────────────────────────
-- Hospital Ecosystem Seed Data
-- Run AFTER applying the 20260219000001_hospital_ecosystem.sql migration.
-- Usage: psql <connection_string> -f supabase/seed_hospital.sql
--   or:  supabase db reset (if using local Supabase and seed is in supabase/seed.sql)
-- ─────────────────────────────────────────────────────────────────────────────

-- Sample hospitals (no auth user required)
INSERT INTO public.hospitals (name, address, city, state, website)
VALUES
  (
    'General Hospital Demo',
    '123 Medical Drive',
    'San Francisco',
    'CA',
    'https://example.com/general-hospital'
  ),
  (
    'Community Health Center',
    '456 Wellness Ave',
    'Austin',
    'TX',
    NULL
  ),
  (
    'St. Mary Medical Center',
    '789 Healthcare Blvd',
    'Chicago',
    'IL',
    'https://example.com/st-mary'
  )
ON CONFLICT DO NOTHING;
