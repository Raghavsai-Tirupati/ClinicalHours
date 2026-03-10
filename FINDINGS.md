# ClinicalHours Codebase Findings

## Architecture

- **Framework**: Vite + React 18 SPA (NOT Next.js)
- **Routing**: React Router DOM v6 (BrowserRouter, lazy-loaded pages)
- **State**: TanStack React Query for server state, local state via useState/useMemo
- **UI Library**: shadcn/ui (49 Radix-based primitives in `src/components/ui/`)
- **Styling**: Tailwind CSS with HSL CSS variables, dark mode forced (`forcedTheme="dark"`)
- **Icons**: Lucide React
- **Fonts**: Inter Variable (body), Plus Jakarta Sans Variable (headings), DM Sans Variable (fallback)
- **Charts**: Recharts (installed but lightly used)
- **Build**: Vite with SWC, code splitting via manual chunks

## Database Schema (Supabase PostgreSQL)

### Core Tables
- **profiles** — id, full_name, university, graduation_year, pre_med_track, major, bio, city, state, phone, gpa, resume_url, linkedin_url, career_goals, clinical_hours, research_experience, certifications, email_opt_in, email_verified, onboarding_complete, profile_visibility
- **opportunities** — id, name, type (hospital/clinic/hospice/emt/volunteer), location, address, latitude, longitude, hours_required, acceptance_likelihood, requirements, description, phone, email, website, slug, source, hospital_id, created_by
- **hospitals** — id, name, address, city, state, website, contact_name/email/phone, slug, status (seeded/verified/pending), submission workflow fields
- **experience_entries** — id, user_id, opportunity_id, entry_date, hours, moment (text reflection)
- **saved_opportunities** — id, user_id, opportunity_id, status (Saved/Applied/Interviewing/Completed), deadline, notes, tracking flags

### Auth & Roles
- **user_roles** — app_role enum: admin, moderator, user
- **hospital_members** — hospital_role enum: owner, admin, viewer
- **guest_sessions** — anonymous browsing tracking

### Key RPCs
- `get_opportunities_by_distance(user_lat, user_lon, max_distance_miles, ...)` — Haversine distance search
- `calculate_distance_miles(lat1, lat2, lon1, lon2)` — distance utility
- `has_role(_user_id, _role)` — SECURITY DEFINER role check

## Auth System
- Supabase Auth (email/password + Google OAuth)
- httpOnly cookies via `auth-cookie` edge function
- CSRF protection on state-changing requests
- "Remember me" with localStorage/sessionStorage dynamic adapter
- 30-minute inactivity session timeout
- Guest mode for anonymous browsing
- `handle_new_user()` trigger auto-creates profile on signup

## Existing Features
1. **Home page** — hero, globe animation, stats, feature showcase
2. **Map view** — Mapbox GL dark-v11, clustering, type-colored pins, radius filter, user location
3. **Opportunities** — browse/search/filter, distance sorting, paginated
4. **Dashboard** — saved opportunities tracker, hours logged, reflections, status pipeline
5. **Profiles** — form with auto-save, university/major autocomplete, city search
6. **Experience entries** — basic hour logging with optional "moment" text reflection
7. **Hospital ecosystem** — hospital signup, admin review, application forms
8. **Admin dashboard** — user management, hospital review, analytics

## What Does NOT Exist Yet
- Premium/subscription tiers (currently "100% Free")
- Payment integration (no Stripe)
- AI features (no Anthropic API calls)
- Competency mapping
- AMCAS activity descriptions
- LOR tracking
- Timeline/deadline planning
- Secondary essay tools
- Cost calculator
- School list builder

## Design Patterns
- **Colors**: Monochrome HSL system (black/white/gray), accent colors per type
- **Border radius**: 0rem (sharp corners everywhere)
- **Spacing**: Tailwind scale, container with 2rem padding
- **Components**: shadcn/ui with class-variance-authority
- **Dark theme**: Forced via next-themes (bg: hsl(0,0%,6%), fg: hsl(0,0%,95%))
- **Cards**: border-border bg-card pattern
- **Typography**: font-heading for headings, text-xs uppercase tracking-widest for nav

## Technical Constraints
- Supabase project ID: sysbtcikrbrrgafffody
- Dev server: port 8080
- Edge functions in `supabase/functions/` (Deno runtime)
- Email via Resend API (domain: clinicalhours.org)
- Environment: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_MAPBOX_PUBLIC_TOKEN
- All database access via Supabase client (RLS enforced)
- 50+ existing SQL migrations in `supabase/migrations/`
