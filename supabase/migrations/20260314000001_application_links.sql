CREATE TABLE IF NOT EXISTS application_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_name text NOT NULL,
  hospital_name_lower text GENERATED ALWAYS AS (lower(hospital_name)) STORED,
  hospital_website text,
  application_url text,
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  search_query text,
  verified boolean DEFAULT false,
  last_searched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_links_name_lower ON application_links(hospital_name_lower);
CREATE INDEX IF NOT EXISTS idx_application_links_hospital ON application_links(hospital_name);

-- Allow the service role (edge functions) to read/write; block anon/authenticated direct access
ALTER TABLE application_links ENABLE ROW LEVEL SECURITY;

-- No public access — all reads/writes go through the edge function (service role bypasses RLS)
CREATE POLICY "No direct access" ON application_links
  FOR ALL TO anon, authenticated USING (false);
