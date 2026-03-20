-- Allow anyone to read hospital_pages so public opportunity pages can look up positions
CREATE POLICY "Anyone can read hospital pages"
  ON public.hospital_pages
  FOR SELECT
  TO public
  USING (true);