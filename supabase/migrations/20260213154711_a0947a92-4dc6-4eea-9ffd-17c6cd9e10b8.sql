
-- Drop the overly permissive service role policy and replace with a tighter one
DROP POLICY "Service role full access on import_jobs" ON public.import_jobs;
