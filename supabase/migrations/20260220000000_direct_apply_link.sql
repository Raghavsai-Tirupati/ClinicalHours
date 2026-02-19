-- ─────────────────────────────────────────────────────────────────────────────
-- Direct Apply link: connect opportunities to hospital accounts
-- Also adds persistent status to saved_opportunities for tracker
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Link opportunities to hospitals via hospital_id FK
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS hospital_id uuid
  REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_hospital_id
  ON public.opportunities (hospital_id)
  WHERE hospital_id IS NOT NULL;

-- 2. Persistent status on saved_opportunities (tracker pipeline)
ALTER TABLE public.saved_opportunities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Saved'
  CHECK (status IN ('Saved', 'Applied', 'Interviewing', 'Completed'));

-- 3. Recreate opportunities_with_ratings view so it picks up new hospital_id column
--    (PostgreSQL freezes o.* at view-creation time; recreating unfreezes it)
CREATE OR REPLACE VIEW public.opportunities_with_ratings AS
SELECT
  o.*,
  COALESCE(AVG(r.rating), 0) AS avg_rating,
  COUNT(r.id)                AS review_count
FROM public.opportunities o
LEFT JOIN public.reviews r ON o.id = r.opportunity_id
GROUP BY o.id;

-- 4. Backfill hospital_id for existing opportunities whose name matches a hospital
--    (case-insensitive, whitespace-normalised match)
UPDATE public.opportunities o
SET    hospital_id = h.id
FROM   public.hospitals h
WHERE  o.type       = 'hospital'
  AND  o.hospital_id IS NULL
  AND  h.status     IN ('seeded', 'verified')
  AND  LOWER(REGEXP_REPLACE(TRIM(o.name), '\s+', ' ', 'g'))
     = LOWER(REGEXP_REPLACE(TRIM(h.name), '\s+', ' ', 'g'));

-- 5. Security-definer function: lets a hospital owner/admin link an opportunity
--    to their hospital without needing a broad UPDATE policy on opportunities.
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
  -- Caller must be an owner or admin of the target hospital's account
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

  -- Only set hospital_id when it is not already claimed
  UPDATE opportunities
  SET    hospital_id = p_hospital_id
  WHERE  id          = p_opportunity_id
    AND  hospital_id IS NULL;
END;
$$;
