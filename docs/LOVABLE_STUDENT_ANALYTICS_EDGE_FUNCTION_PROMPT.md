# Lovable: Deploy `student-analytics` Edge Function (MCP data feed)

Paste the block below into Lovable when you have credits. **Backend only** — do not change frontend or analytics UI.

This deploys the read-only analytics API used by the local Cursor MCP server (`mcp/clinicalhours-analytics/`).

---

## Copy-paste prompt for Lovable

```
You are working on ClinicalHours (Vite + React + Supabase via Lovable Cloud).

## YOUR JOB: DEPLOY ONE EDGE FUNCTION + ONE SECRET

Deploy the existing `student-analytics` edge function so a local Cursor MCP agent can query live production data over HTTPS. Do NOT rebuild any frontend pages.

Source file (already in repo): `supabase/functions/student-analytics/index.ts`
Config (already in repo): `supabase/config.toml` → `[functions.student-analytics]` with `verify_jwt = false`

---

## STEP 1 — Set the secret

Add this Supabase Edge Function secret (exact value — must match local `.env`):

```
ANALYTICS_API_TOKEN=1032f28212cd12e8dedfcacf763dc9c5dad5e4384dc70ed03e07387717e63638
```

In Lovable Cloud / Supabase secrets UI, name: `ANALYTICS_API_TOKEN`, value: the hex string above (no quotes).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform — do not hardcode them.

---

## STEP 2 — Deploy the function

Deploy `student-analytics` from `supabase/functions/student-analytics/index.ts`.

Requirements:
- Function name: `student-analytics` (URL path: `/functions/v1/student-analytics`)
- `verify_jwt = false` (function uses its own `x-api-token` / Bearer auth, not Supabase JWT)
- Uses Deno imports: `@supabase/supabase-js@2` and cors from same package (already in file)

Do not modify the function logic unless deploy fails — then fix only the minimum import/runtime issue and report what changed.

---

## STEP 3 — Prerequisite migrations (apply if missing)

The function calls these DB objects. If any are missing, apply migrations from `supabase/migrations/` in order:

1. `20260618100000_admin_analytics.sql`
2. `20260618110000_fix_admin_os_rls.sql`
3. `20260619100000_student_analytics_hub.sql`
4. `20260619210345_b6a11813-111c-46a9-a0f0-2b47c4d3eba0.sql` — creates `list_public_tables()` RPC

Skip migrations that are already applied (duplicate_object / already exists errors are OK).

---

## STEP 4 — Smoke test (run after deploy)

Replace `<project-ref>` with the Supabase project ref (`sysbtcikrbrrgafffody`).

```bash
curl -s -H "x-api-token: 1032f28212cd12e8dedfcacf763dc9c5dad5e4384dc70ed03e07387717e63638" \
  "https://sysbtcikrbrrgafffody.supabase.co/functions/v1/student-analytics?table=_list" | head -c 500

curl -s -H "x-api-token: 1032f28212cd12e8dedfcacf763dc9c5dad5e4384dc70ed03e07387717e63638" \
  "https://sysbtcikrbrrgafffody.supabase.co/functions/v1/student-analytics?analytics=kpis" | head -c 500

curl -s -H "x-api-token: 1032f28212cd12e8dedfcacf763dc9c5dad5e4384dc70ed03e07387717e63638" \
  "https://sysbtcikrbrrgafffody.supabase.co/functions/v1/student-analytics?table=admin_student_summary&limit=2" | head -c 800
```

Expected:
- `table=_list` → JSON with `"tables": [...]` array
- `analytics=kpis` → JSON with `"analytics":"kpis"` and `"data":{...}` KPI object
- Wrong/missing token → `{"error":"Unauthorized"}` with HTTP 401
- `admin_student_summary` → student rollup rows (or empty array if no data)

---

## STEP 5 — Security checklist

- `ANALYTICS_API_TOKEN` is the ONLY client-facing credential for this API
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend or MCP `.env`
- Denied tables (hardcoded in function): `password_reset_tokens`, `email_verification_tokens`, `oauth_states`, `edge_function_rate_limits`
- Max page size: 1000 rows per request

---

## DO NOT

- Change hospital admin RLS, student application flows, or auth
- Add client INSERT on `platform_events`
- Rebuild `/analytics` frontend
- Rename the function or change the token auth scheme

---

## REPORT BACK

1. Confirm `ANALYTICS_API_TOKEN` secret is set
2. Confirm `student-analytics` deployed and reachable
3. Paste output (truncated OK) of the three curl smoke tests
4. List any migrations you had to apply
5. Any errors and how you fixed them
```

---

## After Lovable deploys

1. Reload MCP in Cursor (Settings → MCP) — `clinicalhours-analytics` should show 8 tools
2. Ask the agent e.g. “list analytics tables” or “get dashboard KPIs for the last 30 days”

Local MCP reads `ANALYTICS_API_TOKEN` from `.env` (gitignored). Token in this doc must match that file.
