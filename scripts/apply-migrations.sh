#!/usr/bin/env bash
# Apply pending Supabase migrations (admin analytics + RLS fix) to the linked project.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-sysbtcikrbrrgafffody}"

echo "→ ClinicalHours migration push (project: $PROJECT_REF)"
echo "  Requires: supabase login (or SUPABASE_ACCESS_TOKEN in env)"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found" >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Run: npx supabase login"
  npx supabase login
fi

if [[ ! -f supabase/.temp/project-ref ]]; then
  echo "→ Linking project…"
  npx supabase link --project-ref "$PROJECT_REF"
fi

echo "→ Pushing migrations…"
npx supabase db push

echo ""
echo "✓ Migrations applied. Regenerate types if needed:"
echo "  npx supabase gen types typescript --project-id $PROJECT_REF > src/integrations/supabase/types.ts"
