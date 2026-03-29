-- Super-admin SELECT bypass for student_applications
CREATE POLICY "Super admin can view all applications"
ON public.student_applications
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Super-admin UPDATE bypass for student_applications
CREATE POLICY "Super admin can update all applications"
ON public.student_applications
FOR UPDATE
TO authenticated
USING (public.is_super_admin());

-- Super-admin bypass for hospital_positions SELECT
CREATE POLICY "Super admin can view all positions"
ON public.hospital_positions
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Super-admin bypass for hospital_positions ALL
CREATE POLICY "Super admin can manage all positions"
ON public.hospital_positions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Super-admin bypass for position_questions
CREATE POLICY "Super admin can manage all questions"
ON public.position_questions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Super-admin bypass for application_answers SELECT
CREATE POLICY "Super admin can view all answers"
ON public.application_answers
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Super-admin bypass for admin_activity_log SELECT
CREATE POLICY "Super admin can read all activity"
ON public.admin_activity_log
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Super-admin bypass for admin_activity_log INSERT
CREATE POLICY "Super admin can insert activity"
ON public.admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- Super-admin bypass for hospital_pages UPDATE  
CREATE POLICY "Super admin can update all pages"
ON public.hospital_pages
FOR UPDATE
TO authenticated
USING (public.is_super_admin());