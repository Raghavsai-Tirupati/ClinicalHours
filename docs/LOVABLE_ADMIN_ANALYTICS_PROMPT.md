# Lovable: Admin Analytics — Supabase migrations + deploy

> **Backend-only prompt:** For a focused copy-paste prompt (migrations, verification SQL, no UI work), use **[LOVABLE_ANALYTICS_BACKEND_PROMPT.md](./LOVABLE_ANALYTICS_BACKEND_PROMPT.md)**.

Paste the **prompt below** into Lovable’s chat after this repo is synced. The frontend for the admin analytics dashboard is already in the codebase; **Lovable must apply the database migrations** so KPIs, charts, student table, and activity feed work.

---

## Copy-paste prompt for Lovable

```
You are working on the ClinicalHours repo (Vite + React + Supabase via Lovable Cloud).

The student analytics workspace lives at **`/analytics`** (platform-admin only). Admin OS → Students tab now links there. Apply all three migrations below.

---

## 1. Apply these three migrations (in order)

Source of truth: `supabase/migrations/`

Run in timestamp order:

1. `20260618100000_admin_analytics.sql`
2. `20260618110000_fix_admin_os_rls.sql`
3. `20260619100000_student_analytics_hub.sql`

Preferred method: Supabase CLI from repo root:
- `npx supabase link` (if needed, project ref is in `supabase/config.toml` → `project_id`)
- `npx supabase db push`

If CLI is unavailable, run each file in Supabase Dashboard → SQL Editor in the same order.

Do not skip either file. Do not modify existing tables in ways that break hospital admin or student flows.

---

## 2. What migration 1 creates (`20260618100000_admin_analytics.sql`)

### Table: `platform_events`
Structured business events for admin analytics:
- Columns: `id`, `user_id`, `actor_type` (student/admin/system), `event_type`, `entity_type`, `entity_id`, `clinic_id`, `metadata` (jsonb), `created_at`
- RLS: admins can SELECT via `has_role(auth.uid(), 'admin')`; inserts only via SECURITY DEFINER triggers (no client INSERT policy)

### Function: `log_platform_event(...)`
SECURITY DEFINER helper used by triggers.

### Triggers (auto-log events)
- `student_applications` INSERT → `application_submitted`
- `student_applications` UPDATE OF status → `status_changed`
- `application_notes` INSERT → `admin_note_added`

### View: `admin_student_summary`
Per-student rollup for the admin student directory:
- Profile fields, last login/active, application counts, clinic names, volunteer hours, avg evaluation score (from `volunteer_tracker_values` rating columns), `attention_level`, `needs_attention`
- `security_invoker = true` — respects underlying RLS

### View: `admin_unified_activity`
Union of meaningful events from:
- `platform_events`
- `tracking_events` (login, signup, saves, apply clicks, etc.)
- `admin_activity_log`

### RPCs (admin-only via `assert_admin()`)
- `get_admin_dashboard_kpis(p_since, p_until, p_clinic_id)` → JSONB KPI object
- `get_admin_time_series(p_metric, p_since, p_until, p_granularity, p_clinic_id)` → time buckets

Metrics supported: `new_users`, `active_users`, `logins`, `applications`, `evaluations`, `avg_evaluation_score`

### Realtime
Adds `platform_events` to `supabase_realtime` publication (for live activity feed).

---

## 3. What migration 2 fixes (`20260618110000_fix_admin_os_rls.sql`)

The Admin OS migration (`20260530000000_admin_os_backend.sql`) created RLS policies referencing `profiles.role = 'admin'`, but **`profiles` has no `role` column** — admin role lives in `user_roles`.

This migration drops and recreates `admin_all_*` policies on these tables to use `has_role(auth.uid(), 'admin')`:
- `clinic_leads`, `lead_contacts`, `lead_pipeline_history`
- `campaigns`, `campaign_messages`, `message_sequences`, `sequence_steps`
- `agent_tasks`, `agent_runs`, `agent_recommendations`
- `approval_tasks`, `metric_definitions`, `metric_snapshots`
- `data_quality_incidents`, `playbooks`

Without this fix, Control Tower / Data Trust / Agent Inbox tabs may return empty data for platform admins.

---

## 4. What migration 3 creates (`20260619100000_student_analytics_hub.sql`)

### Table: `analytics_cohorts`
Saved cohort filter scripts (templates + custom):
- `name`, `description`, `filter_json` (declarative JSON filters), `is_template`, `created_by`
- Seeded templates: inactive signups, saved-not-applied, incomplete onboarding, etc.

### RPCs
- `run_cohort_filter(p_filter, p_limit, p_offset)` — run a cohort script server-side
- `get_student_analytics_bundle(p_user_id)` — full student 360 JSON for `/analytics/students/:id`
- `get_promotion_funnel(p_since, p_until)` — acquisition funnel for Reports tab

### Admin read RLS
- SELECT on `activity_logs` and `experience_entries` for platform admins

### Realtime
- Adds `profiles` and `student_applications` to realtime publication

---

## 5. Frontend routes (already wired)

| Route | Purpose |
|-------|---------|
| `/analytics` | Overview — KPIs, funnel, live feed, charts |
| `/analytics/students` | Student explorer + CSV export |
| `/analytics/students/:id` | Student 360 — all data tabs + JSON export |
| `/analytics/events` | Live event stream |
| `/analytics/cohorts` | Cohort script builder + saved scripts |
| `/analytics/reports` | Promotion reports (funnel, geo, universities) |

Key files: `src/layouts/StudentAnalyticsLayout.tsx`, `src/pages/analytics/*`, `src/lib/analytics/*`, `src/hooks/useAnalyticsRealtime.ts`

Admin OS → Students tab links to `/analytics`. No AI/LLM used in analytics.

---

## 6. Frontend already wired (legacy admin analytics)

These files call the new backend:

| File | Purpose |
|------|---------|
| `src/components/admin/AdminStudentsTab.tsx` | Wraps analytics center |
| `src/components/admin/analytics/AdminAnalyticsCenter.tsx` | Main dashboard layout |
| `src/lib/admin/analytics.ts` | RPC + view fetchers |
| `src/lib/admin/timeRanges.ts` | 7d / 30d / 90d / YTD / all |
| `src/components/admin/AdminUserProfile.tsx` | Enhanced with clinic membership + admin notes |
| `src/components/admin/ControlTowerTab.tsx` | Fixed queries: `account_status` not `status`, `link_status` not `is_active` |
| `src/integrations/supabase/types.ts` | Already includes `platform_events`, views, RPC types |

Admin page: `/admin` → Students tab links to `/analytics`

---

## 7. Post-migration verification

Run as an admin user (`user_roles.role = 'admin'`):

### SQL checks
```sql
-- Objects exist
SELECT to_regclass('public.platform_events');
SELECT to_regclass('public.admin_student_summary');
SELECT to_regclass('public.admin_unified_activity');

-- RPC works (replace with admin JWT context or run in SQL editor as service role for structure check)
SELECT public.get_admin_dashboard_kpis();
-- Should return JSON with keys: total_students, active_students_week, pending_applications, etc.

SELECT * FROM public.get_admin_time_series('new_users', now() - interval '30 days', now(), 'day') LIMIT 5;

-- View returns rows
SELECT count(*) FROM public.admin_student_summary;
SELECT count(*) FROM public.admin_unified_activity;
```

### UI smoke test
1. Log in as platform admin
2. Go to **`/analytics`** (Overview)
3. Confirm KPI cards, funnel, charts, live activity feed
4. **Students** — directory loads, click student → 360 page with tabs
5. **Events** — filterable live stream
6. **Cohorts** — run a template script, export CSV
7. **Reports** — funnel + university/state breakdowns
8. Admin OS → Students tab shows link card to `/analytics`

---

## 8. Regenerate types (optional but recommended)

After migrations apply:
```bash
npx supabase gen types typescript --project-id <project-ref> > src/integrations/supabase/types.ts
```
Types were manually updated in repo; regen ensures parity with live schema.

---

## 9. Constraints — do NOT break

- Existing `tracking_events` + `track` edge function — keep working
- Hospital admin RLS (`hospital_pages.admin_email = auth.email()`) — untouched
- Student application flows (`student_applications`, `submit_position_application_atomic`) — triggers only ADD rows to `platform_events`
- Do not add client-side INSERT policies on `platform_events` — use triggers/service role only

---

## 10. Report back

Tell me:
1. CLI vs manual SQL
2. Any migration errors and how you fixed them
3. Results of verification queries (object counts)
4. Screenshot or confirmation that Admin → Students tab shows KPIs + student table
5. Whether Control Tower tabs load after RLS fix
```

---

## Quick reference: files in this change

| Path | Role |
|------|------|
| `supabase/migrations/20260618100000_admin_analytics.sql` | Analytics backend |
| `supabase/migrations/20260618110000_fix_admin_os_rls.sql` | Admin OS RLS fix |
| `supabase/migrations/20260619100000_student_analytics_hub.sql` | Cohorts, bundle RPC, funnel RPC |
| `src/pages/analytics/*` | Analytics hub pages |
| `src/layouts/StudentAnalyticsLayout.tsx` | Analytics shell |
| `docs/LOVABLE_ADMIN_ANALYTICS_PROMPT.md` | This prompt |

## If migrations fail

Common issues:
- **`has_role` not found** — ensure base auth migrations ran; function exists in `public`
- **`admin_activity_log.hospital_page_id` missing** — check `admin_activity_log` schema; column may be nullable in some envs
- **Realtime publication error** — safe to ignore if table already in publication (migration uses `EXCEPTION WHEN duplicate_object`)
- **View empty for admin** — confirm logged-in user has row in `user_roles` with `role = 'admin'`
