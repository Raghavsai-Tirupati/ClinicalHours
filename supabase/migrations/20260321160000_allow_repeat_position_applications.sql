-- Allow students to apply to the same position multiple times.
-- Older schema enforced one application per (position_id, student_id).

ALTER TABLE public.student_applications
DROP CONSTRAINT IF EXISTS student_applications_position_id_student_id_key;

-- Defensive cleanup: drop any standalone unique index for the same key if present.
DROP INDEX IF EXISTS public.student_applications_position_id_student_id_key;
DROP INDEX IF EXISTS public.idx_student_applications_unique_position_student;
