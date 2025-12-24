-- Add unique constraint to prevent duplicate saved opportunities
ALTER TABLE public.saved_opportunities
ADD CONSTRAINT unique_user_opportunity UNIQUE (user_id, opportunity_id);

-- Add foreign key to profiles table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'saved_opportunities_user_id_fkey' 
    AND table_name = 'saved_opportunities'
  ) THEN
    ALTER TABLE public.saved_opportunities
    ADD CONSTRAINT saved_opportunities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;