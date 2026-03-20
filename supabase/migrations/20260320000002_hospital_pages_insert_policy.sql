-- Allow authenticated hospital members to create their own hospital_pages record
-- This bridges old system (hospital_members) to new system (hospital_pages)
CREATE POLICY "Hospital members can create own page"
  ON hospital_pages
  FOR INSERT
  WITH CHECK (
    -- User can only insert a record for a hospital they are a member of
    hospital_id IN (
      SELECT ha.hospital_id
      FROM hospital_members hm
      JOIN hospital_accounts ha ON ha.id = hm.account_id
      WHERE hm.user_id = auth.uid()
    )
    -- And the admin_email must match their own email
    AND admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Also allow hospital admins to update their own page (for claiming, etc.)
CREATE POLICY "Hospital admins can update own page"
  ON hospital_pages
  FOR UPDATE
  USING (
    admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
