# Calendly Webhook Setup

This guide explains how to connect Calendly so that when students book an interview slot, the chosen time automatically appears in the hospital admin dashboard.

## Overview

1. Deploy the `calendly-webhook` Edge Function (see [LOVABLE_CALENDLY_WEBHOOK_PROMPT.md](./LOVABLE_CALENDLY_WEBHOOK_PROMPT.md)).
2. Register your webhook URL in Calendly.
3. Add the signing key to Supabase secrets.

## Prerequisites

- Calendly Pro or Teams (webhooks require a paid plan).
- Calendly API access: [Create an app](https://developer.calendly.com/creating-an-oauth-app) or use a Personal Access Token.

## 1. Get the webhook signing key

When you create a webhook subscription in Calendly, you receive a signing key. This is used to verify that incoming requests are from Calendly.

- Via API: The `POST /webhook_subscriptions` response includes a `signing_key`.
- Via Calendly UI: Some integrations expose the signing key in webhook settings.

## 2. Add the signing key to Supabase

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
CALENDLY_WEBHOOK_SIGNING_KEY=<your-signing-key>
```

## 3. Register the webhook with Calendly

**Option A: Calendly API**

```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer YOUR_CALENDLY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendly-webhook",
    "events": ["invitee.created", "invitee.canceled"],
    "scope": "organization",
    "organization": "https://api.calendly.com/organizations/YOUR_ORG_ID"
  }'
```

Save the `signing_key` from the response and add it to Supabase secrets (step 2).

**Option B: Calendly Integrations**

If Calendly offers a built-in integration for custom webhooks, configure it with your Edge Function URL and the events above.

## 4. Match booking URL to hospital

Each hospital stores their Calendly link in **Hospital Settings → Interview Booking Link** (or on the Interviews tab). The URL (e.g. `https://calendly.com/your-clinic/interview`) must match the event type used when the student books. The webhook receiver matches the event’s `scheduling_url` to `hospital_pages.interview_booking_url` to determine which hospital the booking belongs to.

## 5. Testing

1. Ensure a hospital has an `interview_booking_url` set.
2. Have a test `student_applications` row with `applicant_email` matching the email you’ll use to book.
3. Book a Calendly event with that email.
4. Check that `interview_confirmed_at` is updated and appears in the hospital admin Interviews tab.

## Troubleshooting

- **No update**: Check Edge Function logs in Supabase. Common causes: URL mismatch (trailing slash, http vs https), email case sensitivity, or no matching application.
- **401/403**: The webhook endpoint must accept unauthenticated POSTs from Calendly. Do not require Supabase auth for this route.
- **Repeated events**: Ensure idempotent handling using `payload.uri` or similar to avoid duplicate updates on retries.
