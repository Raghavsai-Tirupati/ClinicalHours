-- Subscriptions table: Stripe-ready subscription management
-- Syncs profiles.is_premium via trigger for fast lookups

-- ============================================================
-- 1. Subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- 2. Trigger: sync profiles.is_premium when subscriptions change
-- ============================================================
CREATE OR REPLACE FUNCTION sync_premium_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET is_premium = false,
        premium_expires_at = NULL
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
    UPDATE profiles
    SET is_premium = true,
        premium_expires_at = NEW.current_period_end
    WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles
    SET is_premium = false,
        premium_expires_at = NEW.current_period_end
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_premium_status();

-- ============================================================
-- 3. Seed premium accounts
-- ============================================================
-- Insert active subscriptions for the two premium accounts.
-- Uses a subquery to look up user_id from auth.users by email.
-- The trigger automatically sets profiles.is_premium = true.

INSERT INTO subscriptions (user_id, plan_type, status, current_period_start, current_period_end)
SELECT id, 'annual', 'active', now(), now() + interval '100 years'
FROM auth.users
WHERE email = 'shivamkanodia77@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan_type = 'annual',
      current_period_end = now() + interval '100 years',
      updated_at = now();

INSERT INTO subscriptions (user_id, plan_type, status, current_period_start, current_period_end)
SELECT id, 'annual', 'active', now(), now() + interval '100 years'
FROM auth.users
WHERE email = 'ragtirup07@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan_type = 'annual',
      current_period_end = now() + interval '100 years',
      updated_at = now();
