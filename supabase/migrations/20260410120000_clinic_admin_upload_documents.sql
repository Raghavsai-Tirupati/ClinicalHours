-- Allow clinic admins to insert application_documents for their applicants.
-- Students already have an INSERT policy (student_id = auth.uid()), but clinic
-- admins upload files on behalf of applicants from the person profile page, so
-- their auth.uid() != student_id and the existing policy blocks them.

CREATE POLICY "Clinic admins insert application documents"
  ON application_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = application_documents.application_id
        AND hpg.admin_email = auth.jwt() ->> 'email'
    )
  );

-- Also allow clinic admins to delete documents they uploaded for their applicants.
CREATE POLICY "Clinic admins delete application documents"
  ON application_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = application_documents.application_id
        AND hpg.admin_email = auth.jwt() ->> 'email'
    )
  );
