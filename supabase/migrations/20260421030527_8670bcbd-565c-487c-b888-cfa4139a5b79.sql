-- Grant premium access to avnityagi0509@gmail.com
-- Temporarily disable the preservation trigger, update, then re-enable
ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET is_premium = true,
    premium_expires_at = NULL
WHERE id = '19db7b7e-2069-45cb-822a-9e9826ecf6a1';

ALTER TABLE public.profiles ENABLE TRIGGER USER;