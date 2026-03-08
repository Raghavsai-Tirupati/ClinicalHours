# Architecture

## Pattern
**React SPA with Vite** - Modern single-page application using React 18.3, TypeScript, and Vite as the build tool. Heavy use of component-based architecture with UI kit integration (shadcn/ui via Radix UI). Dark theme enforced.

## Entry Points

### Application Entry
- **`src/main.tsx`** - React DOM root initialization, imports fonts and renders App component
- **`src/App.tsx`** - Main application wrapper with routing, providers, and error boundaries
  - BrowserRouter from react-router-dom
  - QueryClientProvider (TanStack React Query)
  - ThemeProvider (next-themes - dark theme enforced)
  - HelmetProvider (react-helmet-async for document metadata)
  - ErrorBoundary wrapper

### Routing (Client-Side)
- **App.tsx** defines all routes using react-router-dom
- Pages are lazy-loaded with React.lazy() for code splitting
- 20+ routes including:
  - Public: `/`, `/opportunities`, `/opportunities/:slug`, `/projects`, `/contact`, `/auth`, `/terms`, `/privacy`, `/map`
  - User: `/profile`, `/dashboard`
  - Hospital: `/hospital-dashboard`, `/opportunities/:slug/application`, `/opportunities/:slug/admin`
  - Admin: `/admin`, `/admin` (dashboard with tabs)
  - Auth flows: `/check-email`, `/verify-email`, `/verify`, `/reset-password`
  - Utility: `/test-headers`, `/auth-test`, `/pending-approval`, `*` (404)

### Build Configuration
- **`vite.config.ts`** - Build configuration with security headers, CSP policy, chunk optimization
- **`tsconfig.json`** - TypeScript configuration with path alias `@/*` mapping to `./src/*`
- **`index.html`** - HTML entry point with `<div id="root"></div>`

## Layers

### Layer 1: Presentation (Pages & Components)
- **`src/pages/`** - Page-level components (lazy-loaded)
  - Home, Opportunities, OpportunityDetail, Projects, Contact
  - Auth, Profile, Dashboard, MapView
  - AdminDashboard, HospitalAdmin, HospitalDashboard, ApplicationForm
  - Terms, Privacy, NotFound, etc.

- **`src/components/`** - Reusable UI components
  - **`ui/`** - Base UI components from shadcn/ui (Button, Dialog, Form, Input, Card, etc.)
  - **`admin/`** - Admin-specific components (AdminOverviewTab, AdminHospitalsTab, AdminPendingApprovalsTab, AdminToolsTab, AdminUserList, AdminUserProfile, GuestSessionStats)
  - **`tutorial/`** - Tutorial components
  - General components: Navigation, Footer, ErrorBoundary, ScrollToTop, HeroBanner, ExperienceBuilder, etc.

### Layer 2: Hooks (State & Side Effects)
- **`src/hooks/`** - Custom React hooks
  - **Auth & Access**: `useAuth()`, `useAdminCheck()`, `useHospitalAccount()`, `useHospitalMember()`
  - **Data Fetching**: `useOpportunities()`, `useOpportunitiesQuery()`
  - **Form & Input**: `useAutoSave()`, `useAutoSaveProfile()`, `useDebounce()`, `useDebouncedCallback()`
  - **UI**: `useInView()`, `use-mobile()`, `use-toast()`
  - **Profile**: `useProfileComplete()`

Key pattern: Hooks manage local state, side effects, and integration with external services. `useAuth()` is central for authentication flow.

### Layer 3: Services (Business Logic & Data Access)
- **`src/services/`** - Centralized business logic and data fetching
  - **`opportunities.ts`** - Fetch, filter, search, and distance-sort opportunities
  - **`savedOpportunities.ts`** - Manage user's saved opportunities

Pattern: Services encapsulate Supabase queries and return standardized result objects with `{ data, error, count }` shape.

### Layer 4: API & Data Integration
- **`src/integrations/supabase/`** - Supabase client setup
  - **`client.ts`** - Supabase client initialization with custom storage adapter (localStorage vs sessionStorage based on "remember me" preference), CSRF token handling, custom fetch interceptor
  - **`types.ts`** - Supabase type definitions

- **`src/lib/api/`** - Additional API utilities
  - **`citySearch.ts`** - City autocomplete via external API
  - **`interceptor.ts`** - HTTP request/response interceptor

### Layer 5: Utilities & Configuration
- **`src/lib/`** - Utility functions and helpers
  - **`auditLogger.ts`** - Audit logging for auth events
  - **`authCookie.ts`** - Cookie-based session persistence (exchange JWT for HttpOnly cookie)
  - **`calendar.ts`** - Calendar utilities
  - **`csrf.ts`** - CSRF token generation and validation
  - **`errorUtils.ts`** - Error handling utilities
  - **`geolocation.ts`** - Browser geolocation API wrapper
  - **`GlobeTransitionManager.ts`** - 3D globe animation management
  - **`inputValidation.ts`** - Form input validation
  - **`logger.ts`** - Console logging with environment checks
  - **`rateLimit.ts`** - Client-side rate limiting
  - **`toastHelpers.ts`** - Toast notification helpers
  - **`tracking.ts`** - Analytics/event tracking
  - **`utils.ts`** - General utility functions

- **`src/lib/data/`** - Static lookup data
  - `graduationYears.ts`, `majors.ts`, `universities.ts`, `usStates.ts`

### Layer 6: Types
- **`src/types/index.ts`** - Centralized TypeScript definitions
  - Core: `Opportunity`, `SavedOpportunity`, `Question`, `Answer`, `Review`, `UserLocation`
  - Error handling: `SupabaseError`, `ErrorDetails`
  - Utility: `PaginationOptions`, `SearchOptions`, `OpportunityRow`

## Data Flow

### Authentication Flow
1. User navigates to `/auth`
2. `Auth` page component renders sign-up/login forms
3. `useAuth()` hook manages auth state (user, session, loading)
4. Supabase client in `src/integrations/supabase/client.ts` handles OTP/password auth
5. Session stored in localStorage (if "remember me") or sessionStorage
6. CSRF token generated via `src/lib/csrf.ts` and exchanged for HttpOnly cookie via `src/lib/authCookie.ts`
7. User redirected to `/dashboard` upon successful auth
8. Subsequent requests include CSRF token via custom fetch interceptor

### Opportunity Data Flow
1. User navigates to `/opportunities` or `/map`
2. `Opportunities` or `MapView` page component mounts
3. Component calls `useOpportunitiesQuery()` hook
4. Hook calls `fetchOpportunities()` from `src/services/opportunities.ts`
5. Service queries Supabase `opportunities_with_ratings` table
6. Results fetched with filters (type, search, distance)
7. Data mapped to `Opportunity` type
8. Component renders UI with data
9. User can save opportunities → triggers `savedOpportunities` service → Supabase insert

### Profile Update Flow
1. User navigates to `/profile`
2. `Profile` component displays form with current data
3. User edits fields
4. `useAutoSaveProfile()` hook auto-saves changes with debounce
5. `supabase.from('profiles').update()` persists data
6. Success/error toast displayed

### Admin Dashboard Flow
1. Admin navigates to `/admin`
2. `AdminDashboard` page loads (access protected by `useAdminCheck()`)
3. Renders tabbed interface:
   - Overview: `AdminOverviewTab` - platform health stats
   - Students: `AdminUserList` - users with detail drawer `AdminUserProfile`
   - Hospitals: `AdminHospitalsTab` - hospital management
   - Pending Approvals: `AdminPendingApprovalsTab` - approve/reject hospital applications
   - Tools: `AdminToolsTab` - admin utilities
4. Tab components fetch data via Supabase queries
5. Admin actions (approve, reject, delete) trigger mutations
6. Toast notifications confirm actions

## Key Abstractions

### Custom Hooks Pattern
Hooks encapsulate complex state logic:
- `useAuth()` - Single source of truth for auth state with session timeout
- `useOpportunitiesQuery()` - TanStack React Query wrapper around `fetchOpportunities`
- `useAutoSave()` - Generic auto-save with debounce for forms

### Supabase Integration Pattern
- Centralized client in `src/integrations/supabase/client.ts`
- Custom storage adapter based on "remember me" preference
- CSRF token injection via custom fetch
- Services act as business logic layer over Supabase queries

### ErrorBoundary & Error Handling
- `ErrorBoundary` component wraps entire app
- Catches React errors and displays fallback UI
- `errorUtils.ts` provides error serialization and logging

### Lazy Loading & Code Splitting
- All pages lazy-loaded with React.lazy()
- `PageLoader` component shown during load
- Vite configured with manual chunk splitting for vendors and large components

### Toast Notifications
- `sonner` library for notifications (dark theme compatible)
- Unified toast helpers in `src/lib/toastHelpers.ts`
- Accessible via `use-toast()` hook or direct `toast` function

### Theme Management
- `next-themes` provider with dark theme forced
- Class-based theming (Tailwind CSS)
- Theme context available to all components

## State Management

### Client-Side State
**React Query (TanStack React Query)**
- Primary pattern for server state (opportunities, reviews, etc.)
- Configured with default retry (2x) and stale time (5 min)
- Caching, background refetching, and synchronization built-in
- Used in `useOpportunitiesQuery()` hook

**Local Component State**
- useState() for UI state (form inputs, modals, tabs, filters)
- useCallback() for memoized event handlers
- Kept minimal to avoid prop drilling

**Custom Hooks**
- `useAuth()` returns `{ user, session, loading, error }`
- Manages session persistence via Supabase client
- Handles session timeout (30 min inactivity)

### Server State (Supabase)
- Real-time subscriptions possible via Supabase PostgREST
- Mutations via `supabase.from(table).insert/update/delete()`
- RPC calls for complex operations (e.g., distance-sorted queries)

### Caching Strategy
- React Query handles HTTP caching
- localStorage/sessionStorage for auth tokens (dynamic per "remember me" setting)
- Opportunity prefetch utilities in `src/lib/opportunityPrefetch.ts`

## Security Measures

### Authentication & Session
- Email/password auth via Supabase
- OTP for email verification
- JWT tokens with automatic refresh
- Session timeout: 30 minutes inactivity
- HttpOnly cookie for sensitive tokens
- CSRF token generation and validation

### Request Protection
- Custom fetch interceptor adds CSRF tokens to state-changing requests
- Credentials mode for edge functions
- Request validation in services

### Content Security Policy (CSP)
- Configured in vite.config.ts
- Restricts script execution to `'self'` and `'unsafe-inline'` (React requirement)
- Blocks inline event handlers
- Allows Supabase, Mapbox, OpenStreetMap APIs

### Data Validation
- Input validation in `src/lib/inputValidation.ts`
- Zod for form schema validation
- Type safety via TypeScript

### Error Logging
- Audit logging for auth events via `src/lib/auditLogger.ts`
- Error context captured and logged
- No sensitive data logged to console in production

## Performance Optimizations

### Build Time
- Vite for fast development and production builds
- Manual chunk splitting for vendors and large components
- React SWC compiler for fast transpilation

### Runtime
- Code splitting via lazy loading
- React Query caching and background sync
- Debounced input (search, form updates)
- Intersection Observer for lazy rendering (useInView hook)
- Memoization of components and callbacks

### Bundle Size
- Tree-shaking enabled
- Only necessary Radix UI components imported
- Self-hosted fonts (no external CDN)
- Asset inlining for small files (<4KB)
