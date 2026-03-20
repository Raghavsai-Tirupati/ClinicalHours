-- Hospital Pages table
-- Tracks opportunities/hospitals that have been set up by admins for self-service claiming.
-- When a hospital admin clicks the invite link or signs up with the matching email,
-- they can claim the page and manage their hospital profile.
-- References the opportunities table (same data source as the main listings page).

CREATE TABLE IF NOT EXISTS hospital_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(hospital_id)
);

-- Enable RLS
ALTER TABLE hospital_pages ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "Admins can manage hospital_pages"
  ON hospital_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Hospital owners can read their own page (matched by email)
CREATE POLICY "Hospital admins can read own page"
  ON hospital_pages
  FOR SELECT
  USING (
    admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_hospital_pages_hospital_id ON hospital_pages(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_pages_admin_email ON hospital_pages(admin_email);
