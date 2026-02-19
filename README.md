# ClinicalHours

A clinical hours tracking and management application.

---

## Local Development

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)

### 1. Clone & install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the values printed by `supabase start` (see step 3).

### 3. Start local Supabase

```bash
supabase start
```

Copy the **API URL** and **anon key** printed at the end into `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

### 4. Apply migrations

```bash
supabase db reset
# or, to apply only new migrations without resetting data:
supabase migration up
```

This applies all SQL files in `supabase/migrations/` in order, including the
hospital ecosystem tables (`20260219000001_hospital_ecosystem.sql`).

### 5. (Optional) Seed sample hospital data

```bash
psql $(supabase db url) -f supabase/seed_hospital.sql
```

This inserts three sample hospitals you can use during onboarding.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Hospital Ecosystem

### Flows

| Role | Flow |
|------|------|
| Hospital rep | Sign up → `/hospital/onboarding` → select/create hospital → `/hospital/admin` |
| Hospital admin | `/hospital/admin` → Application Questions tab → add/edit/delete/reorder questions |
| Hospital admin | `/hospital/admin` → Applicants tab → view/update status + notes |
| Student | `/hospital/apply/:accountId` → submit application + answers |

### Routes

| Path | Description |
|------|-------------|
| `/hospital/onboarding` | Hospital rep onboarding (search or create hospital) |
| `/hospital/admin` | Hospital admin dashboard (questions + applicants) |
| `/hospital/apply/:accountId` | Student application form for a specific hospital |

### Navigation

The **Hospital Admin** link appears in the top nav automatically for any
authenticated user who is a member of a hospital account.

### Database tables (new)

| Table | Purpose |
|-------|---------|
| `hospitals` | Hospital entities (name, city, state, website) |
| `hospital_accounts` | One account (tenant) per hospital |
| `hospital_members` | Users linked to an account with roles: `owner`, `admin`, `viewer` |
| `hospital_application_questions` | Custom questions per hospital account |
| `hospital_applications` | Student applications (one per student per hospital) |
| `hospital_application_answers` | Answers to each question |

RLS policies ensure strict cross-tenant isolation.

---

## License

This software is proprietary and confidential. All rights reserved.

See the [LICENSE](LICENSE) file for full terms and conditions.

**© 2026 ClinicalHours. Unauthorized copying, distribution, or modification is strictly prohibited.**
