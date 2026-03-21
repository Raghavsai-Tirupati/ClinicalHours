ALTER TABLE public.hospital_accounts
ADD COLUMN IF NOT EXISTS interview_booking_url text;

COMMENT ON COLUMN public.hospital_accounts.interview_booking_url IS
'Public scheduling URL used for manual interview invites (e.g., Calendly event link).';
