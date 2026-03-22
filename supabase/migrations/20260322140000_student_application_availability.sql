-- Student-submitted availability captured on the multi-step position apply flow
ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS availability_json jsonb;

COMMENT ON COLUMN public.student_applications.availability_json IS
  'Structured availability from student apply wizard: days, time_pref, hours_per_week, commitment.';
