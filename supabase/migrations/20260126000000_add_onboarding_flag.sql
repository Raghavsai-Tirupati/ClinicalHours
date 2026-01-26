-- Add onboarding_complete flag to profiles table
-- This tracks whether a user has completed the new user tutorial

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_complete IS 'Whether the user has completed the onboarding tutorial';
