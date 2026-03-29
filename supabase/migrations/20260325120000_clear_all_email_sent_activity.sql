-- Option B: Remove all "sent email" history from the hospital Email page sidebar
-- (every hospital_page_id). Other activity types are untouched.
DELETE FROM public.admin_activity_log
WHERE action_type = 'email_sent';
