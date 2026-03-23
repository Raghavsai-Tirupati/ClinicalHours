ALTER TABLE public.student_applications 
  ADD COLUMN IF NOT EXISTS interview_source text DEFAULT NULL;