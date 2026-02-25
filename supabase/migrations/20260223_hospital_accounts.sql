-- Create hospital_accounts table for hospital verification flow
CREATE TABLE public.hospital_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  website text,
  address text,
  description text,
  account_status text NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hospital_accounts ENABLE ROW LEVEL SECURITY;

-- Users can read their own hospital account
CREATE POLICY "Users can view own hospital account"
  ON public.hospital_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can create a hospital account (signup)
CREATE POLICY "Authenticated users can create hospital account"
  ON public.hospital_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all hospital accounts
CREATE POLICY "Admins can view all hospital accounts"
  ON public.hospital_accounts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update hospital accounts (approve/reject)
CREATE POLICY "Admins can update hospital accounts"
  ON public.hospital_accounts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete hospital accounts
CREATE POLICY "Admins can delete hospital accounts"
  ON public.hospital_accounts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_hospital_accounts_user_id ON public.hospital_accounts(user_id);
CREATE INDEX idx_hospital_accounts_status ON public.hospital_accounts(account_status);
CREATE INDEX idx_hospital_accounts_created_at ON public.hospital_accounts(created_at DESC);
