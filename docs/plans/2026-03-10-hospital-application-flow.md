# Hospital Application Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect hospital admin and application: one Apply button on opportunities page that uses the hospital's custom questions form, submits to `hospital_applications` with `opportunity_id`, and displays all responses in the hospital dashboard Student Applications tab.

**Architecture:** Add `opportunity_id` to `hospital_applications`; create `/opportunities/:slug/apply` page that loads hospital account from opportunity, renders custom questions, submits via extended `submit_guest_hospital_application` (or new RPC); Tab 3 lists `hospital_applications` with opportunity name.

**Tech Stack:** React, Supabase (PostgreSQL, RLS, RPC), TypeScript.

---

## Task 1: Add opportunity_id to hospital_applications

**Files:**
- Create: `supabase/migrations/YYYYMMDD_add_opportunity_id_to_hospital_applications.sql`

**Step 1: Create migration**

Create migration file (use next timestamp, e.g. `20260311030000_add_opportunity_id_to_hospital_applications.sql`):

```sql
-- Add opportunity_id to hospital_applications for linking submissions to specific positions
ALTER TABLE public.hospital_applications
  ADD COLUMN IF NOT EXISTS opportunity_id uuid
  REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hospital_applications_opportunity_id
  ON public.hospital_applications (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

COMMENT ON COLUMN public.hospital_applications.opportunity_id IS 'Links application to a specific opportunity when applied from opportunities page';
```

**Step 2: Run migration**

```bash
cd c:\Users\shiva\ClinicalHours && npx supabase db push
```

Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/*.sql
git commit -m "feat(db): add opportunity_id to hospital_applications"
```

---

## Task 2: Extend submit_guest_hospital_application to accept opportunity_id

**Files:**
- Modify: `supabase/migrations/20260220000002_guest_applications.sql` (or create new migration that replaces the function)

**Step 1: Create new migration**

Create `supabase/migrations/20260311030001_submit_hospital_application_opportunity.sql`:

```sql
-- Extend submit_guest_hospital_application to accept optional opportunity_id
CREATE OR REPLACE FUNCTION public.submit_guest_hospital_application(
  p_account_id uuid,
  p_name       text,
  p_email      text,
  p_answers    jsonb,
  p_opportunity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  text;
  v_app_id uuid;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF NOT (v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  IF EXISTS (
    SELECT 1 FROM hospital_applications
    WHERE account_id      = p_account_id
      AND student_id      IS NULL
      AND lower(applicant_email) = v_email
      AND (p_opportunity_id IS NULL OR opportunity_id = p_opportunity_id)
  ) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;

  INSERT INTO hospital_applications (
    account_id, student_id, applicant_name, applicant_email, status, opportunity_id
  ) VALUES (
    p_account_id, NULL, trim(p_name), v_email, 'submitted', p_opportunity_id
  )
  RETURNING id INTO v_app_id;

  IF jsonb_typeof(p_answers) = 'array' AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO hospital_application_answers
      (application_id, question_id, answer_text, answer_options)
    SELECT
      v_app_id,
      (elem->>'question_id')::uuid,
      NULLIF(trim(elem->>'answer_text'), ''),
      CASE
        WHEN jsonb_typeof(elem->'answer_options') = 'array'
          THEN elem->'answer_options'
        ELSE NULL
      END
    FROM jsonb_array_elements(p_answers) AS elem;
  END IF;

  RETURN v_app_id;
END;
$$;

COMMENT ON FUNCTION public.submit_guest_hospital_application(uuid, text, text, jsonb, uuid) IS
  'Submit hospital application (guest or logged-in). Optional p_opportunity_id links to specific opportunity.';
```

**Step 2: Add authenticated-student variant if needed**

Check if `hospital_applications` inserts for authenticated users need a separate RPC. If ApplicationForm or similar writes directly via Supabase client, we may need an RPC for authenticated + opportunity_id. For now, guest flow is extended. Authenticated users can use same RPC with student_id passed separately—but the current `submit_guest_hospital_application` doesn't handle student_id. Inspect existing flow:

- `submit_guest_hospital_application` inserts with `student_id = NULL`. Authenticated flow likely uses direct insert. Create a second RPC or extend this one to accept optional `p_student_id`.

**Simpler approach:** Create `submit_hospital_application` that accepts `p_student_id uuid DEFAULT NULL` and `p_opportunity_id uuid DEFAULT NULL`. Use for both guest and authenticated.

Create migration `20260311030001_submit_hospital_application_full.sql`:

```sql
-- Unified submit: guest + authenticated, with optional opportunity_id
CREATE OR REPLACE FUNCTION public.submit_guest_hospital_application(
  p_account_id     uuid,
  p_name           text,
  p_email          text,
  p_answers        jsonb,
  p_opportunity_id uuid DEFAULT NULL,
  p_student_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  text;
  v_app_id uuid;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF NOT (v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  -- Duplicate check: same account, same email (guest) or same student (auth), same opportunity if provided
  IF p_student_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM hospital_applications
      WHERE account_id = p_account_id AND student_id = p_student_id
        AND (p_opportunity_id IS NULL OR opportunity_id = p_opportunity_id)
    ) THEN
      RAISE EXCEPTION 'already_applied';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM hospital_applications
      WHERE account_id = p_account_id AND student_id IS NULL
        AND lower(applicant_email) = v_email
        AND (p_opportunity_id IS NULL OR opportunity_id = p_opportunity_id)
    ) THEN
      RAISE EXCEPTION 'already_applied';
    END IF;
  END IF;

  INSERT INTO hospital_applications (
    account_id, student_id, applicant_name, applicant_email, status, opportunity_id
  ) VALUES (
    p_account_id, p_student_id, trim(p_name), v_email, 'submitted', p_opportunity_id
  )
  RETURNING id INTO v_app_id;

  IF jsonb_typeof(p_answers) = 'array' AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO hospital_application_answers
      (application_id, question_id, answer_text, answer_options)
    SELECT
      v_app_id,
      (elem->>'question_id')::uuid,
      NULLIF(trim(elem->>'answer_text'), ''),
      CASE WHEN jsonb_typeof(elem->'answer_options') = 'array' THEN elem->'answer_options' ELSE NULL END
    FROM jsonb_array_elements(p_answers) AS elem;
  END IF;

  RETURN v_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_hospital_application(uuid, text, text, jsonb, uuid, uuid) TO anon, authenticated;
```

Note: PostgreSQL allows overloaded functions. The old signature `(uuid, text, text, jsonb)` will conflict. We need to either drop and recreate with new params (breaking existing callers) or add a new function. Safer: add optional params with defaults. In PostgreSQL, `submit_guest_hospital_application(p_account_id, p_name, p_email, p_answers)` can call an overload. Create a NEW function `submit_hospital_application` with full params and keep `submit_guest_hospital_application` as a wrapper that calls it with NULL for opportunity and student. Or: alter the function to have 6 params with defaults so existing 4-arg calls still work.

Simplest: Replace the function with 6 params, last two with DEFAULT NULL. Callers using 4 args will still work.

**Step 3: Run migration, commit**

```bash
npx supabase db push
git add supabase/migrations/*.sql && git commit -m "feat(db): extend submit_guest_hospital_application with opportunity_id and student_id"
```

---

## Task 3: Create HospitalApplyPage component

**Files:**
- Create: `src/pages/HospitalApplyPage.tsx`

**Step 1: Implement page**

Create `HospitalApplyPage.tsx` that:
- Uses `useParams` for `slug`
- Fetches opportunity by slug
- Fetches hospital_account by opportunity.hospital_id
- Fetches hospital_application_questions by account_id
- Renders form: name, email, (phone optional), custom questions, resume upload
- On submit: calls `submit_guest_hospital_application` with account_id, name, email, answers, opportunity_id, user?.id ?? null
- Shows success/error state

Reference `ApplicationForm.tsx` for resume upload and layout. Reference any existing hospital-apply form for question rendering. Use `supabase.rpc('submit_guest_hospital_application', { p_account_id, p_name, p_email, p_answers, p_opportunity_id, p_student_id })`.

**Step 2: Add route**

In `src/App.tsx` add:
```tsx
<Route path="/opportunities/:slug/apply" element={<HospitalApplyPage />} />
```

Lazy import: `const HospitalApplyPage = lazy(() => import("./pages/HospitalApplyPage"));`

**Step 3: Commit**

```bash
git add src/pages/HospitalApplyPage.tsx src/App.tsx
git commit -m "feat: add HospitalApplyPage at /opportunities/:slug/apply"
```

---

## Task 4: Update Apply button navigation to /opportunities/:slug/apply

**Files:**
- Modify: `src/pages/OpportunityDetail.tsx`
- Modify: `src/pages/Opportunities.tsx`

**Step 1: OpportunityDetail**

Change Direct Apply button from:
```tsx
onClick={() => navigate(`/hospital/apply/${directApplyAccountId}`)}
```
to:
```tsx
onClick={() => navigate(`/opportunities/${slug}/apply`)}
```

Keep the same visibility condition (directApplyAccountId exists). Optionally rename button label from "Direct Apply" to "Apply" for consistency.

**Step 2: Opportunities list**

Change Direct Apply button from:
```tsx
onClick={() => navigate(`/hospital/apply/${hospitalAccountMap.get(opportunity.hospital_id!)}`)}
```
to:
```tsx
onClick={() => navigate(`/opportunities/${opportunity.slug}/apply`)}
```

Ensure `opportunity.slug` exists in the list item data.

**Step 3: Commit**

```bash
git add src/pages/OpportunityDetail.tsx src/pages/Opportunities.tsx
git commit -m "feat: route Apply button to /opportunities/:slug/apply"
```

---

## Task 5: Tab 3 – list hospital_applications with opportunity

**Files:**
- Modify: `src/pages/HospitalDashboard.tsx`

**Step 1: Extend data fetching**

Currently Tab 3 fetches from `applications` table. Add fetch for `hospital_applications` where account_id IN (hospital's accounts). Join with opportunities to get opportunity name. Merge or replace the displayed list with hospital_applications. Columns: student name (applicant_name or from profile), email, opportunity name, date, status.

Query example:
```ts
const { data: haApps } = await supabase
  .from('hospital_applications')
  .select(`
    id,
    applicant_name,
    applicant_email,
    status,
    created_at,
    opportunity_id,
    opportunities(name)
  `)
  .eq('account_id', member.accountId)
  .order('created_at', { ascending: false });
```

(Use correct Supabase join syntax for opportunities.)

**Step 2: Update Tab 3 UI**

Render rows from `hospital_applications`. Include opportunity name. Keep filters (search, status) and View action. View can navigate to a detail modal or `/opportunities/:slug/admin` if slug is available (need to fetch slug from opportunity_id).

**Step 3: Create or extend RPC for hospital_applications list**

If RLS blocks direct select, create `hospital_list_hospital_applications(p_account_id uuid)` SECURITY DEFINER that returns hospital_applications with opportunity name. Or ensure RLS allows hospital members to read.

**Step 4: Commit**

```bash
git add src/pages/HospitalDashboard.tsx
git commit -m "feat: Tab 3 lists hospital_applications with opportunity"
```

---

## Task 6: Hospital application detail view

**Files:**
- Modify: `src/pages/HospitalDashboard.tsx` or `src/pages/HospitalAdmin.tsx`

**Step 1: Add detail view**

When user clicks View on a hospital_application row, show a modal or slide-over with: applicant name, email, resume link, custom question answers, opportunity name, status. Allow status update (New → Under Review → Accepted/Rejected).

**Step 2: Implement status update**

`supabase.from('hospital_applications').update({ status }).eq('id', appId)`—ensure RLS allows hospital admins to update.

**Step 3: Commit**

```bash
git add src/pages/HospitalDashboard.tsx
git commit -m "feat: hospital application detail view with status update"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add `opportunity_id` column to `hospital_applications` |
| 2 | Extend `submit_guest_hospital_application` with opportunity_id, student_id |
| 3 | Create HospitalApplyPage at `/opportunities/:slug/apply` |
| 4 | Update Apply buttons to use new route |
| 5 | Tab 3 lists hospital_applications with opportunity |
| 6 | Detail view and status update for hospital applications |

---

**Execution options after plan completion:**
1. **Subagent-driven** – Implement task-by-task in this session with review.
2. **Parallel session** – Open new session with executing-plans for batch execution.
