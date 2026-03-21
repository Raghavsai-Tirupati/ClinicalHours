# Admin Dashboard Funnel Snapshot — Design

**Date:** 2026-03-18  
**Area:** Admin Dashboard (`/admin`)  
**Goal:** Give admins a simple, reliable view of how many people hit the landing page, how many start a guest session, and how many actually sign up, without bloating the UI.

---

## Overview

Add a compact **“Funnel snapshot”** row to the top of the admin Overview tab that shows, for **today**:

- **Landing Visitors (A)** — unique sessions that start on the landing page
- **Guest Sessions Started (B)** — unique guest sessions created today
- **New Signups (C)** — unique users who signed up today

These metrics all derive from existing tracking data:

- `tracking_events` (page views, signup events)
- `guest_sessions` (anonymous exploration sessions)

The rest of the admin UI and existing stats remain unchanged.

---

## Metric Definitions

All metrics are evaluated in **UTC “today”** (from start of day to now) unless the implementation later adds a time-range toggle.

### 1. Landing Visitors (Today)

**Question:** How many distinct sessions began on the marketing landing page today, regardless of what they did next?

**Definition:**

- Source: `tracking_events`
- Filter:
  - `event_type = 'page_view'`
  - `page_url = '/'` (Home route)
  - `created_at >= start_of_today`
- Group by `session_id` (ignore `null` session IDs)
- **Landing visitors today** = count of distinct `session_id` in this filtered set

This counts any first touch on `/` for a session as a landing, even if the session later navigates into the app or logs in.

### 2. Guest Sessions Started (Today)

**Question:** How many distinct guest exploration sessions began today?

**Definition (preferred):**

- Source: `guest_sessions`
- Filter:
  - `created_at >= start_of_today`
- **Guest sessions today** = count of distinct `session_id`

Rationale: `guest_sessions` is already the canonical store for guest-mode usage (see PRD “Guest Discovery” + existing `GuestSessionsTab`).

If `guest_sessions` is ever unavailable, a fallback is:

- Use `tracking_events` where:
  - `event_type = 'page_view'`
  - `metadata.action = 'guest_mode_entered'`
  - `created_at >= start_of_today`
- Distinct `session_id` as the count.

### 3. New Signups (Today)

**Question:** How many distinct users signed up today, regardless of coming from guest mode or directly?

**Definition:**

- Source: `tracking_events`
- Filter:
  - `event_type = 'signup'`
  - `created_at >= start_of_today`
- Group by `user_id` (ignore `null`)
- **New signups today** = count of distinct `user_id`

This stays aligned with existing tracking patterns used by `AdminActivityTab` and `GuestSessionsTab`.

---

## UI Changes (AdminOverviewTab)

### Placement

In `AdminOverviewTab`:

1. **Above** the existing 8-card stats grid, add a new 3-card row:
   - “Landing visitors (today)”
   - “Guest sessions started (today)”
   - “New signups (today)”
2. Keep the existing cards (students, hospitals, hours, etc.) exactly as they are, just visually below the funnel snapshot.
3. Keep the existing **Refresh** button, and have it refresh both overview stats and funnel metrics together.

### Visual Design

- Use the existing `Card` + `CardContent` pattern used for other stats.
- Icons (from `lucide-react`), e.g.:
  - `Globe` or `Monitor` for Landing visitors
  - `Ghost` for Guest sessions
  - `UserPlus` for New signups
- Each card:
  - Large primary value (e.g. `123`)
  - Small label text: e.g. `Landing visitors (today)`
  - No sublabels for now to keep it minimal.

---

## Data Flow & Implementation Notes

### Location

All logic for these three metrics lives in `AdminOverviewTab.tsx` for now:

- It already issues multiple parallel Supabase queries for counts.
- We will extend that `fetchStats` function to also:
  - Compute `startOfToday` in JS.
  - Query `tracking_events` + `guest_sessions`.
  - Deduplicate in memory for distinct counts.

If these queries become heavy, they can be extracted into a dedicated helper or edge function later.

### Query Strategy

Because Supabase JS client does not support a simple *distinct count* with `head: true` and no rows, we:

- Fetch the minimal columns needed (`session_id`, `user_id`, `created_at`, `page_url`, `event_type`).
- Deduplicate client-side using `Set`:

```ts
const uniqueSessions = new Set<string>();
landingEvents?.forEach((row) => {
  if (row.session_id) uniqueSessions.add(row.session_id);
});
const landingVisitorsToday = uniqueSessions.size;
```

Given the expected traffic for ClinicalHours, this is acceptable for “today” windows.

### Error Handling

- If any of the funnel queries fail, we:
  - Log the error to console.
  - Fallback each metric to `0` rather than blocking the whole Overview.
- Existing overview stats behavior is unchanged.

---

## Success Criteria

- The Overview tab shows **three new cards** at the top with:
  - Landing visitors (today)
  - Guest sessions started (today)
  - New signups (today)
- Numbers are consistent with:
  - `GuestSessionsTab` counts for today’s sessions.
  - `tracking_events` entries for `event_type = 'signup'`.
- Clicking **Refresh** updates both the funnel metrics and the existing stats.
- No new admin routes or tabs are introduced; the UI remains simple and focused.

