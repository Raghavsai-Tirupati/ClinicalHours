-- Add student_id to applications for GPA lookup
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_student_id ON public.applications (student_id);
