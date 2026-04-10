
-- Allow clinic admins to INSERT application documents for their own applicants
CREATE POLICY "Clinic admins insert application documents"
  ON public.application_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = application_documents.application_id
        AND lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  );

-- Allow clinic admins to DELETE application documents for their own applicants
CREATE POLICY "Clinic admins delete application documents"
  ON public.application_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = application_documents.application_id
        AND lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  );
