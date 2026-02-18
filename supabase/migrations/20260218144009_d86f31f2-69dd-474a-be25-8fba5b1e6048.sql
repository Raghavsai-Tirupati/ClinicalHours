-- 1. Add slug column to opportunities table
ALTER TABLE public.opportunities ADD COLUMN slug text UNIQUE;

-- 2. Create applications table
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_email text NOT NULL,
  student_phone text,
  resume_url text,
  essay_responses jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'accepted', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Enable RLS on applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Anyone can read opportunities (already exists, but ensure it's there)
-- Skip - already exists per schema

-- 5. RLS: Anyone can submit an application (no auth required for public form)
CREATE POLICY "Anyone can create applications"
  ON public.applications
  FOR INSERT
  WITH CHECK (true);

-- 6. RLS: Authenticated users can read applications for opportunities they own
CREATE POLICY "Opportunity owners can view applications"
  ON public.applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.id = applications.opportunity_id
        AND opportunities.created_by = auth.uid()
    )
  );

-- 7. RLS: Opportunity owners can update application status
CREATE POLICY "Opportunity owners can update applications"
  ON public.applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.id = applications.opportunity_id
        AND opportunities.created_by = auth.uid()
    )
  );

-- 8. Admins can do everything on applications
CREATE POLICY "Admins can manage all applications"
  ON public.applications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));