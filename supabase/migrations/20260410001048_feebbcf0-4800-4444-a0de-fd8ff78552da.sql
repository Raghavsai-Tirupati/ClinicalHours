ALTER TABLE public.position_questions
  ADD COLUMN IF NOT EXISTS char_limit integer DEFAULT NULL;

UPDATE public.position_questions
SET
  question_type = 'short_answer',
  char_limit = 2000
WHERE question_type = 'long_answer';