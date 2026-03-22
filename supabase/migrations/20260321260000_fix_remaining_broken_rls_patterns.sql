-- Fix remaining broken RLS patterns that used:
--   (SELECT email FROM auth.users WHERE id = auth.uid())
-- This pattern silently returns no rows because the authenticated role cannot
-- access auth.users. Replace everywhere with auth.email() which reads the JWT.

-- ── hospital_pages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can read own page" ON public.hospital_pages;
CREATE POLICY "Hospital admins can read own page"
  ON public.hospital_pages FOR SELECT
  TO authenticated
  USING (lower(admin_email) = lower(auth.email()));

DROP POLICY IF EXISTS "Hospital members can create own page" ON public.hospital_pages;
CREATE POLICY "Hospital members can create own page"
  ON public.hospital_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    hospital_id IN (
      SELECT o.id
      FROM public.opportunities o
      JOIN public.hospital_accounts ha ON ha.hospital_id = o.hospital_id
      JOIN public.hospital_members hm ON hm.account_id = ha.id
      WHERE hm.user_id = auth.uid()
    )
    AND lower(admin_email) = lower(auth.email())
  );

-- ── hospital_positions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can manage own positions" ON public.hospital_positions;
CREATE POLICY "Hospital admins can manage own positions"
  ON public.hospital_positions FOR ALL
  TO authenticated
  USING (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

-- ── position_questions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hospital admins can manage own questions" ON public.position_questions;
CREATE POLICY "Hospital admins can manage own questions"
  ON public.position_questions FOR ALL
  TO authenticated
  USING (
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  )
  WITH CHECK (
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE lower(hpg.admin_email) = lower(auth.email())
    )
  );
