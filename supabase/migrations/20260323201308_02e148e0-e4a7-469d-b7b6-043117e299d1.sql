ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS interview_invited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_student_applications_interview_invited
  ON public.student_applications (interview_invited_at)
  WHERE interview_invited_at IS NOT NULL;