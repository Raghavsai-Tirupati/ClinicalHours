# Lovable: Calendly Webhook — Hospital Admin Sees Student-Chosen Interview Time

Use this prompt in Lovable to implement automatic sync of Calendly booking times into the hospital admin dashboard, so admins see what time the student picked on Calendly without manual entry.

---

## Copy-paste prompt for Lovable

```
Implement Calendly webhook integration so hospital admins can see the interview time students pick when booking via Calendly.

### Context
- Students receive an interview invite email with a Calendly (or similar) link stored in `hospital_pages.interview_booking_url`.
- When a student books a slot on Calendly, we need to capture that and update the application so the hospital admin sees it in the Interviews tab.
- Currently admins manually set `interview_confirmed_at` via a datetime picker. We want Calendly bookings to auto-populate this.

### 1. Calendly Webhook Receiver (Supabase Edge Function)

Create a new Edge Function: `supabase/functions/calendly-webhook/index.ts`

- Accept POST requests only; return 405 for others.
- Calendly sends `invitee.created` when someone schedules, and `invitee.canceled` when they cancel.
- **Payload structure** (from Calendly docs):
  - `event`: `"invitee.created"` or `"invitee.canceled"`
  - `payload`:
    - `email`: invitee email
    - `event`: start time (ISO 8601), `uri`, `event_type`
    - `event_type`: `scheduling_url` (e.g. `https://calendly.com/username/event-type`), `uri`
- **Verification**: Calendly sends `Calendly-Webhook-Signature` header: `t=<timestamp>,v1=<hmac>`. Verify using HMAC-SHA256: sign `timestamp.rawbody` (timestamp + "." + raw request body string) with your webhook signing key; compare to v1. Use raw body—never parsed/re-serialized JSON. Store `CALENDLY_WEBHOOK_SIGNING_KEY` in Supabase secrets. Reject if signature invalid or timestamp > 5 min old (replay protection). For local dev without key, log warning and optionally skip verification.
- **Idempotency**: Use `payload.uri` or a unique ID from the payload as idempotency key to avoid duplicate processing on retries.

### 2. Matching Logic

**For `invitee.created`:**
- Extract `email` (invitee) and `start_time` (event start) from payload.
- Extract `scheduling_url` from `event_type` (or construct from event metadata). Normalize: trim, lowercase for comparison.
- Find `hospital_pages` where `interview_booking_url` matches the scheduling URL. Normalize stored URL (trim, lowercase) for comparison. Match if one URL contains the other or they're equal (handles trailing slashes, http vs https).
- Find `student_applications` where:
  - `applicant_email` ILIKE the invitee email (trimmed, normalized),
  - AND the application's `position_id` belongs to a `hospital_position` whose `hospital_page_id` matches the matched hospital page.
- If multiple applications match (same person applied to multiple positions at same hospital), update the most recent one with `interview_invited_at` set (or the one in `interview` status). Define a clear tie-breaker.
- Update: set `interview_confirmed_at` = parsed `start_time` (as timestamptz), and set `status` = `'interview'` if not already accepted/rejected/waitlisted.
- Use Supabase service role client to bypass RLS.

**For `invitee.canceled`:**
- Same matching logic.
- Update: set `interview_confirmed_at` = NULL. Optionally revert status to `under_review` if it was `interview` (your product decision).

### 3. Database (if needed)

- `student_applications` already has `interview_confirmed_at` and `status`. No schema change required for basic flow.
- **Optional**: Add `interview_source` column (`'manual' | 'calendly'`) to distinguish admin-set vs Calendly-synced times. If you add it, set it when updating from webhook.
- **Optional**: Add `calendly_event_uri` or similar to avoid re-processing the same event. For simplicity, you can rely on Calendly’s retries being idempotent (same event, same result).

### 4. Calendly Webhook Setup (one-time per Calendly account)

- In Calendly: Integrations → Webhooks, or use the API: `POST https://api.calendly.com/webhook_subscriptions`
- Body: `{ "url": "https://<project>.supabase.co/functions/v1/calendly-webhook", "events": ["invitee.created", "invitee.canceled"], "scope": "organization", "organization": "<org_uri>" }`
- Requires Calendly API token with appropriate scope.
- See `docs/CALENDLY_SETUP.md` for obtaining the signing key, adding it to Supabase Secrets, and registering the webhook URL.

### 5. Edge Function CORS / Invoke

- Ensure the function allows invocation from Calendly (public POST, no auth header required). Calendly will not send a Supabase auth header.
- Use `supabase functions deploy calendly-webhook` and expose the URL to Calendly.

### 6. UI (already in place)

- The Interviews tab and applicant cards already display `interview_confirmed_at` (“Scheduled …” line). No UI changes needed once the webhook updates the database.
- Optionally show a small “Synced from Calendly” badge when `interview_source === 'calendly'` if you add that column.

### 7. Error Handling and Logging

- Log successful matches and updates.
- Log when no matching hospital_page or application is found (might be a different Calendly event type, or a booking from outside our system).
- On any processing error, return 200 to Calendly so it doesn’t retry excessively; log the error for debugging.
- Consider adding a `calendly_webhook_log` table (optional) for debugging: event type, payload snapshot, match result, error message.

### 8. Testing

- Use Calendly’s test events or a tool like ngrok to forward requests to your local Edge Function.
- Manually create a booking with an email that matches a `student_applications.applicant_email` for a hospital with a matching `interview_booking_url`.
- Verify `interview_confirmed_at` is updated and appears in the Interviews tab.
- Test `invitee.canceled` and verify `interview_confirmed_at` is cleared.
```

---

## Repo-specific notes

- **Tables**: `hospital_pages` (has `interview_booking_url`), `student_applications` (has `applicant_email`, `interview_confirmed_at`, `position_id`, `interview_invited_at`, `status`), `hospital_positions` (has `hospital_page_id`, links to `hospital_pages`).
- **Reference**: `supabase/functions/stripe-webhook/index.ts` shows the pattern for webhook verification, service role client, and returning 200 on errors.
- **Migrations**: If you add `interview_source` or `calendly_webhook_log`, create a new migration in `supabase/migrations/` with a timestamp prefix.
- **Secrets**: Add `CALENDLY_WEBHOOK_SIGNING_KEY` in Supabase Dashboard → Project Settings → Edge Functions → Secrets, after obtaining it from Calendly’s webhook subscription settings.

