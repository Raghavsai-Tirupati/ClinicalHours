-- Fix SECURITY DEFINER views by recreating with security_invoker = true

-- Fix opportunities_with_ratings view
DROP VIEW IF EXISTS public.opportunities_with_ratings;

CREATE VIEW public.opportunities_with_ratings 
WITH (security_invoker = true) AS
SELECT 
  o.*,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as review_count
FROM public.opportunities o
LEFT JOIN public.reviews r ON o.id = r.opportunity_id
GROUP BY o.id;

-- Fix questions_with_votes view (if it exists without security_invoker)
DROP VIEW IF EXISTS public.questions_with_votes;

CREATE VIEW public.questions_with_votes
WITH (security_invoker = true) AS
SELECT 
  q.id,
  q.opportunity_id,
  q.user_id,
  q.title,
  q.body,
  q.created_at,
  q.updated_at,
  COALESCE(SUM(v.value), 0) as vote_count,
  COUNT(DISTINCT a.id) as answer_count,
  p.full_name as author_name
FROM public.opportunity_questions q
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
LEFT JOIN public.question_answers a ON a.question_id = q.id
LEFT JOIN public.profiles p ON p.id = q.user_id
GROUP BY q.id, p.full_name;

-- Fix answers_with_votes view (if it exists without security_invoker)
DROP VIEW IF EXISTS public.answers_with_votes;

CREATE VIEW public.answers_with_votes
WITH (security_invoker = true) AS
SELECT 
  a.id,
  a.question_id,
  a.user_id,
  a.body,
  a.is_accepted,
  a.created_at,
  a.updated_at,
  COALESCE(SUM(v.value), 0) as vote_count,
  p.full_name as author_name
FROM public.question_answers a
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
LEFT JOIN public.profiles p ON p.id = a.user_id
GROUP BY a.id, p.full_name;