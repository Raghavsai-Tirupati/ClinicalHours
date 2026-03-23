-- BCS Free Health Clinic: let hospital owners/admins remove extra opportunity rows
-- (e.g. mistaken deploys) without being the original created_by. Rows that anchor
-- hospital_pages cannot be deleted (would cascade-remove the admin page).

CREATE POLICY "BCS hospital admins delete opportunities"
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (
    opportunities.hospital_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.hospitals h
      WHERE h.id = opportunities.hospital_id
        AND lower(trim(h.name)) = lower(trim('BCS Free Health Clinic'))
    )
    AND EXISTS (
      SELECT 1
      FROM public.hospital_members hm
      JOIN public.hospital_accounts ha ON ha.id = hm.account_id
      WHERE ha.hospital_id = opportunities.hospital_id
        AND hm.user_id = auth.uid()
        AND hm.role IN ('owner', 'admin')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.hospital_pages hp
      WHERE hp.hospital_id = opportunities.id
    )
  );
