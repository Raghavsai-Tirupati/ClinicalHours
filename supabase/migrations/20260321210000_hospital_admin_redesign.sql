-- Hospital Admin Redesign: add interview tracking + activity log

-- Track when interview invites were sent
ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS interview_invited_at timestamptz;

-- Activity log for hospital admin actions
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_page_id uuid NOT NULL REFERENCES public.hospital_pages(id) ON DELETE CASCADE,
  actor_email text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'status_change', 'email_sent', 'interview_invited',
    'position_created', 'position_updated', 'position_closed',
    'note_added', 'application_reviewed'
  )),
  target_type text, -- 'application', 'position', 'email'
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital admins can read own activity"
  ON public.admin_activity_log FOR SELECT TO authenticated
  USING (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Hospital admins can insert own activity"
  ON public.admin_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Platform admins can manage all activity"
  ON public.admin_activity_log FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_admin_activity_hospital_page_id
  ON public.admin_activity_log(hospital_page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_action_type
  ON public.admin_activity_log(action_type);

CREATE INDEX IF NOT EXISTS idx_student_applications_interview_invited
  ON public.student_applications(interview_invited_at)
  WHERE interview_invited_at IS NOT NULL;
