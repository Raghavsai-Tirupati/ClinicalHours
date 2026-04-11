# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Payment Processing:**
- Stripe (v14 API version)
  - SDK: `stripe@14` (Deno import from `https://esm.sh/stripe@14?target=deno`)
  - Auth: Environment variable `STRIPE_SECRET_KEY`
  - Webhook Secret: `STRIPE_WEBHOOK_SECRET`
  - Price ID: `STRIPE_PRICE_ID`
  - Functions: `supabase/functions/create-checkout-session/`, `supabase/functions/stripe-webhook/`, `supabase/functions/cancel-subscription/`

**Email Services:**
- Resend (email API)
  - SDK: Resend HTTP API
  - Auth: Environment variable `RESEND_API_KEY`
  - Functions: `supabase/functions/send-contact-email/`, `supabase/functions/send-verification-email/`, `supabase/functions/send-password-reset/`, `supabase/functions/send-mass-email/`, `supabase/functions/send-hospital-applicant-email/`, `supabase/functions/send-clinic-bulk-email/`

**Maps & Geolocation:**
- Mapbox GL (v3.16.0)
  - SDK: `mapbox-gl@3.16.0` (npm)
  - Client: `src/components/HomeGlobe.tsx`, `src/components/ImmersiveMap.tsx`
  - Auth: Public token `VITE_MAPBOX_PUBLIC_TOKEN` (publishable key, safe to include)
  - Features: Interactive maps, tile layers, distance-based sorting
  - Dependencies: Nominatim (OpenStreetMap) for reverse geocoding in queries

**OAuth & Social Auth:**
- Google OAuth
  - Functions: `supabase/functions/gmail-oauth-initiate/`, `supabase/functions/gmail-oauth-callback/`, `supabase/functions/gmail-disconnect/`
  - Features: Gmail account linking for bulk email capabilities
  - Scope: Read/send email via Gmail API

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: `SUPABASE_URL` environment variable
  - Client: `@supabase/supabase-js@2.89.0`
  - Location: Supabase project `sysbtcikrbrrgafffody`
  - ORM: Supabase JS client (direct SQL queries + RPC functions)
  - Tables include: opportunities, hospital_page_positions, applications, users, hospital_pages, profiles, and more

**File Storage:**
- Supabase Storage (bucket-based)
  - Used for: Hospital logos, hospital images, documents
  - Accessed via: Supabase JS client file APIs
  - Project ID: `sysbtcikrbrrgafffody`

**Caching:**
- React Query (`@tanstack/react-query@5.90.16`)
  - Client-side cache for API responses
  - Invalidation patterns in place for mutations

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: JWT-based authentication
  - Storage: Dynamic adapter using `localStorage` (if "remember me") or `sessionStorage`
  - Flow: Email/password, OAuth (Google), magic links
  - Session Management: `supabase/functions/auth-cookie/`, `supabase/functions/restore-session/`, `supabase/functions/logout/`
  - CSRF Protection: Custom CSRF token handling in `src/lib/csrf.ts`
  - Client: `src/integrations/supabase/client.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected - no Sentry, Rollbar, or similar integration

**Logs:**
- Console logging via custom logger (`src/lib/logger.ts`)
- Supabase Edge Functions emit logs visible in Supabase dashboard

**Analytics:**
- Track event function: `supabase/functions/track/`
- Page view tracking: `src/components/PageViewTracker.tsx`
- Guest session tracking: Admin dashboard includes guest session stats

## CI/CD & Deployment

**Hosting:**
- Vercel (frontend)
  - Configuration: `vercel.json` with CSP headers, rewrite rules, Permissions Policy
  - Security headers enforced at edge

**CI Pipeline:**
- Not explicitly configured in repository
- Build command: `vite build`
- Preview command: `vite preview`

**Backend Deployment:**
- Supabase Edge Functions (Deno runtime)
- Deployment via Supabase CLI
- Function configuration in `supabase/config.toml`

## Environment Configuration

**Required Frontend Environment Variables:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase public anon key
- `VITE_MAPBOX_PUBLIC_TOKEN` - Mapbox public token

**Required Backend Environment Variables (Supabase Edge Functions):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `STRIPE_SECRET_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature secret
- `STRIPE_PRICE_ID` - Stripe subscription price ID
- `RESEND_API_KEY` - Resend email API key
- `GOOGLE_OAUTH_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google OAuth client secret

**Secrets Location:**
- Environment variables stored in Vercel project settings (for frontend)
- Supabase project secrets stored in Supabase dashboard

## Webhooks & Callbacks

**Incoming:**
- Stripe Webhook: `supabase/functions/stripe-webhook/`
  - Endpoint: `{SUPABASE_URL}/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.deleted`
  - Signature verification required

- Calendly Webhook: `supabase/functions/calendly-webhook/`
  - Endpoint: `{SUPABASE_URL}/functions/v1/calendly-webhook`
  - Purpose: Interview scheduling integration

- Gmail OAuth Callback: `supabase/functions/gmail-oauth-callback/`
  - Endpoint: `{SUPABASE_URL}/functions/v1/gmail-oauth-callback`
  - Purpose: OAuth token exchange for Gmail integration

**Outgoing:**
- Email notifications via Resend
- Stripe webhook callbacks for subscription status
- Google OAuth redirects to Gmail callback handler

## API Integration Patterns

**Client-Side:**
- Supabase JS client for direct database access
  - Path: `src/integrations/supabase/client.ts`
  - Custom fetch wrapper with CSRF token handling
  - Automatic JWT injection in Authorization header

**Edge Function Pattern:**
- Deno TypeScript functions
- CORS handling via `validateOrigin()` and `getCorsHeaders()` from `supabase/functions/_shared/auth.ts`
- Service role authentication for admin operations
- Rate limiting on public endpoints (e.g., contact form limited to 3 requests/minute)

**RPC Calls:**
- Supabase RPC for complex queries (e.g., `fetch_opportunities_with_distance`)
- Located in database functions, called via `supabase.rpc()`

---

*Integration audit: 2026-04-11*
