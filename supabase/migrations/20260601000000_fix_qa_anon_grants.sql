-- Fix Q&A tab loading forever for guest/anon users.
--
-- Root cause: migration 20260102000000 recreated the Q&A views with
-- security_invoker = true. This causes Postgres to check the CALLER's
-- permissions on the underlying tables, not the view owner's. The anon
-- role never received GRANT SELECT on these tables, so every query from
-- an unauthenticated session silently fails with a permission error.
--
-- The RLS policies already have USING(true) so all rows are readable;
-- we just need the GRANT to pass the privilege check before RLS runs.

GRANT SELECT ON public.opportunity_questions  TO anon, authenticated;
GRANT SELECT ON public.question_answers       TO anon, authenticated;
GRANT SELECT ON public.discussion_votes       TO anon, authenticated;
