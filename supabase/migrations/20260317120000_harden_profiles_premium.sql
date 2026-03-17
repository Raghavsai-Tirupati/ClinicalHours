-- Harden profiles RLS so users cannot self-assign premium
-- This migration tightens the existing "Users can update own profile" policy
-- to prevent authenticated users from changing premium flags directly.

ALTER POLICY "Users can update own profile"
  ON public.profiles
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (is_premium IS NOT DISTINCT FROM false)
    AND (premium_expires_at IS NULL)
  );

