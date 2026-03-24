-- Add missing interview_confirmed_at column to student_applications
ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS interview_confirmed_at timestamptz;

-- Create is_super_admin() function for RLS bypass
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(trim(current_setting('request.jwt.claims', true)::json->>'email')) = 'clinicalhours.org@gmail.com',
    false
  )
$$;