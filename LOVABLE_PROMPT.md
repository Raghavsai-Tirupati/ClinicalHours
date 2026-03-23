# Lovable implementation handoff — Hospital admin dashboard

Use this prompt in Lovable to align UI/UX and behavior with the ClinicalHours hospital admin experience. The React app in this repo is the source of truth for flows; mirror these patterns and copy where helpful.

---

## Copy-paste prompt for Lovable

```
Build or refine a hospital/clinic admin dashboard with these requirements:

### Navigation (sidebar)
- Items: Overview, Applications, Positions (badge = active position count), Interviews, Email, Activity, New Position, Settings, Log Out.
- Route `/applications` (or `{basePath}/applications`) must expose the full applicant workspace: advanced filters (multi-rule filter bar: status, position, custom application questions, presets), sortable table, kanban, and response analytics — not only inside a single position.

### Positions
- List/kanban of positions by status (draft, active, paused, closed, archived).
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
  - Open position → link to position detail when `position_id` is a real hospital position; else link to All applications.
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

## Repo-specific note for developers

After pulling this repository, apply pending Supabase migrations (including `20260323230000_student_interview_confirmed_legacy_page_admin_update.sql`) so `student_applications.interview_confirmed_at` and legacy hospital-page admin update policy exist in production.
