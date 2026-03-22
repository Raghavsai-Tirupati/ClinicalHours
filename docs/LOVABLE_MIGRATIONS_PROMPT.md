# Lovable: Supabase migrations and hospital admin checklist

Paste the **prompt below** into Lovable’s chat (or your AI assistant) after connecting this GitHub repo and linking Supabase.

---

## Copy-paste prompt for Lovable

```
You are working on the ClinicalHours repo (Vite + React + Supabase). Do the following end-to-end:

1) Supabase project
   - Ensure the Lovable/Preview environment uses the correct Supabase project URL and anon (publishable) key.
   - Match secrets to production if this is prod, or use a dedicated staging project.

2) Run ALL database migrations (do not skip)
   - The source of truth is the folder: supabase/migrations/
   - Apply every .sql file in timestamp order (lexicographic filename order = migration order).
   - Preferred: use Supabase CLI from repo root — `npx supabase link` (if needed) then `npx supabase db push` — so the migration history table stays consistent.
   - Alternative: Supabase Dashboard → SQL Editor → run each file in order ONLY if CLI is unavailable (risk: drift from migration history; prefer CLI).

3) Critical migrations for “hospital admin sees applications / answers / profiles”
   After the full chain is applied, these specifically fix empty admin views and broken RLS (auth.users email subquery):
   - 20260321220000_fix_application_answers_and_profile_rls.sql  (adds application_answers.answer_options; hospital admin profile read policy)
   - 20260321230000_fix_profile_rls_use_auth_email.sql            (profiles policy uses auth.email())
   - 20260321240000_fix_application_rls_auth_email.sql            (student_applications, application_answers, legacy hospital_* tables; auth.email())
   - 20260321260000_fix_remaining_broken_rls_patterns.sql       (hospital_pages, hospital_positions, position_questions; auth.email())

4) Post-migration verification (SQL or Dashboard)
   - Table public.application_answers has column answer_options (jsonb).
   - RLS policies on applications/answers-related tables compare hospital_pages.admin_email to auth.email() — not subqueries into auth.users for the current user email.

5) Operational rules
   - Each hospital_pages row’s admin_email must equal the Google/email login of the hospital admin, or RLS will return empty rows with no error.
   - Regenerate TypeScript types if your workflow expects it: `npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts` (adjust path to match repo).

6) Frontend already expects
   - Admin application lists load answer_options from application_answers (useAllApplications.ts, usePositionApplications.ts).
   - Students apply via /opportunities/:slug/apply (HospitalApplyPage), not /application.

7) Smoke test
   - Log in as a hospital admin whose email matches hospital_pages.admin_email.
   - Open hospital dashboard → applications → open one application: answers and multi-select options should render; student profile fields (GPA, school, etc.) should load if the student has a profile.

Report what you ran (CLI vs manual), any migration errors, and confirmation of the verification queries.
```

---

## What was pushed to Git (reference)

Recent work on `main` includes loading `answer_options` in the hooks above and routing cleanup (legacy `ApplicationForm` removed; BCS card points to the opportunity page). Database behavior still depends on migrations being applied to the linked Supabase project.

## Local settings not in git

`.claude/settings.local.json` is intentionally not committed; keep it local only.
