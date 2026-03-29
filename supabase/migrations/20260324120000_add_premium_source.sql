-- Persist canonical premium acquisition source for reliable admin analytics.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'premium_source'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.premium_source AS ENUM ('paid', 'promo_code', 'directly_added');
  END IF;
END
$$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS premium_source public.premium_source;

-- Backfill existing premium accounts.
UPDATE public.profiles
SET premium_source = CASE
  WHEN stripe_subscription_id IS NOT NULL THEN 'paid'::public.premium_source
  WHEN premium_expires_at IS NOT NULL THEN 'promo_code'::public.premium_source
  ELSE 'directly_added'::public.premium_source
END
WHERE is_premium = true
  AND premium_source IS NULL;

-- Keep non-premium users source-less.
UPDATE public.profiles
SET premium_source = NULL
WHERE is_premium = false
  AND premium_source IS NOT NULL;
