-- Add char_limit to position_questions for configurable free-response limits
ALTER TABLE public.position_questions
  ADD COLUMN IF NOT EXISTS char_limit integer DEFAULT NULL;
