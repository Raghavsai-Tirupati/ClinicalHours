-- Drop the broken policy that used a sub-query against auth.users.
-- Querying auth.users from within a profile RLS policy breaks all profile
-- reads and writes for regular users ("permission denied for table users").
DROP POLICY IF EXISTS "Hospital admins can view applicant profiles" ON public.profiles;

-- Recreate the policy using auth.email() which is the safe Supabase helper
-- and does not require querying the auth.users table directly.
CREATE POLICY "Hospital admins can view applicant profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT sa.student_id
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
