
-- Fix hospital_pages policies that reference auth.users
DROP POLICY IF EXISTS "Hospital admins can read own page by email" ON public.hospital_pages;
CREATE POLICY "Hospital admins can read own page by email"
  ON public.hospital_pages FOR SELECT TO authenticated
  USING (lower(admin_email) = lower(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "Hospital admins can update own page" ON public.hospital_pages;
CREATE POLICY "Hospital admins can update own page"
  ON public.hospital_pages FOR UPDATE TO authenticated
  USING (lower(admin_email) = lower(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "Hospital members can create own page" ON public.hospital_pages;
CREATE POLICY "Hospital members can create own page"
  ON public.hospital_pages FOR INSERT TO authenticated
  WITH CHECK (
    (hospital_id IN (
      SELECT o.id FROM opportunities o
      JOIN hospital_accounts ha ON ha.hospital_id = o.hospital_id
      JOIN hospital_members hm ON hm.account_id = ha.id
      WHERE hm.user_id = auth.uid()
    ))
    AND admin_email = auth.jwt()->>'email'
  );

-- Fix hospital_positions policy
DROP POLICY IF EXISTS "Hospital admins can manage own positions" ON public.hospital_positions;
CREATE POLICY "Hospital admins can manage own positions"
  ON public.hospital_positions FOR ALL TO authenticated
  USING (hospital_page_id IN (
    SELECT id FROM hospital_pages WHERE lower(admin_email) = lower(auth.jwt()->>'email')
  ));

-- Fix position_questions policy
DROP POLICY IF EXISTS "Hospital admins can manage own questions" ON public.position_questions;
CREATE POLICY "Hospital admins can manage own questions"
  ON public.position_questions FOR ALL TO authenticated
  USING (position_id IN (
    SELECT hp.id FROM hospital_positions hp
    JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
    WHERE lower(hpg.admin_email) = lower(auth.jwt()->>'email')
  ));

-- Fix student_applications policy
DROP POLICY IF EXISTS "Hospital admins can view applications to their positions" ON public.student_applications;
CREATE POLICY "Hospital admins can view applications to their positions"
  ON public.student_applications FOR ALL TO authenticated
  USING (position_id IN (
    SELECT hp.id FROM hospital_positions hp
    JOIN hospital_pages hpg ON hp.hospital_page_id = hpg.id
    WHERE lower(hpg.admin_email) = lower(auth.jwt()->>'email')
  ));
