
-- Add new columns to hospitals table (do NOT drop anything)
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'seeded';
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Generate slugs for existing hospitals (with dedup)
WITH slugged AS (
  SELECT id, name,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
      ORDER BY created_at
    ) AS rn
  FROM public.hospitals
  WHERE slug IS NULL
)
UPDATE public.hospitals h
SET slug = CASE WHEN s.rn = 1 THEN s.base_slug ELSE s.base_slug || '-' || s.rn END
FROM slugged s
WHERE h.id = s.id;

-- Update RLS: public can read seeded/verified hospitals
DROP POLICY IF EXISTS "Anyone can read hospitals" ON public.hospitals;
CREATE POLICY "Anyone can read hospitals"
  ON public.hospitals FOR SELECT
  USING (status IN ('seeded', 'verified') OR auth.uid() = submitted_by_user_id);

-- Admins can update any hospital (for approval workflow)
DROP POLICY IF EXISTS "Authenticated users can update hospitals" ON public.hospitals;
CREATE POLICY "Admins can update hospitals"
  ON public.hospitals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = submitted_by_user_id);

-- Keep insert policy but also allow pending submissions
DROP POLICY IF EXISTS "Authenticated users can insert hospitals" ON public.hospitals;
CREATE POLICY "Authenticated users can insert hospitals"
  ON public.hospitals FOR INSERT
  WITH CHECK (true);
