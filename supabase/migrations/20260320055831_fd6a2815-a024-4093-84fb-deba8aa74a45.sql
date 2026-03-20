DELETE FROM auth.sessions WHERE user_id = '40fa52df-6762-4e85-bec8-43d77f974e95';
DELETE FROM auth.refresh_tokens WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = '40fa52df-6762-4e85-bec8-43d77f974e95');
DELETE FROM auth.mfa_factors WHERE user_id = '40fa52df-6762-4e85-bec8-43d77f974e95';
DELETE FROM auth.identities WHERE user_id = '40fa52df-6762-4e85-bec8-43d77f974e95';
DELETE FROM auth.users WHERE id = '40fa52df-6762-4e85-bec8-43d77f974e95';