# ClinicalHours

A clinical hours tracking and management application.

---

## Local Development

### Prerequisites

- **Node.js 18+**
- **Docker Desktop** (required for local Supabase) — [Install Docker](https://docs.docker.com/desktop/)
- Supabase CLI is used via `npx` (no global install required)

### 1. Clone & install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

You will fill in the values from step 4 after starting Supabase.

### 3. Start Docker Desktop

Ensure **Docker Desktop is running** before the next step. Local Supabase runs in Docker.

### 4. Start local Supabase

```bash
npm run supabase:start
```

Copy the **API URL** and **anon key** from the output into `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<paste anon key here>
```

### 5. Apply migrations

```bash
npm run supabase:reset
```

Or to apply only new migrations without resetting data:

```bash
npm run supabase:migrate
```

This applies all SQL files in `supabase/migrations/` in order, including the
hospital ecosystem tables (`20260219000001_hospital_ecosystem.sql`).

### 6. (Optional) Seed sample hospital data

```bash
npm run supabase:seed
```

Requires `psql` (PostgreSQL client). Inserts three sample hospitals for onboarding.

### 7. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port Vite prints; the app may use port 8080 per config).

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
