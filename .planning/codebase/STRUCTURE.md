# Structure

## Directory Layout

```
ClinicalHours/
├── src/
│   ├── main.tsx                          # React DOM entry point
│   ├── App.tsx                           # App root, routing, providers
│   ├── App.css                           # Global styles (minimal, mostly Tailwind)
│   ├── index.css                         # Tailwind imports and CSS resets
│   ├── assets/                           # Images and static assets
│   │   ├── auth-background.png
│   │   └── carousel-bg.png
│   ├── pages/                            # Page components (lazy-loaded)
│   │   ├── Home.tsx
│   │   ├── Opportunities.tsx
│   │   ├── OpportunityDetail.tsx
│   │   ├── Projects.tsx
│   │   ├── Contact.tsx
│   │   ├── Auth.tsx
│   │   ├── Profile.tsx
│   │   ├── Dashboard.tsx
│   │   ├── MapView.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminHospitals.tsx
│   │   ├── ApplicationForm.tsx
│   │   ├── HospitalAdmin.tsx
│   │   ├── HospitalDashboard.tsx
│   │   ├── HospitalOnboarding.tsx
│   │   ├── HospitalAuth.tsx
│   │   ├── HospitalApply.tsx
│   │   ├── HospitalProfile.tsx
│   │   ├── Terms.tsx
│   │   ├── Privacy.tsx
│   │   ├── CheckEmail.tsx
│   │   ├── VerifyEmail.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── PendingApproval.tsx
│   │   ├── TestHeaders.tsx
│   │   ├── AuthTest.tsx
│   │   └── NotFound.tsx
│   ├── components/                       # Reusable components
│   │   ├── admin/                        # Admin-specific components
│   │   │   ├── AdminOverviewTab.tsx      # Dashboard overview with stats
│   │   │   ├── AdminHospitalsTab.tsx     # Hospital management
│   │   │   ├── AdminPendingApprovalsTab.tsx  # Approve/reject flow
│   │   │   ├── AdminToolsTab.tsx         # Admin utilities
│   │   │   ├── AdminUserList.tsx         # User list with search/filter
│   │   │   ├── AdminUserProfile.tsx      # User detail drawer
│   │   │   └── GuestSessionStats.tsx     # Guest analytics
│   │   ├── tutorial/                     # Tutorial components (onboarding)
│   │   ├── ui/                           # shadcn/ui base components
│   │   │   ├── button.tsx, dialog.tsx, form.tsx, input.tsx, card.tsx
│   │   │   ├── select.tsx, badge.tsx, tabs.tsx, drawer.tsx
│   │   │   ├── combobox.tsx, command.tsx, calendar.tsx, toast.tsx
│   │   │   ├── sonner.tsx, popover.tsx, tooltip.tsx, etc.
│   │   ├── Navigation.tsx                # Header/navbar
│   │   ├── Footer.tsx                    # Footer
│   │   ├── ErrorBoundary.tsx             # Error boundary wrapper
│   │   ├── ScrollToTop.tsx               # Scroll-to-top on route change
│   │   ├── ExperienceBuilder.tsx         # Build clinical experience
│   │   ├── ExperienceCard.tsx            # Experience display card
│   │   ├── AddMomentDialog.tsx           # Add experience moment dialog
│   │   ├── OpportunityMap.tsx            # Mapbox map component
│   │   ├── DashboardPreview.tsx          # Dashboard preview
│   │   ├── DashboardVideoCarousel.tsx    # Video carousel
│   │   ├── HeroBanner.tsx, HeroVideoCarousel.tsx, HeroBrowserCarousel.tsx
│   │   ├── FeatureShowcase.tsx, FeatureShowcaseRail.tsx, FeatureGrid.tsx
│   │   ├── HowItWorksTimeline.tsx        # Timeline component
│   │   ├── HomeGlobe.tsx                 # 3D globe animation
│   │   ├── Breadcrumbs.tsx               # Navigation breadcrumbs
│   │   ├── AnimatedCounter.tsx           # Counter animation
│   │   ├── AsyncSearchInput.tsx          # Async search with debounce
│   │   ├── AutocompleteCombobox.tsx      # Combobox with autocomplete
│   │   ├── AutocompleteInput.tsx         # Input with autocomplete
│   │   ├── CityAutocomplete.tsx          # City search autocomplete
│   │   ├── DatalistInput.tsx             # Datalist-based input
│   │   ├── GuestGate.tsx                 # Guest mode gate component
│   │   ├── OpportunitiesList.tsx         # Opportunities list view
│   │   └── [60+ more components]         # Various feature components
│   ├── hooks/                            # Custom React hooks
│   │   ├── useAuth.tsx                   # Auth state management
│   │   ├── useAdminCheck.ts              # Admin access check
│   │   ├── useHospitalAccount.ts         # Hospital account info
│   │   ├── useHospitalMember.ts          # Hospital member check
│   │   ├── useOpportunities.ts           # Opportunities data
│   │   ├── useOpportunitiesQuery.ts      # React Query wrapper
│   │   ├── useAutoSave.tsx               # Auto-save form data
│   │   ├── useAutoSaveProfile.ts         # Profile auto-save
│   │   ├── useDebounce.ts                # Debounce values
│   │   ├── useDebouncedCallback.ts       # Debounce callbacks
│   │   ├── useProfileComplete.ts         # Profile completion check
│   │   ├── useInView.ts                  # Intersection Observer
│   │   ├── use-toast.ts                  # Toast notifications
│   │   └── use-mobile.tsx                # Mobile breakpoint detection
│   ├── services/                         # Business logic & data access
│   │   ├── opportunities.ts              # Fetch/search/sort opportunities
│   │   └── savedOpportunities.ts         # Manage saved opportunities
│   ├── integrations/
│   │   └── supabase/                     # Supabase integration
│   │       ├── client.ts                 # Supabase client (with custom storage & CSRF)
│   │       └── types.ts                  # Supabase type definitions
│   ├── lib/                              # Utility functions
│   │   ├── api/
│   │   │   ├── citySearch.ts             # City autocomplete API
│   │   │   └── interceptor.ts            # HTTP interceptor
│   │   ├── data/                         # Static lookup data
│   │   │   ├── graduationYears.ts
│   │   │   ├── majors.ts
│   │   │   ├── universities.ts
│   │   │   └── usStates.ts
│   │   ├── auditLogger.ts                # Auth event audit logging
│   │   ├── authCookie.ts                 # Cookie-based session persistence
│   │   ├── calendar.ts                   # Calendar utilities
│   │   ├── csrf.ts                       # CSRF token generation
│   │   ├── errorUtils.ts                 # Error handling & serialization
│   │   ├── geolocation.ts                # Browser geolocation wrapper
│   │   ├── GlobeTransitionManager.ts     # 3D globe animation state
│   │   ├── inputValidation.ts            # Form input validation
│   │   ├── logger.ts                     # Console logging
│   │   ├── opportunityPrefetch.ts        # Opportunity data prefetch
│   │   ├── rateLimit.ts                  # Client-side rate limiting
│   │   ├── toastHelpers.ts               # Toast notification helpers
│   │   ├── tracking.ts                   # Analytics/event tracking
│   │   └── utils.ts                      # General utilities
│   └── types/
│       └── index.ts                      # Central TypeScript definitions
├── public/                               # Static assets
│   ├── favicon.ico
│   ├── robots.txt
│   ├── placeholder.svg
│   ├── hero/
│   │   └── clinicalhours-hero-bg.webp
│   ├── screenshots/                      # Demo screenshots/videos
│   ├── data/                             # Hospital CSV data
│   └── email-assets/                     # Email template assets
├── dist/                                 # Build output (generated)
├── node_modules/                         # Dependencies (generated)
├── scripts/                              # Utility scripts
│   ├── importHospitals.ts                # Hospital data import
│   ├── import-texas-hospitals.ts         # Texas-specific import
│   ├── remove-duplicates.ts              # Clean duplicate hospitals
│   ├── fix-map-coordinates.ts            # Geo-coordinate fixes
│   ├── fix-coordinates-direct.ts         # Direct coordinate fixes
│   ├── discoverFields.ts                 # Explore data schema
│   ├── directImport.ts                   # Direct Supabase import
│   └── [migration scripts]               # Database migrations
├── index.html                            # HTML entry point
├── vite.config.ts                        # Vite build configuration
├── tsconfig.json                         # TypeScript configuration
├── tsconfig.app.json                     # App TypeScript configuration
├── tsconfig.node.json                    # Build TypeScript configuration
├── package.json                          # Project metadata & dependencies
├── bun.lock                              # Bun lockfile
├── components.json                       # shadcn/ui configuration
├── postcss.config.js                     # PostCSS configuration
├── tailwind.config.js                    # Tailwind CSS configuration
├── eslint.config.js                      # ESLint rules
├── .gitignore                            # Git ignore rules
└── [docs, guides, configs]               # Documentation and configs
```

## Key Locations

| Purpose | Path |
|---------|------|
| **Pages (Entry Points)** | `src/pages/` |
| **Reusable Components** | `src/components/` |
| **Admin Components** | `src/components/admin/` |
| **Base UI Components** | `src/components/ui/` |
| **Custom Hooks** | `src/hooks/` |
| **Services** | `src/services/` |
| **Supabase Client** | `src/integrations/supabase/client.ts` |
| **Shared Types** | `src/types/index.ts` |
| **Utilities** | `src/lib/` |
| **API Integrations** | `src/lib/api/` |
| **Static Data** | `src/lib/data/` |
| **HTML Root** | `index.html` |
| **Build Configuration** | `vite.config.ts` |
| **TypeScript Config** | `tsconfig.json` |
| **App Routing** | `src/App.tsx` |
| **React Root** | `src/main.tsx` |

## Naming Conventions

### Files & Directories
- **Page Components**: PascalCase with .tsx extension (e.g., `Home.tsx`, `AdminDashboard.tsx`)
- **Components**: PascalCase with .tsx extension (e.g., `Navigation.tsx`, `ExperienceBuilder.tsx`)
- **Hooks**: camelCase with `use` prefix and .ts/.tsx extension (e.g., `useAuth.tsx`, `useDebounce.ts`)
- **Services**: camelCase plural noun with .ts extension (e.g., `opportunities.ts`)
- **Utilities**: camelCase descriptive name with .ts extension (e.g., `errorUtils.ts`, `toastHelpers.ts`)
- **Types**: Grouped in single `types/index.ts` file
- **UI Components**: PascalCase, imported from shadcn/ui library

### TypeScript Interfaces & Types
- **Interfaces**: PascalCase nouns (e.g., `Opportunity`, `SavedOpportunity`, `Review`)
- **Type Aliases**: PascalCase nouns (e.g., `SupabaseClient`, `ErrorDetails`)
- **Enums**: PascalCase nouns (rare in this codebase)
- **Props Interfaces**: ComponentName + "Props" (e.g., `NavigationProps`)

### Component & Function Naming
- **React Components**: PascalCase function names (e.g., `function Home() {}`, `const Navigation = () => {}`)
- **Event Handlers**: camelCase with action prefix (e.g., `handleSubmit()`, `onOpenModal()`)
- **Custom Hooks**: `use` + camelCase (e.g., `useAuth()`, `useDebounce()`)
- **Service Functions**: camelCase verbs (e.g., `fetchOpportunities()`, `saveOpportunity()`)

### CSS & Styling
- **Classes**: Kebab-case with BEM-inspired structure (e.g., `.opportunity-card`, `.admin-header__title`)
- **Variables**: Tailwind CSS utility-first approach (inline classes)
- **CSS Modules**: Not used; all styling via Tailwind + component props

### Constants & Configuration
- **Environment Variables**: VITE_ prefix (Vite convention) (e.g., `VITE_SUPABASE_URL`, `VITE_MAPBOX_PUBLIC_TOKEN`)
- **Constants**: UPPER_SNAKE_CASE when used across multiple files (e.g., `SESSION_TIMEOUT_MS`, `REMEMBER_ME_KEY`)

## Co-location Patterns

### Component Organization
- **Component-scoped logic**: Hooks and utilities often kept near where they're used
  - Example: `useAuth()` hook lives in `src/hooks/` but closely tied to auth pages
- **Shared logic**: Common hooks and services extracted to `src/hooks/` and `src/services/`

### Types
- **Centralized types**: All shared types in `src/types/index.ts`
- **Local types**: Component-local types defined in same file using `interface ComponentProps {}`
- **Database row types**: Kept in `src/types/index.ts` (e.g., `OpportunityRow`)

### Styles
- **No CSS files per component**: All styling via inline Tailwind classes
- **Global styles**: `src/index.css` for Tailwind imports and CSS resets
- **Component-specific styles**: Rare; use `className` props with Tailwind

### Tests
- **No test files visible**: Not present in current codebase structure
- **Testing strategy**: Would follow pattern of `ComponentName.test.tsx` or `ComponentName/__tests__/` if added

### Assets
- **Component-used assets**: Imported directly (e.g., `import carouselBg from '@/assets/carousel-bg.png'`)
- **Public assets**: Placed in `public/` for static linking
- **Font assets**: Self-hosted via `@fontsource-variable` packages

## Architecture Patterns

### Page → Hook → Service → Supabase
1. Page component mounts and renders UI
2. Uses custom hook (e.g., `useAuth()`, `useOpportunitiesQuery()`)
3. Hook calls service function (e.g., `fetchOpportunities()`)
4. Service queries Supabase client
5. Results returned and cached via React Query

### Component Composition
- Large pages composed of smaller components
- Example: `AdminDashboard.tsx` composed of:
  - `AdminOverviewTab.tsx`
  - `AdminHospitalsTab.tsx`
  - `AdminPendingApprovalsTab.tsx`
  - `AdminToolsTab.tsx`

### UI Kit Integration
- All UI components from shadcn/ui (Radix UI + Tailwind)
- Custom components build on top of base UI components
- Example: `Button`, `Dialog`, `Form` from shadcn/ui used extensively

### Provider Nesting (App.tsx)
1. `HelmetProvider` (outermost)
2. `QueryClientProvider` (React Query)
3. `ThemeProvider` (next-themes)
4. `ErrorBoundary` (error handling)
5. `BrowserRouter` (routing)
6. `Routes` (page definitions)

## Import Aliases

- `@/*` maps to `src/`
  - `import { useAuth } from '@/hooks/useAuth'` (instead of `../../../hooks/useAuth`)
  - Improves readability and refactoring safety
  - Configured in `tsconfig.json` and `vite.config.ts`
