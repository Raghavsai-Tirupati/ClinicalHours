-- admin_activity_log RLS still used auth.users subquery (inaccessible to authenticated).
-- Hospital admins could not SELECT or INSERT activity rows — sent email tracker stayed empty.

DROP POLICY IF EXISTS "Hospital admins can read own activity" ON public.admin_activity_log;
CREATE POLICY "Hospital admins can read own activity"
  ON public.admin_activity_log FOR SELECT
  TO authenticated
  USING (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "Hospital admins can insert own activity" ON public.admin_activity_log;
CREATE POLICY "Hospital admins can insert own activity"
  ON public.admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );
