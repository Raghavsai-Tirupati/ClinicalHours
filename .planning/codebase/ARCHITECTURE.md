# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Multi-tier React application with role-based routing, Supabase backend integration, and lazy-loaded pages.

**Key Characteristics:**
- Client-side routing via React Router with code-splitting for performance
- Context-based authentication and authorization (student, hospital admin, super admin)
- Supabase as primary data layer with custom CSRF-protected edge function calls
- React Query (TanStack Query) for server state management
- Tailwind CSS + shadcn/ui for component styling
- TypeScript with strict types throughout
- Support for both authenticated and guest (unauthenticated) user flows

## Layers

**Presentation Layer:**
- Purpose: UI components and page layouts
- Location: `src/components/`, `src/pages/`, `src/layouts/`
- Contains: React components (TSX), page routes, layout wrappers, UI library components
- Depends on: Hooks layer, Context layer, Services layer
- Used by: Entry point (`src/App.tsx`, `src/main.tsx`)

**Hooks/State Management Layer:**
- Purpose: Custom React hooks for data fetching, auth, and component logic
- Location: `src/hooks/`
- Contains: `useAuth()` context hook, `useQuery()` hooks via TanStack Query, custom state logic
- Depends on: Services layer, Integrations layer
- Used by: Components and pages

**Services/Business Logic Layer:**
- Purpose: Data transformation, filtering, and business rules
- Location: `src/services/`, `src/lib/`
- Contains: Utility functions (`applicationFilters.ts`, `premium.ts`), data transformers, validation logic
- Depends on: Integrations layer, Types layer
- Used by: Hooks, Components

**Data/API Layer:**
- Purpose: Communication with backend and data fetching
- Location: `src/lib/api/`, `src/integrations/supabase/`
- Contains: Supabase client initialization, CSRF-protected fetch wrappers, API interceptors
- Depends on: Types layer, configuration via environment variables
- Used by: Services and Hooks

**Context/Authentication Layer:**
- Purpose: Global application state for auth and user session
- Location: `src/contexts/`, `src/hooks/useAuth.tsx`
- Contains: Auth context provider, guest session management, CSRF token handling
- Depends on: Integrations (Supabase)
- Used by: App root wrapper, all authenticated pages/components

**Types/Models Layer:**
- Purpose: TypeScript type definitions and interfaces
- Location: `src/types/`
- Contains: `Opportunity`, `SavedOpportunity`, `ApplicationStatus`, `PositionType`, database row types
- Depends on: None (foundational)
- Used by: All other layers

## Data Flow

**Initial Page Load:**

1. Entry point (`src/main.tsx`) renders App root
2. `src/App.tsx` wraps application in providers (QueryClientProvider, ThemeProvider, AuthProvider, HelmetProvider)
3. AuthProvider in `src/hooks/useAuth.tsx` initializes Supabase client and restores session
4. BrowserRouter enables client-side routing
5. Routes lazy-load pages using `lazyRetry()` wrapper (handles chunk-loading failures)
6. Guard components (`StudentOnlyRoute`, `HospitalOnlyRoute`, `AdminOnlyRoute`) enforce role-based access

**Data Fetching Flow:**

1. Component calls custom hook (e.g., `useOpportunitiesQuery()`, `useAllApplications()`)
2. Hook uses `useQuery()` from TanStack Query with Supabase select statements
3. Initial fetch calls `supabase.from(table).select(columns)...`
4. TanStack Query caches result with configurable staleTime (5 minutes default)
5. Retry logic: 2 retries with exponential backoff (up to 30 seconds)
6. Component receives `{ data, isLoading, error }` from hook
7. Fallback UI shown during loading; data displayed on success; toast shown on error

**State-Changing Operations:**

1. Component calls mutation function from service layer
2. Mutation prepares payload and calls Supabase function or direct insert/update
3. For edge functions: `invokeFunctionWithCSRF()` in `src/lib/api/interceptor.ts` wraps call
4. CSRF token fetched from `src/lib/csrf.ts` (double-submit pattern)
5. Token sent in `X-CSRF-Token` header; credentials included for cookie auth
6. On 403 CSRF error: token refreshed and request retried once
7. Response parsed and cached via TanStack Query (optimistic update pattern used in some places)
8. Toast notification displays success/error

**Authentication State:**

- User logs in via `Auth.tsx` page (email/password or OAuth)
- Supabase returns session with JWT token
- `useAuth()` hook stores session in dynamic storage (localStorage if "remember me", sessionStorage otherwise)
- CSRF token cached in memory (not localStorage to prevent XSS)
- Guest sessions: UUID v4 generated and stored in sessionStorage, tracked server-side
- Session timeout: 30 minutes of inactivity triggers logout
- Role determined by checking `hospital_pages` and admin flag in user metadata

## Key Abstractions

**useAuth Hook:**
- Purpose: Global authentication state and session management
- Examples: `src/hooks/useAuth.tsx`, exported context for use in components
- Pattern: React Context + useContext; manages Supabase session, guest mode, CSRF tokens

**Route Guards:**
- Purpose: Enforce role-based access control
- Examples: `src/components/StudentOnlyRoute.tsx`, `src/components/HospitalOnlyRoute.tsx`, `src/components/AdminOnlyRoute.tsx`
- Pattern: Wrapper components that check `useAuth()` state and redirect to `/auth` if unauthorized

**TanStack Query Hooks:**
- Purpose: Server state management for data fetching and caching
- Examples: `src/hooks/useOpportunitiesQuery.ts`, `src/hooks/useAllApplications.ts`, `src/hooks/useHospitalPageByUser.ts`
- Pattern: Custom hooks that wrap `useQuery()` with Supabase selects; provide refetch/invalidation methods

**Service Layer Utilities:**
- Purpose: Business logic decoupled from components
- Examples: `src/lib/applicationFilters.ts`, `src/lib/premium.ts`, `src/services/opportunities.ts`
- Pattern: Pure functions that transform or filter data; used by hooks and components

**UI Component Library:**
- Purpose: Reusable styled components
- Examples: `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/card.tsx`
- Pattern: shadcn/ui + Radix UI + Tailwind; imported via barrel exports

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: App load in browser
- Responsibilities: React DOM render, mount to root element

**App Root:**
- Location: `src/App.tsx`
- Triggers: main.tsx render
- Responsibilities: Provider setup (Query, Theme, Auth, Helmet), router configuration, lazy page loading, error boundary

**Page Routes:**
- Location: `src/pages/` (examples: `Home.tsx`, `Dashboard.tsx`, `Auth.tsx`)
- Triggers: Router navigation
- Responsibilities: Page-specific data fetching, layout composition, user interaction handling

**Admin Dashboard:**
- Location: `src/pages/AdminDashboard.tsx`
- Triggers: `/admin` route (requires admin role)
- Responsibilities: User management, activity logs, hospital verification, premium management

**Hospital Admin Dashboard:**
- Location: `src/components/hospital/`, `src/layouts/HospitalDashboardLayout.tsx`
- Triggers: `/hospital/:id/` or `/hospital-dashboard/` routes (requires hospital membership)
- Responsibilities: Position management, application review, candidate communication, volunteer tracking

## Error Handling

**Strategy:** Layered error handling with user-facing toasts and console logging

**Patterns:**

- **Client Errors:** Caught at component level, displayed as toast notifications via `useToast()`
- **API Errors:** Supabase errors converted to user-friendly messages in error boundary
- **Network Errors:** TanStack Query retry mechanism (2 retries); if all fail, error state in component
- **Session Errors:** Auth errors trigger automatic redirect to `/auth` page
- **CSRF Failures:** Automatic token refresh and retry (up to 1 retry in `invokeFunctionWithCSRF()`)
- **Chunk Load Failures:** `lazyRetry()` wrapper in App.tsx reloads page once, then shows error boundary
- **Boundary Fallback:** `src/components/ErrorBoundary.tsx` catches React render errors and displays fallback UI

## Cross-Cutting Concerns

**Logging:** 
- Audit logging via `src/lib/auditLogger.ts` (captures user actions for admin review)
- Console logging for development debugging
- Analytics tracking via `src/lib/tracking.ts` (page views, user interactions)

**Validation:** 
- Form validation via React Hook Form + Zod schema validation
- Input sanitization in `src/lib/inputValidation.ts` (email, phone, text cleaning)
- Server-side validation enforced by Supabase RLS policies

**Authentication:** 
- Session initialization in `useAuth()` on app load
- Guest session generation for unauthenticated access
- "Remember me" preference stored locally; otherwise cleared on tab close
- 30-minute session timeout with inactivity tracking

**Authorization:**
- Role-based route guards (Student, Hospital, Admin)
- Supabase Row Level Security (RLS) policies enforce database-level access control
- Hospital membership verified via `hospital_members` table join

**State Management:**
- Global: Auth context via `useAuth()`, Theme via `next-themes`
- Server: TanStack Query with 5-minute staleTime default
- Local: Component state via `useState()` for UI-only data (form inputs, modals, etc.)

