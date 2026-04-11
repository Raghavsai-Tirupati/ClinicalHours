# Lovable implementation handoff — Hospital admin dashboard

Use this prompt in Lovable to align UI/UX and behavior with the ClinicalHours hospital admin experience. The React app in this repo is the source of truth for flows; mirror these patterns and copy where helpful.

---

## Copy-paste prompt for Lovable

```
Build or refine a hospital/clinic admin dashboard with these requirements:

### Navigation (sidebar)
- Items: Overview, Positions (badge = active position count), Interviews, Email, Activity, New Position, Settings, Log Out.
- The full applicant workspace (advanced filters, sortable table, kanban, response analytics) lives under Positions in the "All Applicants" tab.

### Positions
- Route `{basePath}/positions` with two tabs: Positions (list/kanban) and All Applicants (applicant workspace with advanced filters, multi-rule filter bar, presets, sortable table, kanban, response analytics).
- Positions tab: list/kanban of positions by status (draft, active, paused, closed, archived).
- Position detail URL: `{basePath}/positions/:positionId` with tabs: Applicants | Analytics | Details.
- Applicants tab: search, status filter, sort (newest, GPA, clinical hours, experience, resume readiness, name), bulk select, “Email selected”, “Send interview invite”, interview booking link (HTTPS Calendly-style URL saved on the hospital page).
- Analytics tab: response analytics (bar segments per custom question); clicking a segment shows which applicants chose it.

### Interviews tab
- Header + short description explaining pipeline + quick actions.
- Card: Interview booking link (save HTTPS URL to hospital page settings).
- Four stat cards: Review queue | Interview | Completed | Scheduled (count with `interview_confirmed_at` set).
- Sections:
  1) Review queue — applications that are `new`, OR `under_review` without `interview_invited_at`, OR `waitlisted` without `interview_invited_at`.
  2) Interview — not accepted/rejected AND (`status === interview` OR `interview_invited_at` is set).
  3) Completed — accepted or rejected.
- Each applicant card: avatar initial, name, email, status badge, position title, optional “Legacy application” badge, “Invited …” line (date+time from `interview_invited_at`), “Scheduled …” line (date+time from `interview_confirmed_at`).
- Card overflow menu (⋯):
  - Open position → link to position detail when `position_id` is a real hospital position; else link to All applicants (Positions > All Applicants tab).
  - Review queue: Mark under review (if new); Advance to interview; Set interview time.
  - Interview: Set/reschedule interview time; Clear scheduled time; Mark accepted / rejected / waitlisted; Back to under review.
  - Completed: Reopen as under review.
- Modal “Set interview time”: `datetime-local` input; on save persist `interview_confirmed_at` (ISO). For normal (non-legacy) applications, if status is `new` or `under_review`, also set status to `interview`. Show note that this does not auto-email the applicant.
- Loading overlay on card while mutations run.

### Email tab
- Compose rich email + recipient filters (all / by position / by status) + checklist of recipients + send.
- Sidebar “Sent Emails” from activity log entries with `action_type === email_sent`.
- Each sent row is clickable; open a dialog listing recipients resolved from `metadata.applicationIds` joined to current applications (name + email). If `applicationIds` missing, show “Recipient details were not stored”.

### Data / backend expectations (Supabase-shaped)
- `student_applications`: includes `interview_invited_at`, `interview_confirmed_at` (confirmed interview start), `status` enum: new, under_review, interview, accepted, rejected, waitlisted.
- `hospital_applications` (legacy): `interview_confirmed_at`, status constrained to submitted/in_review/accepted/rejected; map UI statuses accordingly (interview/waitlisted → in_review in DB).
- Activity log: general sends log `metadata: { subject, recipientCount, applicationIds[], bodyPreview, attachmentCount }`.
- Edge function or API sends email and writes activity rows.

### Visual style
- Dark admin UI, compact cards, muted borders, primary accents, badges for status colors consistent across tables and interview cards.

Implement empty states, loading skeletons, and toasts for success/errors. Keep mobile-friendly stacking for stat grids and card grids.
```

---

## Migration prompt (if you have the old Applications tab)

If your Lovable dashboard still has a separate "Applications" sidebar item, paste this to migrate:

```
Remove the Applications tab from the sidebar. Migrate the applicant workspace into Positions:

1. Sidebar: Remove "Applications" — keep Overview, Positions, Interviews, Email, Activity, New Position, Settings, Log Out.

2. Positions page: Add two tabs — "Positions" (list/kanban of positions) and "All Applicants".

3. All Applicants tab: Move the full applicant workspace here. Include:
   - Advanced filter bar with "Add filter" dropdown, "Presets", and rules (status, position, GPA, clinical hours, graduation year, university, major, etc.)
   - Sortable applicant table with columns: Applicant, University, Position, Submitted, Status, GPA, Clinical hours, Grad yr, Actions
   - Sub-tabs or toggles for: Applicants table | Kanban Board | Response Analytics
   - Bulk select, Email selected, Interview invite
   - Status pills (total, new, reviewing, interview, accepted, rejected)

4. Redirect: If /applications exists, redirect it to /positions (or /positions?tab=applicants).

5. Links: Update any "All applications" links to point to Positions with the All Applicants tab (e.g. /positions?tab=applicants).
```

---

## Super-admin (clinicalhours.org@gmail.com)

The email `clinicalhours.org@gmail.com` is a super-admin: full read/write access to every clinic's dashboard and data.

- **Access**: When logged in as this email, the user bypasses normal admin checks and can view/edit any clinic.
- **Clinic switcher**: In the hospital dashboard top bar, super-admin sees a dropdown next to the clinic name to switch between all clinics. Badge shows "Super Admin" instead of "Admin".
- **Routes**: Works on both `/hospital-dashboard` (uses `?page=ID` to pick clinic) and `/hospital/:id` (direct link).
- **Implementation**: `src/lib/constants.ts` defines `SUPER_ADMIN_EMAIL` and `isSuperAdmin()`. RLS policies in migration `20260323240000_super_admin_rls.sql` extend hospital-admin policies with `OR public.is_super_admin()`.

When refining the dashboard in Lovable, preserve the super-admin behavior: allow this email to access any clinic, show the clinic switcher when `isSuperAdmin` is true, and ensure RLS still includes the super-admin bypass.

---

## Hospital notification log (apply migration + verify)

A new feature was added: every time a student submits an application, the `submit-position-application` edge function emails the hospital admin via Resend **and** logs the attempt to a new `admin_notification_log` table. Site admins can view this log under **Admin → Hospitals → Notifications**.

### What to do in Lovable

1. **Run the migration** — apply `supabase/migrations/20260411000000_admin_notification_log.sql` via the Supabase dashboard (SQL editor) or `supabase db push`. This creates the `admin_notification_log` table with RLS.

2. **Deploy the edge function** — `supabase/functions/submit-position-application/index.ts` now inserts a row into `admin_notification_log` after each Resend call. Redeploy via `supabase functions deploy submit-position-application`.

3. **The UI is already wired** — `src/components/admin/AdminHospitalsTab.tsx` has a third "Notifications" tab (`HospitalNotificationsSection`) that queries and paginates `admin_notification_log`. No UI changes needed.

4. **Verify** — After deploying, submit a test application. The Notifications tab should show a row with status `sent` (or `failed` if Resend is misconfigured).

### Schema reference

```sql
admin_notification_log (
  id            UUID PRIMARY KEY,
  sent_at       TIMESTAMPTZ,
  hospital_name TEXT,
  hospital_page_id UUID,   -- FK → hospital_pages(id)
  admin_email   TEXT,
  applicant_name  TEXT,
  applicant_email TEXT,
  position_title  TEXT,
  status        TEXT       -- 'sent' | 'failed'
)
```

---

## Repo-specific note for developers

After pulling this repository, apply pending Supabase migrations (including `20260323230000_student_interview_confirmed_legacy_page_admin_update.sql`, `20260323240000_super_admin_rls.sql`, and `20260411000000_admin_notification_log.sql`) so `student_applications.interview_confirmed_at`, legacy hospital-page admin update policy, super-admin RLS, and the notification log table exist in production.

## Calendly webhook (optional)

To auto-sync student-chosen interview times from Calendly into the dashboard, see **[docs/LOVABLE_CALENDLY_WEBHOOK_PROMPT.md](docs/LOVABLE_CALENDLY_WEBHOOK_PROMPT.md)** for a full Lovable prompt covering the Edge Function, database, and setup.
