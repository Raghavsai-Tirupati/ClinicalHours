# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
ClinicalHours/
├── src/                           # Application source code
│   ├── main.tsx                   # React DOM entry point
│   ├── App.tsx                    # Root app component with routing
│   ├── index.css                  # Global Tailwind + custom styles
│   │
│   ├── pages/                     # Page components (lazy-loaded routes)
│   │   ├── Home.tsx               # Landing page
│   │   ├── Auth.tsx               # Login/signup
│   │   ├── Dashboard.tsx          # Student dashboard
│   │   ├── Opportunities.tsx      # Browse opportunities list
│   │   ├── OpportunityDetail.tsx  # Single opportunity detail
│   │   ├── Settings.tsx           # User settings/profile
│   │   ├── AdminDashboard.tsx     # Admin control panel
│   │   ├── HospitalAdmin.tsx      # Hospital admin page (legacy)
│   │   ├── HospitalApplyPage.tsx  # Apply to position form
│   │   ├── PositionApplyPage.tsx  # Apply to specific position
│   │   ├── MyApplications.tsx     # Student's applications list
│   │   ├── Premium.tsx            # Premium features landing
│   │   ├── PremiumPurchase.tsx    # Checkout page
│   │   ├── HourTracker.tsx        # Track volunteering hours
│   │   ├── LORTracker.tsx         # Letter of recommendation tracker
│   │   ├── AMCASGenerator.tsx     # AMCAS application helper
│   │   ├── MapView.tsx            # Map of opportunities
│   │   └── [20+ more premium feature pages]
│   │
│   ├── components/                # Reusable React components
│   │   ├── ui/                    # shadcn/ui + Radix UI components
│   │   │   ├── button.tsx         # Button component
│   │   │   ├── dialog.tsx         # Modal dialog
│   │   │   ├── input.tsx          # Text input
│   │   │   ├── card.tsx           # Card container
│   │   │   ├── [30+ more UI components]
│   │   │
│   │   ├── admin/                 # Admin-only components
│   │   │   ├── AdminDuplicateHospitals.tsx
│   │   │   ├── AdminHospitalsTab.tsx
│   │   │   ├── AdminUserList.tsx
│   │   │   ├── AdminPremiumTab.tsx
│   │   │   ├── GuestSessionsTab.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   └── [more admin tabs]
│   │   │
│   │   ├── hospital/              # Hospital admin components
│   │   │   ├── PositionsHub.tsx   # Manage positions
│   │   │   ├── PositionForm.tsx   # Create/edit position
│   │   │   ├── PositionDetail.tsx # View position applications
│   │   │   ├── ApplicationsHub.tsx# List all applications
│   │   │   ├── ApplicantProfilePage.tsx
│   │   │   ├── InterviewsPage.tsx
│   │   │   └── [more hospital pages]
│   │   │
│   │   ├── clinic-dashboard/      # Hospital-specific dashboard
│   │   │   ├── applications/      # Application management
│   │   │   │   ├── ApplicantDocuments.tsx
│   │   │   │   ├── ApplicationNotesPanel.tsx
│   │   │   │   └── ResumeScoreBadge.tsx
│   │   │   ├── email-communication/
│   │   │   │   ├── EmailCommunication.tsx
│   │   │   │   ├── BulkEmailDialog.tsx
│   │   │   │   └── EmailTemplates.tsx
│   │   │   ├── volunteer-management/
│   │   │   │   ├── VolunteerManagement.tsx
│   │   │   │   └── FileSystem.tsx
│   │   │   └── waitlist/
│   │   │       └── WaitlistModule.tsx
│   │   │
│   │   ├── dashboard/             # Dashboard-specific components
│   │   │   ├── StatCard.tsx
│   │   │   ├── OpportunityCard.tsx
│   │   │   └── ReflectionBlock.tsx
│   │   │
│   │   ├── application/           # Application form components
│   │   │   ├── DocumentUpload.tsx
│   │   │   └── SchedulingQuestionsForm.tsx
│   │   │
│   │   ├── layout/                # Shared layout components
│   │   │   ├── Navigation.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Breadcrumbs.tsx
│   │   │
│   │   ├── StudentOnlyRoute.tsx    # Auth guard for students
│   │   ├── HospitalOnlyRoute.tsx   # Auth guard for hospital admins
│   │   ├── AdminOnlyRoute.tsx      # Auth guard for super admins
│   │   ├── ErrorBoundary.tsx       # Error boundary wrapper
│   │   └── [30+ more components]
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.tsx            # Global auth context + session mgmt
│   │   ├── useAuthCheck.ts        # Check if user is authenticated
│   │   ├── useAdminCheck.ts       # Check if user is admin
│   │   ├── useHospitalAccount.ts  # Hospital membership check
│   │   ├── useHospitalPage.ts     # Get hospital page by ID
│   │   ├── useHospitalPageByUser.ts # Get hospital pages for current user
│   │   ├── useOpportunitiesQuery.ts # Fetch opportunities (cached)
│   │   ├── useOpportunities.ts    # Fetch + search opportunities
│   │   ├── useAllApplications.ts  # Fetch all applications
│   │   ├── usePositionApplications.ts
│   │   ├── usePremiumStatus.ts    # Check premium subscription
│   │   ├── useActivityLog.ts      # Fetch audit logs
│   │   ├── useAutoSave.tsx        # Auto-save form data
│   │   ├── useAutoSaveProfile.ts  # Auto-save profile changes
│   │   ├── useDebounce.ts         # Debounce hook
│   │   ├── useDebouncedCallback.ts
│   │   ├── useInView.ts           # Intersection observer
│   │   └── [20+ more hooks]
│   │
│   ├── contexts/                  # React contexts (global state)
│   │   └── HospitalPageContext.tsx # Hospital page context
│   │
│   ├── layouts/                   # Page layout wrappers
│   │   └── HospitalDashboardLayout.tsx # Sidebar layout for hospital admin
│   │
│   ├── integrations/              # External service integrations
│   │   └── supabase/
│   │       ├── client.ts          # Supabase client init + custom fetch
│   │       └── types.ts           # Database schema types (auto-generated)
│   │
│   ├── lib/                       # Utility functions and services
│   │   ├── api/
│   │   │   ├── interceptor.ts     # CSRF-protected fetch wrapper
│   │   │   ├── adminAnalytics.ts  # Admin stats queries
│   │   │   └── citySearch.ts      # City autocomplete API
│   │   │
│   │   ├── data/
│   │   │   ├── [seed data files]
│   │   │
│   │   ├── applicationFilters.ts  # Filter + search opportunities
│   │   ├── applicationStatus.ts   # Application status utilities
│   │   ├── auditLogger.ts         # Log user actions
│   │   ├── authCookie.ts          # Cookie-based auth helpers
│   │   ├── csrf.ts                # CSRF token management
│   │   ├── errorUtils.ts          # Error handling utilities
│   │   ├── geolocation.ts         # Get user location
│   │   ├── guestMigration.ts      # Guest to auth migration
│   │   ├── inputValidation.ts     # Form input validation
│   │   ├── localStore.ts          # localStorage abstraction
│   │   ├── logger.ts              # Console logging
│   │   ├── premium.ts             # Premium feature checks
│   │   ├── rateLimit.ts           # Rate limiting logic
│   │   ├── toastHelpers.ts        # Toast notification helpers
│   │   ├── tracking.ts            # Analytics tracking
│   │   └── utils.ts               # Misc utilities
│   │
│   ├── services/                  # Business logic layer
│   │   ├── opportunities.ts       # Opportunity service
│   │   └── savedOpportunities.ts  # Saved opportunities service
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── index.ts               # Main types (Opportunity, SavedOpportunity, etc.)
│   │   └── positions.ts           # Position types (PositionType, ApplicationStatus, etc.)
│   │
│   └── assets/                    # Static assets (images, icons, fonts)
│
├── public/                        # Static files served as-is
│   └── [images, favicons]
│
├── supabase/                      # Supabase configuration
│   ├── functions/                 # Edge function code
│   └── migrations/                # Database migrations
│
├── scripts/                       # Node scripts
│   ├── import-texas-hospitals.ts
│   ├── import-hospitals.ts
│   ├── remove-duplicates.ts
│   ├── fix-map-coordinates.ts
│   └── discoverFields.ts
│
├── package.json                   # Dependencies + npm scripts
├── vite.config.ts                 # Vite bundler config
├── tsconfig.json                  # TypeScript config
├── tailwind.config.js             # Tailwind CSS config
├── postcss.config.js              # PostCSS config
├── eslint.config.js               # ESLint rules
├── components.json                # shadcn/ui config
├── index.html                     # HTML entry point
└── dist/                          # Build output (generated)
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Page-level components matching routes in `src/App.tsx`
- Contains: One component per route; handles data fetching for the page; composes smaller components
- Key files: `Home.tsx`, `Dashboard.tsx`, `Auth.tsx`, `AdminDashboard.tsx`, premium feature pages

**`src/components/`:**
- Purpose: Reusable UI components and feature-specific component trees
- Contains: React components, organized by feature (admin, hospital, dashboard, etc.)
- Key files: `ui/` for design system, `hospital/` for hospital admin features, `admin/` for super admin

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching and stateful logic
- Contains: `useQuery()` wrappers via TanStack Query, context hooks, validation hooks
- Pattern: Each hook exports a single primary hook; may export utility functions

**`src/lib/`:**
- Purpose: Utility functions, validators, and business logic
- Contains: Pure functions (filters, transformers), API interceptors, logging, validation rules
- Organized by concern: `api/` for server communication, `data/` for seed data

**`src/integrations/supabase/`:**
- Purpose: Supabase client initialization and database types
- Contains: `client.ts` (singleton Supabase client), `types.ts` (auto-generated database schema)
- Key detail: Dynamic storage adapter (localStorage vs sessionStorage based on "remember me" pref)

**`src/types/`:**
- Purpose: Central TypeScript type definitions
- Contains: `index.ts` (Opportunity, SavedOpportunity, Question, Answer, Review)
- Contains: `positions.ts` (PositionType, ApplicationStatus, QuestionType)

**`src/components/ui/`:**
- Purpose: Reusable UI library components (shadcn/ui + Radix)
- Contains: Button, Dialog, Input, Card, Select, Tabs, Toast, etc.
- Pattern: Each component is a self-contained file; imported via barrel exports in parent dirs

**`src/components/admin/`:**
- Purpose: Admin-only dashboard components
- Contains: Tab components (AdminHospitalsTab, AdminUserList, etc.), activity feed, monitoring tools

**`src/components/hospital/`:**
- Purpose: Hospital admin dashboard features
- Contains: Position management (PositionsHub, PositionForm), application review, candidate profiles

**`src/components/clinic-dashboard/`:**
- Purpose: Nested hospital features (applications, email, volunteer tracking)
- Organized by feature: `applications/`, `email-communication/`, `volunteer-management/`, `waitlist/`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM render entry point
- `src/App.tsx`: Root app component with routing and providers
- `index.html`: HTML document shell

**Configuration:**
- `package.json`: Dependencies, scripts, project metadata
- `vite.config.ts`: Vite bundler (dev server, build output)
- `tsconfig.json`: TypeScript compiler options
- `tailwind.config.js`: Tailwind CSS theme customization
- `components.json`: shadcn/ui component registry
- `eslint.config.js`: Linting rules

**Core Logic:**
- `src/hooks/useAuth.tsx`: Authentication context (global state)
- `src/integrations/supabase/client.ts`: Supabase client singleton
- `src/lib/api/interceptor.ts`: CSRF-protected fetch wrapper
- `src/types/index.ts`: Main type definitions

**Testing:**
- `src/components/admin/__tests__/AdminUserProfile.utils.test.ts`: Example test file

## Naming Conventions

**Files:**
- Page components: PascalCase with ".tsx" (e.g., `Dashboard.tsx`, `Home.tsx`)
- Components: PascalCase with ".tsx" (e.g., `Button.tsx`, `Navigation.tsx`)
- Hooks: camelCase starting with "use", with ".ts" or ".tsx" (e.g., `useAuth.tsx`, `useQuery.ts`)
- Utilities/services: camelCase with ".ts" (e.g., `applicationFilters.ts`, `auditLogger.ts`)
- Contexts: PascalCase with ".tsx" (e.g., `HospitalPageContext.tsx`)

**Directories:**
- Feature-based grouping: lowercase with hyphens (e.g., `clinic-dashboard`, `email-communication`)
- Type categories: lowercase (e.g., `components`, `hooks`, `lib`, `types`)

**Variables/Functions:**
- Constants: UPPER_SNAKE_CASE (e.g., `SESSION_TIMEOUT_MS`, `REMEMBER_ME_KEY`)
- Functions/hooks: camelCase (e.g., `getGuestSessionId()`, `lazyRetry()`)
- React components: PascalCase (e.g., `Dashboard`, `Navigation`)
- Types/interfaces: PascalCase (e.g., `Opportunity`, `SavedOpportunity`)

## Where to Add New Code

**New Page/Route:**
- Create file: `src/pages/MyNewPage.tsx`
- Add route in `src/App.tsx`: `const MyNewPage = lazyRetry(() => import("./pages/MyNewPage"));` + route definition
- Follow pattern: Import hooks, fetch data, render layout + components

**New Component:**
- If UI-only: `src/components/ui/MyComponent.tsx` (simple, no logic)
- If feature-specific: `src/components/[feature]/MyComponent.tsx` (e.g., `src/components/hospital/MyHospitalComponent.tsx`)
- If used across app: `src/components/MySharedComponent.tsx` (e.g., `Navigation.tsx`, `Breadcrumbs.tsx`)

**New Hook:**
- Location: `src/hooks/useMyHook.ts` (or `.tsx` if it returns JSX)
- If it wraps `useQuery()`: Place in `src/hooks/`, follow pattern of `useOpportunitiesQuery.ts`
- Export as default or named export; document parameters and return type

**New Service/Utility:**
- Simple transformation: `src/lib/myUtility.ts` (e.g., `applicationFilters.ts`)
- Business logic: `src/services/myService.ts` (e.g., `opportunities.ts`)
- API-specific: `src/lib/api/myAPI.ts` (e.g., `interceptor.ts`)

**New Type:**
- Add to `src/types/index.ts` if general (Opportunity, SavedOpportunity, Question, etc.)
- Add to `src/types/positions.ts` if position/application specific (PositionType, ApplicationStatus, etc.)
- For domain-specific types: can create new file `src/types/myDomain.ts`

**Styling:**
- Global styles: `src/index.css` (Tailwind + custom utilities)
- Component styles: Use Tailwind className attribute (no separate CSS files)
- shadcn/ui components: Tailwind classes built-in; extend via `tailwind.config.js`

## Special Directories

**`src/assets/`:**
- Purpose: Static assets (images, icons, fonts)
- Generated: No
- Committed: Yes

**`src/components/ui/`:**
- Purpose: Design system components (shadcn/ui + Radix UI)
- Generated: No (maintained manually, though scaffolded via `shadcn-ui` CLI)
- Committed: Yes

**`dist/`:**
- Purpose: Built output from Vite
- Generated: Yes (via `npm run build`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install` from `package-lock.json`)
- Committed: No (in `.gitignore`)

**`supabase/`:**
- Purpose: Supabase configuration and edge functions
- Generated: Partially (migrations auto-generated, functions manually written)
- Committed: Yes

**`.env` files:**
- Purpose: Environment variables (Supabase URL, keys, etc.)
- Generated: No (user-provided)
- Committed: No (in `.gitignore` for security)
- Note: Supabase keys are public (VITE_SUPABASE_*); no secrets stored in this repo

