-- Normalize Cherokee Indian Hospital name
-- The original import included Cherokee syllabary characters and punctuation
-- that render as a "weird" name in the UI. Keep the record but standardize
-- the display name to the plain English version.

UPDATE public.opportunities
SET name = 'Cherokee Indian Hospital'
WHERE id = 'ac27d205-cdc1-4ea8-98c4-9019bf0a9fba';

