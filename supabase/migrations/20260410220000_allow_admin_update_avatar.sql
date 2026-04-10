-- Allow hospital admins to update avatar_url on profiles of students
-- who have applied to positions at their clinic.
CREATE POLICY "Hospital admins can update applicant avatar"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT sa.student_id
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    id IN (
      SELECT sa.student_id
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
