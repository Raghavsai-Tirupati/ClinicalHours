
-- Create hospital_pages table
CREATE TABLE public.hospital_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT hospital_pages_hospital_id_key UNIQUE (hospital_id)
);

-- Enable RLS
ALTER TABLE public.hospital_pages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage hospital pages"
  ON public.hospital_pages
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Hospital admins can read their own row matched by email
CREATE POLICY "Hospital admins can read own page by email"
  ON public.hospital_pages
  FOR SELECT
  TO authenticated
  USING (
    lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );
