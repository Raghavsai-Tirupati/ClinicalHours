# Admin Dashboard + Hospital Verification System — Design Doc

**Date:** 2026-02-24
**Project:** clinicalhours.org
**Stack:** React/TypeScript, Supabase (Postgres + Edge Functions), Resend (email), Vite

---

## Overview

Three-part feature: (1) hospital account verification flow, (2) separate post-login experiences for hospital vs regular users, (3) redesigned admin dashboard. A significant portion of Parts 1 and 2 is already implemented.

---

## Part 1 — Hospital Verification Flow

### What's Already Built (No Changes Needed)

| Item | Location | Status |
|------|----------|--------|
| `hospital_accounts` table | `supabase/migrations/20260223_hospital_accounts.sql` | ✅ Done |
| `account_status` field (`pending/approved/rejected`) | Same migration | ✅ Done |
| RLS policies (users see own, admins see all, admins can update) | Same migration | ✅ Done |
| Hospital signup UI + `hospital_accounts` record creation | `src/pages/Auth.tsx` | ✅ Done |
| Login redirect to `/hospital-dashboard` or `/pending-approval` | `src/pages/Auth.tsx` → `redirectByAccountType()` | ✅ Done |
| `HospitalDashboard.tsx` — approved hospital view | `src/pages/HospitalDashboard.tsx` | ✅ Done |
| `PendingApproval.tsx` — pending/rejected screen | `src/pages/PendingApproval.tsx` | ✅ Done |
| `useHospitalAccount` hook | `src/hooks/useHospitalAccount.ts` | ✅ Done |
| `hospital` role in `app_role` enum | `supabase/migrations/20260223180000_add_hospital_role.sql` | ✅ Done |

### What's Missing

**New edge function: `hospital-review`**

```
POST /functions/v1/hospital-review
Auth: Bearer JWT (admin required)
Body: { hospitalId: string, action: "approve" | "reject", note?: string }
```

- Validates admin role via `checkAdminRole` from `_shared/auth.ts`
- Updates `hospital_accounts` set `account_status = action`, `reviewed_at = now()`, `reviewed_by = adminUserId`, `admin_note = note`
- Fetches hospital's `contact_email` and `hospital_name`
- Sends transactional email via Resend:
  - **Approve:** "Your ClinicalHours hospital account has been approved"
  - **Reject:** "Your ClinicalHours hospital account was not approved" + admin note (if provided)
- Returns `{ success: true }`

---

## Part 2 — Separate Account Experiences

**Already fully implemented.** No work required:
- Hospital accounts → `/hospital-dashboard` (posted opportunities + application counts)
- Regular accounts → `/dashboard`
- Pending/rejected hospitals → `/pending-approval`
- Route gating in `HospitalDashboard.tsx` checks `account_status === 'approved'`

---

## Part 3 — Admin Dashboard Redesign

### Architecture Decision

**Option A selected:** Single unified dashboard at `/admin` with 5 top-level tabs.

### Tab Structure

```
/admin
  ├── Overview          (new — platform health stats)
  ├── Students          (existing AdminUserList, renamed)
  ├── Hospitals         (new — approved hospital table)
  ├── Pending Approvals (new — approval queue with badge)
  └── Tools             (existing — email/import/data-quality/maintenance)
```

### Component Architecture

**Refactored shell:** `src/pages/AdminDashboard.tsx` becomes a thin tab router.

**New components:**
```
src/components/admin/
  AdminOverviewTab.tsx          ← new
  AdminHospitalsTab.tsx         ← new
  AdminPendingApprovalsTab.tsx  ← new
  AdminToolsTab.tsx             ← moves existing email/import/data-quality/maintenance JSX
```

**Unchanged components:**
```
src/components/admin/
  AdminUserList.tsx       ← reused as Students tab content
  AdminUserProfile.tsx    ← unchanged
  GuestSessionStats.tsx   ← reused inside AdminOverviewTab
```

---

### Overview Tab

Stats queried directly from Supabase (admin RLS allows it):

| Stat | Source |
|------|--------|
| Total students | `profiles` count |
| Approved hospitals | `hospital_accounts` count where `account_status = 'approved'` |
| Pending hospitals | `hospital_accounts` count where `account_status = 'pending'` |
| Rejected hospitals | `hospital_accounts` count where `account_status = 'rejected'` |
| Total opportunities | `opportunities` count |
| Total applications | `applications` count |
| Total clinical hours logged | `experience_entries` sum of `hours` |
| Active users (7d / 30d) | `tracking_events` count distinct `user_id` where `created_at > now() - interval` |

Layout: 2-row stats grid (4 cards top, 4 cards bottom) → `GuestSessionStats` chart below.

---

### Students Tab

Reuses `AdminUserList` as-is. No changes.

---

### Hospitals Tab

New table for **approved** hospital accounts.

**Columns:** Hospital Name · Contact Email · Registered · Approved Date · Opportunities Posted · Total Applicants · Last Active · Actions

**Data source:** Direct Supabase query on `hospital_accounts` (admin RLS policy already exists). Join opportunity count and application count client-side or via a lightweight edge function `admin-get-hospitals` (same pattern as `admin-get-users`).

**Row click:** Opens a `Sheet` (right-side drawer) showing:
- Hospital details (name, email, phone, website, address, description)
- Table of their posted `opportunities` (query `opportunities` where `created_by = hospital.user_id`)

**Table features:** Search by name/email, pagination (20/page), sort by name / date / opportunities count.

---

### Pending Approvals Tab

**Queue section:** Lists all `hospital_accounts` where `account_status = 'pending'`, ordered by `created_at ASC`.

Each row shows:
- Hospital name, contact email, submitted date
- Website (linked), description (truncated)
- **Approve** button (green) → calls `hospital-review` with `action: "approve"`, optimistically removes from queue, shows toast
- **Reject** button (red) → opens `AlertDialog` with optional `Textarea` for note → calls `hospital-review` with `action: "reject"` + note

**History section:** Collapsible, shows past approved/rejected hospitals with `reviewed_at` timestamp, final status badge, and `admin_note` (if any).

**Badge:** Tab trigger shows pending count badge. Polls every 60s via `setInterval` + Supabase query.

---

### Tools Tab

Moves existing content verbatim from `AdminDashboard.tsx`:
- Mass Email section
- CSV Import section
- Fix Missing States section
- Find Missing Links section
- Fix Missing Coordinates section
- Remove Duplicates section

No functional changes.

---

## Route

Route stays at `/admin` (no change). The spec mentions `/admin/dashboard` but changing it would break existing bookmarks and navigation links with no benefit.

---

## Database

No new migrations needed. All required tables exist:
- `hospital_accounts` — approval flow
- `profiles` — student stats
- `opportunities` — opportunity counts
- `applications` — application counts
- `experience_entries` — hours logged
- `tracking_events` — active user counts
- `user_roles` — admin auth

---

## Email Templates (Resend)

Two transactional emails sent from `hospital-review` edge function:

**Approve email:**
- Subject: "Your ClinicalHours Hospital Account Has Been Approved"
- Body: Welcome message, link to `/hospital-dashboard`

**Reject email:**
- Subject: "Update on Your ClinicalHours Hospital Account Application"
- Body: Polite rejection, admin note if provided, support contact `support@clinicalhours.org`

---

## Success Criteria

- [ ] Admin sees pending hospital signups with approve/reject controls
- [ ] Approving sends email + grants hospital access immediately
- [ ] Rejecting sends email with note + hospital sees rejection reason
- [ ] Hospitals land on `/hospital-dashboard` after login (already works)
- [ ] Admin Overview shows live platform stats
- [ ] Hospitals tab lists all approved hospitals with activity data
- [ ] All existing admin tools remain accessible under Tools tab
- [ ] Route stays at `/admin`, admin-only gating unchanged
