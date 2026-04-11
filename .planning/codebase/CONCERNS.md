# Codebase Concerns

**Analysis Date:** 2026-04-11

## Tech Debt

**Type Safety - Extensive Use of `any` Type:**
- Issue: 68+ instances of `as any` or `: any` type assertions bypass TypeScript safety
- Files: Scattered across `src/components/`, `src/hooks/`, `src/lib/`
- Impact: Runtime errors not caught at compile time; refactoring becomes dangerous; team loses type safety benefits
- Fix approach: Systematically replace `any` with proper types. Start with frequently-changed files like `src/components/admin/` (1156 lines) and `src/services/`. Use type inference or explicit interfaces from `src/types/`.

**Logging Disabled in Production:**
- Issue: Error logger only outputs in development mode via console; production errors are silent
- Files: `src/lib/logger.ts` (lines 6-13), referenced from `src/services/opportunities.ts` and throughout codebase
- Impact: Production bugs go undetected; no observability into user-facing errors; customers can't report issues with context
- Fix approach: Integrate error tracking service (e.g., Sentry). Uncomment and configure the Sentry capture blocks already in place but commented out.

**No Centralized Error Handling:**
- Issue: Error handling spread across components with inconsistent patterns. Some components use `.catch(() => {})` silently, others throw
- Files: `src/App.tsx` (chunk reload retry), `src/hooks/useAuth.tsx` (multiple catch blocks with swallow-on-error), `src/components/DashboardVideoCarousel.tsx`, `src/components/HeroVideoCarousel.tsx`
- Impact: Errors hidden from user and developers; difficult to debug issues; poor user experience
- Fix approach: Create standardized error handling utilities in `src/lib/errorUtils.ts`. Use error boundaries consistently.

**Unverified Type Coercions:**
- Issue: Several files use untyped data mapping where shape isn't guaranteed to match expectations
- Files: `src/components/admin/AdminUserProfile.tsx` (line 237: `(data as any).logo_url`)
- Impact: If database schema changes, silent data loss occurs
- Fix approach: Use Zod or similar validation library to parse API responses before mapping

## Known Bugs

**CSRF Token State Management:**
- Symptoms: In-memory CSRF token (`csrfToken` variable at module scope in `src/hooks/useAuth.tsx` line 12) can desync from server; retry logic in `src/lib/api/interceptor.ts` tries to recover but may fail if token rotated
- Files: `src/hooks/useAuth.tsx` (line 12: `let csrfToken`), `src/lib/api/interceptor.ts` (lines 63-76, 117-126)
- Trigger: Token refresh happens on auth state change, but if multiple simultaneous requests occur or token expires between check and use, requests fail
- Workaround: Requests retry once automatically; users may need to refresh page if repeated 403 errors occur

**Session Timeout Checker Has Race Condition:**
- Symptoms: Session timeout check runs every 60 seconds but uses closure-captured state that may be stale
- Files: `src/hooks/useAuth.tsx` (lines 224-229: interval check calls `checkSessionTimeout()` which reads from `lastActivityRef` but state could have changed)
- Trigger: Rapid user activity followed by 60-second inactivity window; timeout may fire even if user was just active
- Workaround: Activity timer reset prevents most timeout issues; mainly affects edge case of exactly 30 min inactivity with async check

**Promise.all() Missing Error Handling:**
- Symptoms: Multiple Promise.all() calls don't handle partial failures gracefully
- Files: `src/components/admin/AdminActivityTab.tsx`, `src/components/admin/AdminHospitalsTab.tsx`, `src/components/admin/AdminOverviewTab.tsx`, `src/components/admin/AdminPremiumTab.tsx`
- Trigger: If one of N parallel API calls fails, entire Promise.all() rejects and component may not display partial data
- Workaround: None; users see loading spinner indefinitely or error screen

**Unmanaged Event Listeners in useAuth:**
- Symptoms: Activity event listeners added in `src/hooks/useAuth.tsx` (line 221) registered in capture phase but cleanup may not fire if component unmounts unexpectedly
- Files: `src/hooks/useAuth.tsx` (lines 219-222, cleanup at 418-420)
- Trigger: Browser tab closed, hard refresh, or component error before cleanup runs
- Impact: Listeners remain attached, consuming memory and potentially firing stale callbacks

## Security Considerations

**CSRF Protection Incomplete:**
- Risk: CSRF token stored in memory (`csrfToken` variable); can be lost on page refresh; retry logic depends on token being available
- Files: `src/hooks/useAuth.tsx` (line 12), `src/lib/api/interceptor.ts`
- Current mitigation: httpOnly cookies prevent XSS access to session tokens; token rotated on each auth state change
- Recommendations: (1) Consider using only httpOnly cookies without in-memory token copy. (2) Add CSRF token endpoint cache-busting. (3) Implement SameSite cookie policy verification.

**localStorage Access Without Try-Catch in Certain Paths:**
- Risk: Private browsing mode or quota exceeded can cause localStorage access to throw; some code doesn't guard all access
- Files: `src/hooks/useAuth.tsx` has guards (lines 38-42, 50-57, 65-68, etc.) but other components may not
- Current mitigation: useAuth functions wrap localStorage access in try-catch
- Recommendations: Audit all localStorage usage across codebase; consider utility wrapper that handles quota errors gracefully

**Dependency Injection of CSRF Token:**
- Risk: CSRF token obtained via dynamic import `src/lib/csrf` in multiple places
- Files: `src/hooks/useAuth.tsx` (lines 312, 325, 341), which may be called at different times
- Current mitigation: getCSRFToken() endpoint provides fresh tokens
- Recommendations: Consider pre-loading CSRF token on app init rather than lazy-loading

**Type Safety in Auth State:**
- Risk: `user` and `session` can be null; components may not properly handle null cases
- Files: Scattered across components that use `useAuth()` hook
- Current mitigation: Components using useAuth typically check `if (user)` before rendering
- Recommendations: Create typed wrapper hooks that guarantee non-null state (e.g., `useAuthRequired()` throws if user is null)

## Performance Bottlenecks

**Large Components with No Code Splitting:**
- Problem: `AdminUserProfile.tsx` (1156 lines), `AdminActivityTab.tsx` (1047 lines), `GuestSessionsTab.tsx` (989 lines) are bundled as single chunks
- Files: `src/components/admin/AdminUserProfile.tsx`, `src/components/admin/AdminActivityTab.tsx`, `src/components/admin/GuestSessionsTab.tsx`
- Cause: These are imported via `lazyRetry()` in `src/App.tsx` but contain massive inline templates and state
- Improvement path: Break into sub-components; extract large lists/tables into separate files; use virtualization for long lists (AdminUserProfile renders many tabs)

**Multiple Promise.all() Queries Without Pagination:**
- Problem: Admin dashboard tabs load all data at once via Promise.all()
- Files: `src/components/admin/AdminActivityTab.tsx` (line), `src/components/admin/AdminHospitalsTab.tsx`, `src/components/admin/AdminOverviewTab.tsx`
- Cause: No offset/limit parameters; fetches entire result set
- Improvement path: Implement pagination or lazy-load-on-scroll for admin tables; add `limit` and `offset` query parameters

**No React Query Caching Strategy for Admin Queries:**
- Problem: Admin dashboard makes new queries every time tab is visited even if data is recent
- Files: `src/components/admin/` (all admin tabs), but `@tanstack/react-query` is installed but underutilized
- Cause: Direct supabase queries instead of useQuery hooks with staleTime
- Improvement path: Migrate admin queries to React Query with appropriate staleTime and cacheTime configs

**Session Storage Access in Every Route Change:**
- Problem: Activity tracker checks session timeout every 60 seconds; each check reads from ref and makes async call
- Files: `src/hooks/useAuth.tsx` (line 225-229)
- Cause: Interval runs regardless of activity; checks are synchronous but trigger async validation
- Improvement path: Increase interval to 5+ minutes or switch to activity-triggered timeout checks

## Fragile Areas

**Auth State Initialization Sequence:**
- Files: `src/hooks/useAuth.tsx` (lines 212-423)
- Why fragile: Complex initialization with 4+ async operations (getSession, restoreFromCookie, setSession, exchangeTokenForCookie). Race conditions possible if user navigates away during init. `initializingRef` prevents double-init but does not handle rapid provider remounts.
- Safe modification: Do not change the initialization order without thorough testing. Add integration tests for: (1) Cold start with valid cookie. (2) Cold start without cookie. (3) Session refresh mid-flight. (4) Rapid remounts.
- Test coverage: Only one test file exists: `src/components/admin/__tests__/AdminUserProfile.utils.test.ts` (utility functions only). No tests for useAuth initialization sequence.

**Hotel Session State Synchronization:**
- Files: `src/hooks/useAuth.tsx` (sessionRef.current vs state, lines 182-185)
- Why fragile: `sessionRef` used for closure capture; state-based `session` used for renders; they can desync if setSession doesn't fire reliably
- Safe modification: Always use state, not refs, for data that affects renders. Use ref only for callbacks that need latest value without re-triggering effects.
- Test coverage: No tests for ref/state synchronization

**Guest Session Tracking with localStorage:**
- Files: `src/hooks/useAuth.tsx` (guest session ID generation and storage, lines 26-57)
- Why fragile: localStorage may fail silently; UUID generation is not cryptographically secure (uses Math.random)
- Safe modification: Add explicit error logging if localStorage write fails. Consider using a secure random generator.
- Test coverage: No tests for guest session creation or fallback behavior

**Promise.all() without SettledResult:**
- Files: Multiple admin tabs (`AdminActivityTab.tsx`, `AdminHospitalsTab.tsx`, etc.)
- Why fragile: If one promise in the array rejects, entire Promise.all() throws; component enters error state
- Safe modification: Use `Promise.allSettled()` instead; check results before mapping
- Test coverage: No error case tests for Promise.all() failures

## Scaling Limits

**No Pagination in Admin Queries:**
- Current capacity: Loads all records into memory
- Limit: If hospitals or applications table grows to 10k+ records, page becomes unresponsive
- Scaling path: (1) Add limit/offset parameters to Supabase queries. (2) Implement infinite-scroll or cursor-based pagination. (3) Add filters to reduce result set.

**Session Timeout Check Interval:**
- Current capacity: 60-second interval for checking session validity
- Limit: If many users are logged in, backend must process validation for each user every minute
- Scaling path: Move timeout check to server-side (validate token on each request), or increase interval to 5-10 minutes for lower-risk scenarios

**localStorage for Guest Tracking:**
- Current capacity: Guest session IDs stored in localStorage; no cleanup
- Limit: localStorage quota is ~5-10MB per origin; if guests fill with many sessions, quota exceeded errors occur
- Scaling path: Use server-side session tracking instead of localStorage; implement auto-cleanup for old sessions

## Dependencies at Risk

**Supabase Auth Sessions Storage Location Unknown:**
- Risk: useAuth assumes session stored in sessionStorage; not documented where Supabase stores sessions
- Impact: If Supabase changes storage mechanism, restoration logic breaks
- Migration plan: Add integration test that verifies session storage and restoration; document assumption in useAuth

**Next-themes with forcedTheme Hardcoded:**
- Risk: `src/App.tsx` line 254 uses `forcedTheme="dark"` which disables theme switching
- Impact: Theme toggle UI may appear but have no effect; confuses users
- Migration plan: Remove `forcedTheme` prop or add conditional based on user preference

**React Router v6 Nested Routes Complexity:**
- Risk: Hospital dashboard has two separate route definitions (lines 169-192 and 206-222 in `src/App.tsx`) that do the same thing
- Impact: Code duplication; maintenance burden increases; bug fixes must be applied twice
- Migration plan: Consolidate routes into single definition; use params/layout wrapper

## Missing Critical Features

**No Error Recovery UI:**
- Problem: When API calls fail, components show spinners indefinitely or generic error messages
- Blocks: Users can't retry failed operations; no clear indication of what went wrong
- Fix: Add retry buttons to error states; show specific error messages

**No Offline Detection:**
- Problem: App doesn't detect network failures; requests timeout silently
- Blocks: Users on slow connections or poor reception get stuck
- Fix: Detect offline state; show banner; queue operations for retry

**No Activity Logging in Production:**
- Problem: Errors in production are unobservable
- Blocks: Can't debug user-reported issues without logs
- Fix: Integrate error tracking (Sentry, LogRocket, etc.)

**No Rate Limit Handling:**
- Problem: Supabase RPC calls and API endpoints may rate-limit; no exponential backoff
- Blocks: Under high load, requests fail permanently instead of retrying
- Fix: Implement exponential backoff in API interceptor

## Test Coverage Gaps

**No Unit Tests for Core Hooks:**
- What's not tested: `useAuth.tsx` (463 lines, handles critical session state), `useAllApplications.ts`, `usePositionApplications.ts`
- Files: No test files in `src/hooks/__tests__/`
- Risk: Auth bugs go undetected; changes to useAuth can break session restoration, cookie exchange, timeout logic
- Priority: High — useAuth is critical for all authenticated features

**No Integration Tests for Admin Flows:**
- What's not tested: Admin user search, hospital list loading, premium user management
- Files: Only `src/components/admin/__tests__/AdminUserProfile.utils.test.ts` exists (utility functions only)
- Risk: Admin dashboard bugs affect hospital staff; can't safely refactor large admin components
- Priority: High — admin features directly impact customer experience

**No E2E Tests:**
- What's not tested: Full user journeys (sign up → apply → view application)
- Files: No e2e test directory
- Risk: Integration issues between components/pages only found in production
- Priority: Medium — would catch most user-facing bugs

**No Tests for API Interceptor CSRF Logic:**
- What's not tested: CSRF token refresh on 403, retry logic, token rotation
- Files: `src/lib/api/interceptor.ts` (149 lines)
- Risk: CSRF protection breaks silently; requests fail with 403 without clear reason
- Priority: High — security-critical code

**No Tests for Session Timeout Logic:**
- What's not tested: Activity timer reset, timeout firing after 30 min inactivity, race conditions with simultaneous auth events
- Files: `src/hooks/useAuth.tsx` (timeout logic at lines 193-208)
- Risk: Sessions timeout unexpectedly or don't timeout when they should
- Priority: Medium — affects user experience

**No Type Safety Tests:**
- What's not tested: Components accept null/undefined where they shouldn't; `any` type assertions bypass checks
- Files: 68+ `any` assertions across codebase
- Risk: Runtime errors like "Cannot read property X of undefined"
- Priority: Medium — fixes found during refactoring

---

*Concerns audit: 2026-04-11*
