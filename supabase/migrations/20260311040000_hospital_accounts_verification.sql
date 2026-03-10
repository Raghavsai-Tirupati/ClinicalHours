-- Add verification flow columns to hospital_accounts (extends ecosystem schema)
-- Enables admin approval: new signups start as 'pending', admins approve/reject

ALTER TABLE public.hospital_accounts
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'approved'
    CHECK (account_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

-- Index for admin pending queue
CREATE INDEX IF NOT EXISTS idx_hospital_accounts_account_status
  ON public.hospital_accounts(account_status);
