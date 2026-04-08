# Email Templates — Catalog & Verification

This document catalogs every email template in the ClinicalHours codebase and
the variables each expects. It is the companion to
`scripts/renderEmailTemplates.ts`, which renders user-authored templates with
sample data for verification (dry run — no real sends).

## Two classes of templates

### 1. User-authored templates (database)

Stored in the Supabase table `email_templates` (one row per template, scoped
by `clinic_id`). Admins create and edit these in the **Email** tab of the
clinic dashboard. Supported template variables are defined in
`src/components/clinic-dashboard/email-communication/types.ts`:

| Placeholder   | Label  | Sample data          |
|---------------|--------|----------------------|
| `{{name}}`    | Name   | `Jane Doe`           |
| `{{role}}`    | Role   | `Volunteer`          |
| `{{date}}`    | Date   | `April 15, 2026`     |
| `{{shift}}`   | Shift  | `Morning (8 AM – 12 PM)` |

Substitution logic lives in `EmailTemplates.tsx` (`renderPreview`) — simple
string replace of each placeholder with its sample value.

Supported categories (from `TEMPLATE_CATEGORIES`):

- `accepted` — application accepted
- `rejected` — application not selected
- `waitlisted` — placed on waitlist
- `on_call` — on-call request
- `onboarding` — onboarding reminder

### 2. Hard-coded transactional templates (edge functions)

These are platform-level transactional emails inlined in edge function source
under `supabase/functions/<name>/index.ts`. They do NOT use the `{{var}}`
syntax — they use JS template literals with direct interpolation.

| Edge function                    | Purpose                              | Current `from`                                     |
|----------------------------------|--------------------------------------|----------------------------------------------------|
| `send-contact-email`             | Contact-form confirmation            | `ClinicalHours <support@clinicalhours.org>`        |
| `send-verification-email`        | Email verification                   | `ClinicalHours <support@clinicalhours.org>`        |
| `send-password-reset`            | Password reset                       | `ClinicalHours <support@clinicalhours.org>`        |
| `send-reminders`                 | Opportunity follow-up reminders      | `ClinicalHours <support@clinicalhours.org>`        |
| `notify-application-status`      | Application status updates           | `ClinicalHours <support@clinicalhours.org>`        |
| `hospital-review`                | Hospital listing review notifications| `ClinicalHours <noreply@clinicalhours.org>`        |
| `send-mass-email`                | Mass platform emails                 | `ClinicalHours <updates@clinicalhours.org>`        |
| `send-clinic-bulk-email`         | Clinic-initiated bulk email          | `RESEND_FROM_EMAIL` env (default `support@clinicalhours.org`) |
| `send-hospital-applicant-email`  | Clinic → applicant message           | per-clinic Gmail credentials                       |
| `send-position-interview-invites`| Interview invite                     | per-clinic Gmail credentials                       |

## From-address finding (IMPORTANT)

The task spec requires the from address for clinic templates to be
**`admin@bcsclinic.org`**. None of the current edge functions use that
address; they fall back to `*@clinicalhours.org` domains or per-clinic Gmail
credentials. Setting `admin@bcsclinic.org` as the from-address for BCS Free
Health Clinic should be done via one of:

1. Connecting the BCS Gmail account `admin@bcsclinic.org` in the clinic
   Settings → Email integration screen (stores encrypted
   `gmail_credentials` on `hospital_pages`), after which
   `send-hospital-applicant-email` and related functions will send as that
   address, OR
2. Setting the `RESEND_FROM_EMAIL` environment variable on the Supabase
   project to `BCS Free Health Clinic <admin@bcsclinic.org>` and verifying
   the domain in Resend.

No code change was made for this — it is an infrastructure/config decision.

## Waitlist bulk messaging (Task 4)

`src/components/clinic-dashboard/waitlist/BulkMessageDialog.tsx` contains a
`DRY_RUN` flag (currently `true`) that prevents real sends. The payload is
logged to `console.log` with `from: 'admin@bcsclinic.org'` as the intended
from-address. When a real transport is wired, flip the flag to `false` and
implement the actual call.

## Running the verification script

```bash
npx tsx scripts/renderEmailTemplates.ts
```

This prints every sample template with variables substituted, warns on any
unresolved `{{placeholder}}` tokens, and confirms the expected from-address.
It does not touch the network.
