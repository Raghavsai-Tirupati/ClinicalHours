-- Remove the foreign key constraint that requires profiles to exist
-- (saved_opportunities should reference auth.users, not profiles)
ALTER TABLE public.saved_opportunities 
DROP CONSTRAINT IF EXISTS saved_opportunities_user_id_fkey;

-- Create trigger for new users if it doesn't exist
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();