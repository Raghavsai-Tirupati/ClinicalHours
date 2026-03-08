# Design: Auth Audit, Flash Fix, Onboarding, Admin Live Activity

**Date:** 2026-03-06
**Status:** Approved

---

## Task 1 — Auth + Hospital Signup Audit

### Problem
- `useAuth` (427 lines) has potential race conditions between cookie restore and `isReady` flag
- Hospital signup: `hospital_accounts` insert has no rollback if it fails after auth succeeds
- RLS may silently block authenticated users if `profiles` row doesn't exist yet on first login
- Redirect logic after hospital signup needs verification

### Approach
1. Trace full flow: `signUp()` → cookie exchange → `onAuthStateChange` → `isReady=true` → redirect
2. Audit hospital insert error handling — add try/catch with user-facing error state
3. Check RLS policies on `profiles`, `saved_opportunities` for new users
4. Audit redirect logic: hospital → `/pending-approval`, student → `/dashboard`
5. Document every bug found with file + line number

### Success Criteria
- Full auth flow works end-to-end without silent failures
- Hospital signup shows proper error if DB insert fails
- New users always have a `profiles` row before any query runs
- All redirects lead to correct destinations

---

## Task 2 — Flash Fix (Tracking State)

### Problem
Components render immediately with default empty/false state before Supabase queries resolve. This causes "Save" buttons, tracking indicators, and enrollment badges to flash the wrong state on load.

### Root Cause
`useAuth.isReady` exists but components that read `saved_opportunities` don't gate their render on it. React Query queries start before auth is confirmed, returning empty data that renders as "not tracked."

### Fix Approach
1. Find every component reading `saved_opportunities` or tracking state from Supabase
2. Gate render behind `isReady && !isLoading` — render skeleton until both are true
3. Add skeleton placeholders (pulsing bars) for tracking buttons/badges
4. Use React Query's `enabled: isReady` option so queries don't fire until auth resolves

### Success Criteria
- No flash of wrong tracking state on page load
- Skeletons display during loading, then snap to correct state
- Works for both authenticated and guest users

---

## Task 3 — User Onboarding System

### Existing Context
- `onboarding_complete: boolean | null` already in `profiles` table
- Existing `OnboardingTutorial.tsx` is a tooltip tour (feature highlights) — NOT a data-collection flow
- Keep existing tutorial as optional step after the new flow

### New Component: `OnboardingFlow`

#### Trigger
- On login: if `profiles.onboarding_complete` is `null` or `false`
- Show as full-screen modal overlay (not a route change)
- Skippable at any step; re-accessible from `/settings`

#### Steps (Student path)
1. **Welcome + Role** — "I'm a Student" / "I represent a Clinical Site"
   - Hospital selection → redirects to hospital signup flow, exits onboarding
2. **Your Info** — University, Major, Graduation Year (pre-fills profile)
3. **First Action** — "Browse Opportunities" / "Complete My Profile"
   - Routes to chosen destination on completion

#### Completion
- `UPDATE profiles SET onboarding_complete = true`
- Route to `/dashboard` or user's chosen first action

#### UI Design
- Full-screen overlay with centered card (max-w-lg)
- Step progress: numbered dots at top
- Back/Next/Skip buttons
- shadcn `Dialog` or custom overlay
- Smooth slide transitions between steps
- Accessible: focus trap, ESC to skip

#### Empty State Guarantee
Every screen new users land on after onboarding must show:
- Instructional text explaining what to do
- A suggested action CTA
- OR placeholder UI (never blank)

---

## Task 4 — Admin Live Activity Dashboard

### Location
New "Activity" tab (6th tab) added to existing `AdminDashboard.tsx`. Does not replace any existing tabs.

### Component: `AdminActivityTab`

#### Live Event Feed (left panel)
- Supabase Realtime `channel.on('postgres_changes', ...)` on:
  - `profiles` (new signups, profile updates)
  - `hospital_accounts` (new registrations, status changes)
  - `saved_opportunities` (saves/unsaves)
  - `experience_entries` (hour logs)
- Events appear at top within 1-2 seconds
- Each row: timestamp, user avatar + name, action type badge, affected record summary
- Auto-scroll to top on new events; "Pause" button to stop auto-scroll
- Max 200 events in memory (oldest trimmed)

#### User Activity View (right panel / drawer)
- Click any event → filter by that user
- Shows full activity history for selected user:
  - Account created, profile updates, logins
  - Opportunities saved/unsaved
  - Applications submitted
  - Hours logged
- Sortable columns, pagination (25/page), search

#### UI Design
- Dark, data-dense — matches Vercel/Linear aesthetic
- Uses existing shadcn dark theme
- Tables with sortable headers (`@tanstack/react-table` already in stack)
- Color-coded action badges: green (create), blue (update), red (delete)
- Timestamp: relative ("2s ago") with absolute on hover

### Success Criteria
- New signups appear in feed within 2 seconds
- Feed updates without page refresh
- User filter shows complete history
- Tables are sortable and paginated

---

## Tech Stack Constraints
- React 18 + Vite + TypeScript
- Supabase (Auth, Realtime, DB)
- shadcn/ui + Tailwind CSS
- React Query (TanStack) for data fetching
- React Router for routing
