# Auth Audit Report — 2026-03-06

## Summary

Audited `useAuth.tsx`, `Auth.tsx`, `authCookie.ts`, and `useAdminCheck.ts`. Found 1 real bug, confirmed 3 suspected issues are NOT bugs.

---

## Bugs Found

### BUG-001: Hospital signup insert error silently swallowed
- **File:** `src/pages/Auth.tsx:221-234`
- **Symptom:** If the `hospital_accounts` DB insert fails (e.g. network error, RLS policy block, constraint violation), the user receives "Account created! Please check your email" and is sent to `/check-email` — but no hospital record exists. The user can verify their email, log in, and be redirected to `/dashboard` (student dashboard) instead of `/pending-approval`, with no way to complete hospital registration.
- **Root cause:** The `await supabase.from("hospital_accounts").insert(...)` result was not destructured; errors were never checked.
- **Fix:** Destructure `{ error: hospitalError }` from the insert call. If `hospitalError` is truthy, call `toast.error(...)` and `return` early (before sign-out and email redirect).
- **Status:** Fixed ✓

---

## Non-Issues Confirmed

### CHECK-001: useAuth ghost ready state (isReady=true before user is set)
- **File:** `src/hooks/useAuth.tsx`
- **Finding:** NOT a bug. In all code paths, `setUser()` and `setSession()` are called before `setIsReady(true)`:
  - Cookie restore path: `setSession()` → `setUser()` → `setIsReady(true)` (lines 241-267)
  - Normal init path: `setSession()` → `setUser()` → ... → `finally: setIsReady(true)` (lines 279-341)
  - `onAuthStateChange` listener: `setSession()` → `setUser()` → `setIsReady(true)` inside `setTimeout` (lines 357-360)
- React 18 batches these updates atomically within each `setTimeout` callback.

### CHECK-002: Profiles row missing for new users
- **File:** `src/pages/Auth.tsx`, `supabase/migrations/`
- **Finding:** NOT a bug. A `handle_new_user` trigger on `auth.users` (migration `20251113224544`) automatically inserts a row into `public.profiles` on every new user creation. The `Auth.tsx` code correctly uses `.update()` (not `.insert()`), relying on this trigger.

### CHECK-003: Redirect logic for hospital accounts
- **File:** `src/pages/Auth.tsx`, `src/pages/PendingApproval.tsx`
- **Finding:** Correct. `redirectByAccountType()` sends any non-approved hospital to `/pending-approval`. The `PendingApproval` page handles both `pending` and `rejected` statuses (shows rejection reason + admin note when `account_status === "rejected"`).
