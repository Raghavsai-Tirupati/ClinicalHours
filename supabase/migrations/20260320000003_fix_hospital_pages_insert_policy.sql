-- Fix: The original INSERT policy compared hospital_pages.hospital_id (which is
-- an opportunities.id) against hospital_accounts.hospital_id (which is a hospitals.id).
-- These are different tables/UUIDs, so the policy always blocked inserts.
-- This corrected version bridges through the opportunities table.

DROP POLICY IF EXISTS "Hospital members can create own page" ON hospital_pages;

CREATE POLICY "Hospital members can create own page"
  ON hospital_pages
  FOR INSERT
  WITH CHECK (
    -- User can only insert a record for a hospital they are a member of.
    -- hospital_pages.hospital_id references opportunities(id),
    -- so we join opportunities → hospitals → hospital_accounts → hospital_members
    hospital_id IN (
      SELECT o.id
      FROM opportunities o
      JOIN hospital_accounts ha ON ha.hospital_id = o.hospital_id
      JOIN hospital_members hm ON hm.account_id = ha.id
      WHERE hm.user_id = auth.uid()
    )
    -- And the admin_email must match their own email
    AND admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
