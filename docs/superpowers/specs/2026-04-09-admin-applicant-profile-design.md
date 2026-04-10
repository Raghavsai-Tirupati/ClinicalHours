# Admin Applicant Profile Redesign — Design Spec
**Date:** 2026-04-09  
**Target file:** `src/components/admin/AdminUserProfile.tsx`  
**Entry point:** `src/components/admin/AdminUserList.tsx` (no changes needed there)

---

## Overview

Redesign the super-admin user profile modal to:
1. Show a card header matching the hand-drawn sketch (Last, First name / contact info / avatar / tabs).
2. Key profiles by email — an Applications tab lists every `student_application` row for this person across all hospitals/positions, not just aggregate counts.
3. Replace the 4-tab layout with a 9-tab layout that mirrors the sections in the hospital-admin `ApplicantProfilePage`.

---

## Scope

**In scope:** `AdminUserProfile.tsx` only.  
**Out of scope:** `ApplicantProfilePage.tsx` (hospital-admin view), routing, `AdminUserList.tsx`.

---

## 1. Card Header Layout

```
┌─────────────────────────────────────────────────────┐
│  Kanodia, Shivam                    ┌────────────┐  │
│                                     │     K      │  │  ← avatar, color from email hash
│  ┌───────────────────────┐          └────────────┘  │
│  │ Contact Info          │                          │
│  │ shivam@example.com    │                          │
│  │ (214) 470-0598        │                          │
│  │ College Station, TX   │                          │
│  │ [LinkedIn ↗]          │                          │
│  │ ✓ Email Verified      │                          │
│  └───────────────────────┘                          │
├─────────────────────────────────────────────────────┤
│ Applications │ Responses │ Notes │ Documents │ ...  │  ← scrolls horizontally
└─────────────────────────────────────────────────────┘
```

### Name formatting
Split `full_name` on the last space to produce `Last, First`:
```ts
function formatLastFirst(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}
```

### Avatar
- 56×56px `rounded-full` div
- Background color: deterministic hash of email → one of 8 Tailwind color classes
- Letter: uppercased first character of `full_name`

```ts
function emailToColor(email: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
  ];
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
```

### Contact block (left ~60%)
- Email
- Phone (if present)
- City + State (if present)
- LinkedIn link with icon (if present)
- Email-verified badge

### Avatar block (right ~40%, flex-end aligned)
- Avatar circle only

---

## 2. Tab Layout

`TabsList` uses `overflow-x-auto flex-nowrap` so tabs scroll horizontally rather than wrap on narrow dialogs.

| # | Tab label | `value` key | Data source |
|---|-----------|-------------|-------------|
| 1 | Applications | `applications` | `student_applications` by `student_id` |
| 2 | Responses | `responses` | `application_answers` joined via applications |
| 3 | Notes | `notes` | `application_notes` joined via applications |
| 4 | Documents | `documents` | `application_documents` joined via applications |
| 5 | Availability | `availability` | `availability_json` from each application |
| 6 | Interview | `interview` | `interview_invited_at`, `interview_confirmed_at` per application |
| 7 | Contact History | `contact-history` | `email_send_logs` by `student_id` or email |
| 8 | Profile | `profile` | `profiles` table (existing content, unchanged) |
| 9 | Activity | `activity` | Platform stats + saved opps + hours log (existing content, collapsed) |

Default tab: `applications`.

---

## 3. Tab Content Specifications

### 3.1 Applications tab
```
| Hospital / Position      | Status        | Submitted   | Reviewed  |
|--------------------------|---------------|-------------|-----------|
| BCS Free Clinic / Nurse  | [New]         | Apr 9 2026  | —         |
| Austin Free Clinic / PA  | [Accepted]    | Mar 1 2026  | Mar 5     |
```
- Status badge reuses existing `STATUS_COLORS` map from `src/types/positions.ts`
- Sorted by `submitted_at` descending
- Empty state: `FileText` icon + "No applications yet"
- Query:
  ```ts
  supabase
    .from('student_applications')
    .select(`
      id, status, submitted_at, reviewed_at,
      position:hospital_positions(
        title,
        opportunity:opportunities(name)
      )
    `)
    .eq('student_id', userId)
    .order('submitted_at', { ascending: false })
  ```

### 3.2 Responses tab
Group by application. Each group shows a heading (`position.title @ opportunity.name`) then each question/answer pair.
- Query: `application_answers` joined through `application_id` from the fetched application IDs
- Empty state: "No application responses on record"

### 3.3 Notes tab
Group by application (same heading pattern). Each note shows date + content.
- Query: `application_notes` filtered to the set of application IDs
- Empty state: "No admin notes on record"

### 3.4 Documents tab
Flat list across all applications, showing filename, type badge, application label, upload date, and a link.
- Query: `application_documents` filtered to the set of application IDs
- Empty state: "No documents uploaded"

### 3.5 Availability tab
One block per application showing the `availability_json` fields (days, time preference, hours/week, commitment).
- Data source: `availability_json` field already present on each row returned by the Applications query — no additional fetch needed.
- Empty state: "No availability data"

### 3.6 Interview tab
One row per application showing `interview_invited_at` and `interview_confirmed_at`.
- Data source: already present on each row returned by the Applications query — no additional fetch needed.
- Empty state: "No interview records"

### 3.7 Contact History tab
Flat list of all emails sent to this student (across all hospitals), showing subject, clinic, date.
- `email_send_logs.recipient_emails` is a `string[]` column. Query:
  ```ts
  supabase
    .from('email_send_logs')
    .select('id, subject, template_name, sent_by, created_at, clinic_id')
    .contains('recipient_emails', [user.email])
    .order('created_at', { ascending: false })
  ```
- Empty state: "No emails sent yet"

### 3.8 Profile tab
Unchanged from current implementation — contact details, education, clinical experience, bio, career goals, research experience.

### 3.9 Activity tab
Merges current Activity + Opportunities + Hours Log tabs into one scrollable tab. Content order: Key Stats → Application Pipeline → Engagement → Account Activity → Saved Opportunities → Hours Log → Recent Reviews.

---

## 4. Data Loading

New data fetched alongside existing `fetchUserData()`:
- Application IDs (fetched first, then used as FK filter for dependent queries)
- `application_answers`, `application_notes`, `application_documents` (batch-fetched by application IDs via `.in('application_id', appIds)`)
- `email_send_logs` (by email)

All fetches happen in a single `fetchUserData()` call using `Promise.all` for parallelism.

New state variables:
```ts
const [applications, setApplications] = useState<ApplicationRow[]>([]);
const [responses, setResponses] = useState<AnswerRow[]>([]);
const [notes, setNotes] = useState<NoteRow[]>([]);
const [documents, setDocuments] = useState<DocumentRow[]>([]);
const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
```

---

## 5. What Does Not Change

- `AdminUserList.tsx` — no changes
- The `Dialog` wrapper and `open`/`onOpenChange` props
- The `admin-get-user-profile` edge function call (still used for fullProfile + activity data)
- Existing Profile and Activity tab content
- Status badge colors (`STATUS_COLORS` imported or duplicated locally)

---

## 6. Error Handling

- Any individual tab query failure shows an inline error message within that tab only; other tabs remain functional
- Tabs with no data show empty states (not errors)

---

## 7. Out-of-Scope Assumptions

- No write actions (notes, status changes) in the super-admin modal — read-only
- No pagination within any tab — super-admin users unlikely to have >50 records per category
- No deeplink to a specific tab — dialog always opens on Applications tab
