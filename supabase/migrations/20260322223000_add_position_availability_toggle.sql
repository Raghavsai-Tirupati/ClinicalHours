-- Per-position toggle for whether applicants are asked availability questions.
ALTER TABLE public.hospital_positions
  ADD COLUMN IF NOT EXISTS ask_for_availability boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.hospital_positions.ask_for_availability IS
  'When true, applicant flow includes availability step; when false, availability is skipped.';
