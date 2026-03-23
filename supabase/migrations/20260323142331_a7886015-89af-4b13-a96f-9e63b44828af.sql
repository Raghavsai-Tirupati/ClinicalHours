
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_page_id uuid REFERENCES public.hospital_pages(id) ON DELETE CASCADE,
  actor_email text NOT NULL,
  action_type text NOT NULL,
  target_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital admins can read own activity"
  ON public.admin_activity_log FOR SELECT TO authenticated
  USING (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower(auth.email())
    )
  );

CREATE POLICY "Service role can insert activity"
  ON public.admin_activity_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read all activity"
  ON public.admin_activity_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
