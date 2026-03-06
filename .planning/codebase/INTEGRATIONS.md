# Integrations

## Databases

**Supabase PostgreSQL (Primary)**
- **Project ID:** sysbtcikrbrrgafffody
- **Version:** PostgreSQL 13.0.5
- **Access:** PostgREST API via @supabase/supabase-js client
- **URL:** https://sysbtcikrbrrgafffody.supabase.co

**Primary Tables:**
- `profiles` - User profile information (id, email_verified, etc.)
- `opportunities` - Medical opportunities (hospitals, clinics, hospices, EMT services)
- `opportunities_with_ratings` - View with aggregated opportunity ratings
- `applications` - Student applications to opportunities
- `experience_entries` - Logged clinical hours and experiences
- `hospital_accounts` - Hospital organization profiles (new)
- `email_verification_tokens` - Email verification token tracking
- `discussion_votes` - Community discussion voting (upvotes/downvotes)
- `hospital_members` - Hospital staff members (new)
- Additional tables for audit logs, feedback, reviews, etc.

**Database Features:**
- Row-level security (RLS) policies for multi-tenant access control
- Stored procedures (RPC functions) for complex queries:
  - `get_opportunities_by_distance()` - Server-side distance filtering
  - `count_opportunities()` - Pagination support
  - `link_opportunity_to_hospital()` - Hospital-opportunity associations
- Views for computed data (e.g., opportunities_with_ratings)

## Authentication

**Supabase Auth**
- **Type:** JWT-based authentication with session management
- **Methods:** Email/password, magic links, OAuth (configured but details not shown)
- **Session Storage:** Dynamic adapter (localStorage when "remember me" enabled, sessionStorage otherwise)
- **Token Persistence:** Auto-refresh enabled, session detection from URL
- **Security Features:**
  - httpOnly cookies for token storage (via auth-cookie edge function)
  - CSRF token injection for state-changing requests
  - Session timeout: 30 minutes of inactivity
  - Rate limiting: 3 verification emails per user per hour
  - Origin validation on all edge function calls

**Authentication Edge Functions:**
- `auth-cookie` - Exchange JWT for httpOnly session cookie
- `csrf-token` - Generate and return CSRF tokens
- `restore-session` - Restore user session from httpOnly cookie
- `logout` - Clear session cookies and log out
- `send-verification-email` - Send email verification link (Resend API)
- `verify-email` - Verify email tokens and update profile status
- `send-password-reset` - Send password reset link (Resend API)
- `reset-password` - Process password reset with token validation

**User Types:**
- Authenticated students/healthcare professionals
- Hospital account administrators
- Platform administrators (super users)
- Guest users (browse opportunities without login)

## External APIs

**Resend (Email Service)**
- **API Key:** RESEND_API_KEY (environment variable)
- **Purpose:** Transactional emails
- **Use Cases:**
  - Email verification during signup
  - Password reset emails
  - Contact form notifications
  - Application status notifications
  - Mass email campaigns (admin tool)
  - Hospital approval/rejection notifications
  - Appointment reminders

**Mapbox (Maps & Geolocation)**
- **Public Token:** [REDACTED — stored in VITE_MAPBOX_PUBLIC_TOKEN env var]
- **Environment Variable:** VITE_MAPBOX_PUBLIC_TOKEN
- **Features:**
  - Interactive map visualization of healthcare opportunities
  - Marker clustering by opportunity type
  - Popup details on marker click
  - Circle radius filtering (1, 5, 10, 25, 50, 100, 200 miles)
  - Custom pin placement (user can pin custom location)
  - User geolocation via navigator.geolocation API
  - Distance-based sorting of opportunities
- **API Endpoints:**
  - Map tiles: https://*.tiles.mapbox.com
  - API: https://api.mapbox.com
  - Events: https://events.mapbox.com

**OpenStreetMap Nominatim (Geocoding)**
- **Purpose:** City search and reverse geocoding
- **Rate Limit:** 1 request per second
- **API Endpoint:** https://nominatim.openstreetmap.org
- **Use Cases:**
  - City autocomplete in location search
  - Address to coordinates conversion
  - Coordinates to address conversion
- **Features:** Address details parsing (city, state, country)

## File Storage / CDN

**Supabase Storage**
- Integrated with PostgreSQL backend
- Resume file uploads for applications (resume_url in applications table)
- No explicit CDN configured in code; uses Supabase's built-in file serving
- CSP allows image loading from: data:, blob:, Supabase domain (*.supabase.co)

**Storage Providers in CSP:**
- Google Cloud Storage (https://storage.googleapis.com) - Lovable Cloud assets
- Cloudflare R2 (https://*.r2.dev) - Additional CDN support
- Mapbox tiles: https://*.tiles.mapbox.com

## Email / Notifications

**Email Service (Resend)**
- Fully integrated via Supabase Edge Functions
- Email sending functions:
  - `send-verification-email` - User signup email verification
  - `send-password-reset` - Password recovery emails
  - `send-contact-email` - Contact form notifications to admin
  - `send-mass-email` - Bulk email campaigns for administrators
  - `send-reminders` - Automated reminder emails (scheduled via cron)
  - `notify-application-status` - Application decision notifications

**Toast Notifications (Client-side)**
- **Library:** Sonner 1.7.4
- **Purpose:** In-app user feedback messages
- **Types:** Success, error, info, warning states

**Analytics & Tracking**
- **Service:** Custom tracking edge function
- **Event Types:** page_view, button_click, guest_conversion, signup, login
- **Storage:** Custom tracking events table in Supabase
- **Rate Limiting:** 60 events per minute per session
- **Client Tracking Library:** Custom `tracking.ts` utility
- **Session Tracking:** UUID-based session IDs (localStorage: clinicalhours_tracking_session_id)
- **Data Collected:**
  - Session ID, event type, page URL, referrer URL
  - User agent, screen dimensions, timezone
  - User ID (if authenticated), custom metadata
  - Device/browser information
- **Disabled by Default:** In development unless VITE_ENABLE_TRACKING=true
- **Edge Function:** `track` endpoint at /functions/v1/track

## Other Services

**Hospital Account Management**
- Hospital onboarding and signup via `hospital-signup` edge function
- Hospital profile management (new integration)
- Hospital staff member management (new integration)
- Hospital approval workflow by administrators:
  - `hospital-review` edge function for approval/rejection
  - Admin notifications on status changes
  - Notes and reason tracking for rejections

**Data Import Tools (Administrative)**
- CSV hospital import via `import-csv-hospitals` edge function
- Texas hospital data import via `import-texas-hospitals` edge function
- Bulk opportunity-to-hospital linking via RPC function
- Duplicate hospital record removal via `remove-duplicates` edge function
- Coordinate fixing for map accuracy via `fix-coordinates` edge function
- Missing state/location data population via `fix-missing-states` edge function

**Content Search & Discovery**
- City search with Nominatim (autocomplete)
- Opportunity full-text search (name, location via ilike patterns)
- Search filtering by opportunity type (hospital, clinic, hospice, emt)
- Pagination support (limit, offset parameters)

**Security & Validation**
- **Origin Validation:** All edge functions validate request origin
- **Rate Limiting:** Per-user and per-session rate limiting
- **Input Sanitization:** Search term and query parameter validation
- **CSRF Protection:** Token validation on state-changing requests
- **JWT Validation:** Optional JWT verification on edge functions (configurable per function)

**Admin Tools**
- `admin-get-users` - Retrieve paginated user list
- `admin-get-user-profile` - Fetch detailed user profile and statistics
- Guest session statistics tracking
- Hospital management dashboard
- Pending approval review interface
- Tools for email campaigns and system management

**Database Scripts & Migrations**
- Supabase migrations directory for schema versioning
- TypeScript data import scripts:
  - importHospitals.ts - Hospital CSV import
  - import-texas-hospitals.ts - Texas-specific hospital data
  - remove-duplicates.ts - Data quality cleanup
  - fix-map-coordinates.ts - Coordinate accuracy
  - discoverFields.ts - CSV field mapping discovery
- Seed data script: seed_hospital.sql

**Audit & Logging**
- Custom audit logger utility (`auditLogger.ts`)
- Authentication event logging (signup, login, logout)
- Admin action tracking
- Data modification audit trails (in database)

**Monitoring & Health**
- Platform health statistics (users, opportunities, applications)
- Guest session monitoring
- Application status tracking by type and stage
