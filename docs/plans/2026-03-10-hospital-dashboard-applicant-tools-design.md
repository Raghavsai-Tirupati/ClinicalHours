# Hospital Dashboard: Remove Student Features, Applicant Sorting & Tools Bar

**Date:** 2026-03-10

## Summary

- Remove student-oriented features from the hospital context (navigation)
- Add applicant sorting UI/UX with backend structure (sorting logic deferred)
- Add extensible applicant tools bar for future features (bulk actions, export, etc.)

---

## 1. Remove Student Features from Hospital Context

**Problem:** Hospital members see the same nav as students: Dashboard, Opportunities, Tools (Hour Tracker, AMCAS, etc.). These are student-focused and irrelevant to hospital admins.

**Approach:** When the user is a hospital member **and** they are on a hospital route (`/hospital-dashboard`, `/opportunities/:slug/admin`), show a **hospital-specific nav**:

- **Links:** Home, Map, Contact, Hospital Admin (no Dashboard, no Opportunities, no Tools dropdown)
- **Profile** / **Sign up** as before
- **Theme toggle** as before

**Implementation:** In `Navigation.tsx`, add:

```ts
const isHospitalContext = hospitalMember && (
  location.pathname === '/hospital-dashboard' ||
  location.pathname.startsWith('/opportunities/') && location.pathname.endsWith('/admin')
);

const links = (user || isGuest)
  ? (isHospitalContext ? hospitalLinks : authenticatedLinks)
  : publicLinks;

const hospitalLinks = [
  { name: "Home", path: "/" },
  { name: "Map", path: "/map" },
  { name: "Contact", path: "/contact" },
  { name: "Hospital Admin", path: "/hospital-dashboard" },
];
```

Do not render the Tools dropdown when `isHospitalContext` is true.

---

## 2. Applicant Sorting — UI/UX + Backend Structure

**Current:** Client-side sort in `useMemo` (student_name, created_at, status, gpa). Works but not extensible for server-side ranking later.

**Design:**

### UI/UX
- Replace inline sort buttons with a clear **Sort** control:
  - **Select** or **DropdownMenu** for sort field: Name, Date Applied, Status, GPA
  - **Toggle** or chevron for direction (asc/desc)
- Show current sort state (e.g. "Sorted by Date Applied ↓")
- Sort controls live in the same toolbar row as Search and Status filters

### Backend Structure
- Add `hospital_list_applications` RPC (or equivalent service pattern) that accepts:
  - `hospital_id` (or `account_id`)
  - `sort_by`: `student_name` | `created_at` | `status` | `gpa`
  - `sort_dir`: `asc` | `desc`
  - Optional: `status_filter`, `search` (for future use)
- For now, the RPC can be a thin wrapper that passes `order()` to the Supabase query.
- Frontend calls this RPC instead of raw `applications` select when we wire it up. Initially we keep client-side sort but the **state shape and API surface** (sortKey, sortDir) stay aligned so we can switch to server-side later without UI changes.

**Phase 1 (this PR):** Improve sort UI, keep client-side sort. Introduce a `useHospitalApplications` hook or similar that accepts `sortBy`, `sortDir` and returns data — the hook can use client-side sort now, RPC later.

**Phase 2 (later):** Implement RPC, switch hook to server-side fetch.

---

## 3. Applicant Tools Bar (Extensible)

**Goal:** Prepare a toolbar area for future hospital tools (bulk actions, export, filters, etc.).

**Design:**
- Add an **Applicant Tools** bar above the applications table:
  - Left: existing Search + Status filters + Sort control
  - Right: **Actions** area with placeholder buttons (disabled or minimal) for:
    - "Bulk actions" (future)
    - "Export" (future)
- Use a `HospitalApplicantTools` component or a clear section so new tools can be added without refactoring.

---

## 4. Implementation Checklist

1. **Navigation**
   - Add `isHospitalContext` and `hospitalLinks`
   - Hide Tools dropdown when `isHospitalContext`
   - Use `hospitalLinks` instead of `authenticatedLinks` when `isHospitalContext`

2. **Hospital Dashboard — Sort UI**
   - Replace header click-to-sort with a Sort dropdown/select
   - Show "Sort by X ↑/↓" in the toolbar

3. **Hospital Dashboard — Tools Bar**
   - Add right-side actions area with disabled/placeholder buttons (Bulk actions, Export)
   - Structure for easy addition of new tools

4. **Backend**
   - Add migration for `hospital_list_applications` RPC (optional for this PR; can be stub)
   - Or document the intended RPC signature in a comment / plan for Phase 2

---

## 5. Interview Scheduling Feature

**Flow:**
1. Hospital marks applicant as "Under Review" (or "Accepted") and clicks **Request interview times**
2. Student sees "Interview requested" on `/my-applications` and submits preferred time slots
3. Hospital sees student's slots in the application detail drawer and can **Confirm** one
4. System sets `interview_confirmed_at`; "Send confirmation email" is a placeholder for future email integration

**Schema (migration `20260311030000_interview_scheduling.sql`):**
- `applications.interview_requested_at`, `applications.interview_confirmed_at`
- `application_interview_slots` table: application_id, slot_start, slot_end, preference_rank
- RLS: students read/insert/delete own slots; hospitals read slots
- RPCs: `hospital_request_interview`, `hospital_confirm_interview`

**Pages:**
- `/my-applications` — students view applications, submit time slots when interview requested
- HospitalAdmin drawer — Request interview, view slots, Confirm, Send confirmation (placeholder)

---

## Out of Scope (Future)

- Server-side applicant sorting (RPC implementation)
- Bulk actions, export, or other applicant tools
- Custom ranking logic beyond simple column sort
- Email notification when interview is confirmed (placeholder button ready)
