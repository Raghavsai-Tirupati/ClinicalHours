-- Allow BCS Free Health Clinic hospital admins (owner/admin) to delete
-- opportunity listings tied to their hospital, EXCEPT the primary listing
-- referenced by hospital_pages (which is the main admin page anchor).
CREATE POLICY "BCS hospital admins can delete non-protected opportunities"
ON public.opportunities
FOR DELETE
TO authenticated
USING (
  -- Only opportunities linked to a hospital
  hospital_id IS NOT NULL
  -- The current user must be owner or admin on that hospital's account
  AND EXISTS (
    SELECT 1
    FROM hospital_members hm
    JOIN hospital_accounts ha ON ha.id = hm.account_id
    JOIN hospitals h ON h.id = ha.hospital_id
    WHERE ha.hospital_id = opportunities.hospital_id
      AND hm.user_id = auth.uid()
      AND hm.role IN ('owner', 'admin')
      -- BCS pilot restriction
      AND lower(trim(h.name)) = 'bcs free health clinic'
  )
  -- Cannot delete the opportunity that is the anchor for hospital_pages
  AND NOT EXISTS (
    SELECT 1
    FROM hospital_pages hp
    WHERE hp.hospital_id = opportunities.id
  )
);