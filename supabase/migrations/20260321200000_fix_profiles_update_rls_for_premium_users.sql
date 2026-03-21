-- Premium subscribers were blocked from updating profiles: WITH CHECK required
-- is_premium = false and premium_expires_at IS NULL, so any user with an active
-- subscription failed upsert/UPDATE with "new row violates row-level security policy".
--
-- Replace that check with auth.uid() = id only, and enforce immutability of
-- premium/billing columns for JWT role "authenticated" via a BEFORE UPDATE trigger.
-- Service role and other contexts (no role / internal) leave NEW unchanged so
-- subscription sync and webhooks can still update these fields.

CREATE OR REPLACE FUNCTION public.profiles_preserve_premium_and_billing_columns()
RETURNS TRIGGER
AS $$
BEGIN
  IF (SELECT auth.role()) = 'authenticated' THEN
    NEW.is_premium := OLD.is_premium;
    NEW.premium_expires_at := OLD.premium_expires_at;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS profiles_preserve_premium_and_billing ON public.profiles;
CREATE TRIGGER profiles_preserve_premium_and_billing
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_preserve_premium_and_billing_columns();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
