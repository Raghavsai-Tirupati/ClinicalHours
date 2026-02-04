-- ============================================================
-- MIGRATE DATA FROM hospitals TABLE TO opportunities TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

-- First, let's see what columns exist in your hospitals table
-- SELECT * FROM hospitals LIMIT 5;

-- Copy data from hospitals to opportunities
INSERT INTO public.opportunities (
  name,
  type,
  location,
  latitude,
  longitude,
  phone,
  email,
  website,
  description,
  hours_required,
  acceptance_likelihood,
  requirements
)
SELECT 
  name,
  'hospital'::opportunity_type as type,
  COALESCE(
    CASE 
      WHEN city IS NOT NULL AND state IS NOT NULL THEN city || ', ' || state
      WHEN city IS NOT NULL THEN city
      WHEN state IS NOT NULL THEN state
      ELSE 'Unknown'
    END,
    'Unknown'
  ) as location,
  lat::decimal as latitude,
  lon::decimal as longitude,
  phone,
  email,
  website,
  bio as description,
  'Varies' as hours_required,
  'medium'::acceptance_likelihood as acceptance_likelihood,
  ARRAY[]::text[] as requirements
FROM hospitals
WHERE name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify the migration
SELECT 'Hospitals table count:' as info, COUNT(*) as count FROM hospitals
UNION ALL
SELECT 'Opportunities table count:', COUNT(*) FROM opportunities;

-- Optional: Drop the hospitals table after verifying data migrated correctly
-- DROP TABLE IF EXISTS hospitals;
