-- Add 'interview' status and ai_summary column to student_applications

-- 1. Drop the existing check constraint and re-create with 'interview' included
ALTER TABLE public.student_applications
  DROP CONSTRAINT IF EXISTS student_applications_status_check;

ALTER TABLE public.student_applications
  ADD CONSTRAINT student_applications_status_check
  CHECK (status IN ('new', 'under_review', 'interview', 'accepted', 'rejected', 'waitlisted'));

-- 2. Add ai_summary column for cached Claude-generated summaries
ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Note: RLS already covers this column via existing policies on student_applications.
-- Hospital admins can read/write all columns for applications to their positions.
