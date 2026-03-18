# Cleanup Unverified Users

**Cron** (default): Deletes profiles with `email_verified = false` and `created_at` older than 24 hours, then removes their verification tokens and auth user records.

**One-time purge** (`?full=true`): Deletes ALL unverified accounts.

## Run one-time delete of all unverified accounts

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-unverified-users?full=true" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Replace `YOUR_PROJECT_REF` (from Supabase project URL) and `YOUR_SERVICE_ROLE_KEY` (Supabase Dashboard → Settings → API → service_role key).

## Schedule cron (hourly)

Supabase Dashboard → Cron Jobs, or external cron calling the same URL without `?full=true`.

The cleanup endpoint is idempotent and safe to run repeatedly. It should run at least hourly so unverified accounts never linger past the retention window.
