-- Step 1: Add hospital_id column
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS hospital_id uuid
  REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_hospital_id
  ON public.opportunities (hospital_id)
  WHERE hospital_id IS NOT NULL;

-- Step 2: Add status column to saved_opportunities if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saved_opportunities' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.saved_opportunities
      ADD COLUMN status text NOT NULL DEFAULT 'Saved';
    ALTER TABLE public.saved_opportunities
      ADD CONSTRAINT saved_opportunities_status_check
      CHECK (status IN ('Saved', 'Applied', 'Interviewing', 'Completed'));
  END IF;
END $$;

-- Step 3: Drop and recreate view preserving original column order + adding hospital_id
DROP VIEW IF EXISTS public.opportunities_with_ratings;
CREATE VIEW public.opportunities_with_ratings AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.type,
  o.location,
  o.address,
  o.latitude,
  o.longitude,
  o.description,
  o.hours_required,
  o.acceptance_likelihood,
  o.phone,
  o.email,
  o.website,
  o.requirements,
  o.source,
  o.created_by,
  o.created_at,
  o.updated_at,
  o.hospital_id,
  COALESCE(AVG(r.rating), 0) AS avg_rating,
  COUNT(r.id)                AS review_count
FROM public.opportunities o
LEFT JOIN public.reviews r ON o.id = r.opportunity_id
GROUP BY o.id;

-- Step 4: Backfill hospital_id
UPDATE public.opportunities o
SET    hospital_id = h.id
FROM   public.hospitals h
WHERE  o.type       = 'hospital'
  AND  o.hospital_id IS NULL
  AND  h.status     IN ('seeded', 'verified')
  AND  LOWER(REGEXP_REPLACE(TRIM(o.name), '\s+', ' ', 'g'))
     = LOWER(REGEXP_REPLACE(TRIM(h.name), '\s+', ' ', 'g'));

-- Step 5: Security-definer function
CREATE OR REPLACE FUNCTION public.link_opportunity_to_hospital(
  p_opportunity_id uuid,
  p_hospital_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   hospital_members hm
    JOIN   hospital_accounts ha ON ha.id = hm.account_id
    WHERE  ha.hospital_id = p_hospital_id
      AND  hm.user_id     = auth.uid()
      AND  hm.role        IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorised to link this hospital';
  END IF;

  UPDATE opportunities
  SET    hospital_id = p_hospital_id
  WHERE  id          = p_opportunity_id
    AND  hospital_id IS NULL;
END;
$$;