-- Add Stripe billing fields to profiles table
-- These are set by the stripe-webhook edge function (never from the frontend)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Index for fast webhook lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id);
