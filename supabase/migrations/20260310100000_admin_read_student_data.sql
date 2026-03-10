-- Allow admins to read saved_opportunities and experience_entries
-- so the Activity tab can show student tracking and hours data.

CREATE POLICY "Admins can read all saved opportunities"
ON public.saved_opportunities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can read all experience entries"
ON public.experience_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
