# Lovable: Student Analytics — Backend Only

Paste the block below into Lovable. **Do not rewrite the frontend** — `/analytics` is already implemented in this repo. Your job is **Supabase only**: apply migrations, verify RPCs/views, enable realtime, report results.

---

## Copy-paste prompt for Lovable

```
You are working on ClinicalHours (Vite + React + Supabase via Lovable Cloud).

## YOUR JOB: BACKEND ONLY

Apply the student analytics database layer. The frontend at `/analytics` is already built and calls these objects. Do NOT rebuild UI unless a migration error requires a one-line fix.

Frontend routes (already exist — do not recreate):
- /analytics — Overview
- /analytics/students — Student directory
- /analytics/students/:id — Student 360
- /analytics/events — Live events
- /analytics/cohorts — Cohort scripts
- /analytics/reports — Promotion reports

---

## STEP 1 — Apply migrations IN ORDER

Source: `supabase/migrations/`

Run all three files via CLI (preferred) or SQL Editor:

1. `20260618100000_admin_analytics.sql`
2. `20260618110000_fix_admin_os_rls.sql`
3. `20260619100000_student_analytics_hub.sql`

```bash
npx supabase link   # project ref in supabase/config.toml → project_id
npx supabase db push
```

Do not skip files. Do not modify hospital admin RLS or student application flows.

---

## STEP 2 — What each migration creates

### Migration 1: `20260618100000_admin_analytics.sql`

**Table `platform_events`**
- Structured events: user_id, actor_type, event_type, entity_type, entity_id, clinic_id, metadata, created_at
- RLS: admin SELECT only; inserts via SECURITY DEFINER triggers (no client INSERT policy)

**Function `log_platform_event(...)`** — used by triggers

**Triggers**
- `student_applications` INSERT → `application_submitted`
- `student_applications` UPDATE status → `status_changed`
- `application_notes` INSERT → `admin_note_added`

**View `admin_student_summary`** (security_invoker)
- Per-student rollup: profile, last login/active, apps, clinics, eval scores, attention_level, needs_attention

**View `admin_unified_activity`** (security_invoker)
- Union: platform_events + tracking_events (meaningful types) + admin_activity_log

**RPCs** (all call `assert_admin()` internally)
- `get_admin_dashboard_kpis(p_since, p_until, p_clinic_id)` → JSONB
- `get_admin_time_series(p_metric, p_since, p_until, p_granularity, p_clinic_id)` → rows

Supported metrics: new_users, active_users, logins, applications, evaluations, avg_evaluation_score

**Realtime:** adds `platform_events` to supabase_realtime publication

---

### Migration 2: `20260618110000_fix_admin_os_rls.sql`

Fixes broken Admin OS RLS that referenced nonexistent `profiles.role`.
Recreates `admin_all_*` policies on clinic_leads, agent_*, approval_tasks, metric_*, etc. to use:
`has_role(auth.uid(), 'admin')`

Required for Control Tower / Data Trust / Agent Inbox tabs.

---

### Migration 3: `20260619100000_student_analytics_hub.sql`

**Table `analytics_cohorts`**
- Saved cohort scripts: name, description, filter_json, is_template, created_by
- Seeds 6 template scripts (inactive signups, saved-not-applied, etc.)
- RLS: admin ALL via has_role

**RPC `run_cohort_filter(p_filter, p_limit, p_offset)`**
- Applies declarative JSON filters against admin_student_summary + saved_opportunities joins
- Returns paginated student rows for Cohorts tab

**RPC `get_student_analytics_bundle(p_user_id)`**
- Returns JSONB with: profile, summary, saved_opportunities, student_applications, tracking_events, platform_events, experience_entries, activity_logs, reviews, clinic_memberships, person_notes, guest_session
- Powers Student 360 page at /analytics/students/:id

**RPC `get_promotion_funnel(p_since, p_until)`**
- Returns JSONB: landing_visitors, guest_sessions, signups, onboarding_complete, saved_at_least_one, applied, accepted

**Admin read RLS (SELECT only)**
- `activity_logs` — admins can read all
- `experience_entries` — admins can read all

**Realtime:** adds `profiles` and `student_applications` to publication

---

## STEP 3 — Verify after apply

Run as service role or with admin JWT in SQL editor:

```sql
-- Objects exist
SELECT to_regclass('public.platform_events');
SELECT to_regclass('public.admin_student_summary');
SELECT to_regclass('public.admin_unified_activity');
SELECT to_regclass('public.analytics_cohorts');

-- KPI RPC
SELECT public.get_admin_dashboard_kpis();

-- Time series
SELECT * FROM public.get_admin_time_series('new_users', now() - interval '30 days', now(), 'day') LIMIT 3;

-- Funnel
SELECT public.get_promotion_funnel(now() - interval '30 days', now());

-- Cohort (inactive template)
SELECT * FROM public.run_cohort_filter('{"inactive_days_min": 30}'::jsonb, 5, 0);

-- Views have data
SELECT count(*) FROM public.admin_student_summary;
SELECT count(*) FROM public.analytics_cohorts WHERE is_template = true;
-- expect 6 templates

-- Bundle (use a real profile id)
SELECT public.get_student_analytics_bundle((SELECT id FROM profiles LIMIT 1));
```

---

## STEP 4 — Realtime checklist

Confirm these tables are in `supabase_realtime` publication:
- platform_events
- profiles
- student_applications
- tracking_events (should already exist)

If duplicate_object errors during migration, that is OK — tables already published.

---

## STEP 5 — Optional type regen

```bash
npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
```

Types are pre-updated in repo; regen ensures parity.

---

## DO NOT

- Add client INSERT policies on platform_events
- Change hospital_pages / hospital admin RLS
- Call or wire any AI/LLM APIs for analytics
- Rebuild /analytics frontend pages
- Drop or alter student_applications, tracking_events, profiles in breaking ways

---

## REPORT BACK

1. CLI vs manual SQL
2. Any errors and fixes
3. Output of verification queries (counts)
4. Confirm /analytics loads KPIs for admin user (not all "—" or errors)
5. Confirm cohort templates count = 6
```

---

## Frontend ↔ backend contract

| Frontend call | Backend object |
|---------------|----------------|
| Overview KPIs | `get_admin_dashboard_kpis` |
| Charts | `get_admin_time_series` |
| Student table | `admin_student_summary` view |
| Activity feed | `admin_unified_activity` view + realtime on platform_events, tracking_events |
| Student 360 | `get_student_analytics_bundle` + `admin-get-users` edge fn for email |
| Cohorts | `analytics_cohorts` table + `run_cohort_filter` |
| Reports funnel | `get_promotion_funnel` |
| Live refresh | realtime on profiles, tracking_events, platform_events, student_applications |

If any RPC returns "function does not exist", the corresponding migration was not applied.
