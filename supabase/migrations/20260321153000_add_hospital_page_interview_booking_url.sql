ALTER TABLE public.hospital_pages
ADD COLUMN IF NOT EXISTS interview_booking_url text;

COMMENT ON COLUMN public.hospital_pages.interview_booking_url IS
'Public scheduling URL used by hospital page admins for interview invites (e.g., Calendly link).';
