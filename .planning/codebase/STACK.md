# Stack

## Runtime & Language

**Primary Runtime:** Node.js with TypeScript
- **TypeScript Version:** 5.8.3
- **ES Module Support:** Enabled (type: "module" in package.json)
- **Target Runtime:** Browser (React) + Deno (Supabase Edge Functions)

## Frameworks

**Frontend Framework:** React 18.3.1
- **Router:** React Router DOM 6.30.2
- **UI Component Library:** shadcn/ui (Radix UI components)
- **Form Handling:** React Hook Form 7.69.0 with Zod validation
- **Query Client:** TanStack React Query 5.90.16
- **Styling:** Tailwind CSS 3.4.17 with custom animations

**Backend:** Supabase (PostgreSQL + Edge Functions)
- **ORM/Query Builder:** PostgREST API (via @supabase/supabase-js)
- **Database:** PostgreSQL 13.0.5 (via Supabase)
- **Edge Functions Runtime:** Deno
- **Authentication:** Supabase Auth with JWT tokens and httpOnly cookies

**Build Tool:** Vite 5.4.19
- **React Plugin:** @vitejs/plugin-react-swc 3.11.0
- **SWC Compiler:** For faster TypeScript transpilation

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | 2.89.0 | Database & Auth client |
| react | 18.3.1 | UI framework |
| react-dom | 18.3.1 | DOM rendering |
| react-router-dom | 6.30.2 | Client-side routing |
| @tanstack/react-query | 5.90.16 | Server state management |
| react-hook-form | 7.69.0 | Form state management |
| zod | 3.25.76 | Schema validation |
| @radix-ui/* | 1.x | Accessible UI components (23 packages) |
| mapbox-gl | 3.16.0 | Interactive maps |
| recharts | 2.15.4 | Charts & data visualization |
| tailwindcss | 3.4.17 | Utility-first CSS |
| tailwindcss-animate | 1.0.7 | Animation utilities |
| class-variance-authority | 0.7.1 | Component variants |
| sonner | 1.7.4 | Toast notifications |
| date-fns | 3.6.0 | Date manipulation |
| next-themes | 0.4.6 | Dark mode support |
| lucide-react | 0.462.0 | Icon library |
| @fontsource-variable/* | 5.2.8 | Variable font families (3 packages: DM Sans, Inter, Plus Jakarta Sans) |
| pg | 8.13.1 | PostgreSQL client (for scripts) |
| clsx | 2.1.1 | Conditional className utility |
| dotenv | 17.2.3 | Environment variable loading |
| vaul | 0.9.9 | Drawer component |
| embla-carousel-react | 8.6.0 | Carousel component |
| input-otp | 1.4.2 | OTP input component |
| react-day-picker | 9.1.3 | Date picker calendar |
| react-resizable-panels | 2.1.9 | Resizable layout panels |
| react-helmet-async | 2.0.5 | Document head management |
| tailwind-merge | 2.6.0 | Tailwind className merging |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.8.3 | Type checking |
| @types/react | 19.0.0 | React type definitions |
| @types/react-dom | 19.0.0 | React DOM type definitions |
| @types/node | 22.16.5 | Node.js type definitions |
| @types/pg | 8.11.10 | PostgreSQL client types |
| eslint | 9.32.0 | Code linting |
| typescript-eslint | 8.38.0 | TypeScript ESLint support |
| eslint-plugin-react-hooks | 5.2.0 | React hooks linting |
| eslint-plugin-react-refresh | 0.4.20 | React refresh linting |
| vite | 5.4.19 | Build tool |
| @vitejs/plugin-react-swc | 3.11.0 | Vite React plugin with SWC |
| tailwindcss | 3.4.17 | CSS framework |
| postcss | 8.5.6 | CSS processor |
| autoprefixer | 10.4.21 | Vendor prefix automation |
| postcss-nested | 6.0.1 | Nested CSS support |
| @tailwindcss/typography | 0.5.16 | Typography plugin |
| tsx | 4.21.0 | TypeScript executor (for scripts) |
| csv-parse | 6.1.0 | CSV parsing (for data import scripts) |
| lovable-tagger | 1.1.11 | Component tagging for Lovable Cloud |

## Configuration

**Environment Variables (Frontend - VITE_*):**
- `VITE_SUPABASE_URL` - Supabase project URL (defaults to sysbtcikrbrrgafffody.supabase.co)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon public key (JWT token in package)
- `VITE_MAPBOX_PUBLIC_TOKEN` - Mapbox public token (defaults to configured key)
- `VITE_ENABLE_TRACKING` - Enable/disable event tracking (development only)

**Environment Variables (Edge Functions - Deno):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Admin authentication key
- `RESEND_API_KEY` - Email service API key

**TypeScript Configuration:**
- Base URL: `.` (project root)
- Path aliases: `@/*` → `./src/*`
- Strict checks disabled for development flexibility
- Allow JavaScript files for mixed JS/TS projects
- Skip library type checking for faster compilation

**Tailwind Configuration:**
- Dark mode: Class-based switching
- Content paths: src/**, pages/**, components/**, app/**
- Custom fonts: Inter, DM Sans, Plus Jakarta Sans (via @fontsource-variable)
- Custom animations: accordion, fade-in, scale-in, float, pulse-glow
- Sidebar color system with multiple shades

**PostCSS Configuration:**
- Tailwind CSS plugin
- Autoprefixer for vendor prefixes

## Build & Dev Tooling

**Vite:**
- Dev server: http://localhost:8080
- Hot Module Replacement (HMR)
- Build output: `dist/` directory
- Chunk splitting strategy:
  - React vendors: react, react-dom, react-router-dom
  - UI vendors: @radix-ui dialog, dropdown, select
  - Query vendor: @tanstack/react-query
  - Map vendor: mapbox-gl
  - Code splitting: map components
- Asset inlining: 4KB threshold for base64 encoding
- Minification: esbuild
- Chunk size warning limit: 1000KB

**Security Headers (Vite Plugin):**
- Content Security Policy (CSP) with nonce support
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- Permissions-Policy: Geolocation allowed, camera/microphone disabled
- CORS headers for allowed origins
- Development: More permissive CSP for Vite HMR
- Production: Stricter CSP with unsafe-inline only for React bundles

**ESLint:**
- Base config: ESLint recommended + TypeScript recommended
- React Hooks plugin with recommended rules
- React Refresh plugin for fast refresh
- Ignores: dist/ directory
- Disabled: @typescript-eslint/no-unused-vars (flexible during development)

**Scripts:**
- `npm run dev` - Start development server (Vite)
- `npm run build` - Production build
- `npm run build:dev` - Development build with full source maps
- `npm run lint` - ESLint checks
- `npm run preview` - Preview production build locally
- `npm run import:texas` - Import Texas hospital data (tsx script)
- `npm run remove:duplicates` - Remove duplicate hospitals (tsx script)
- `npm run fix:coordinates` - Fix hospital map coordinates (tsx script)
- `npm run fix:coordinates:direct` - Direct coordinate fixing (tsx script)
- `npm run discover:fields` - Discover CSV field mappings (tsx script)
- `npm run import:hospitals` - Import hospital CSV data (tsx script)

**Dependency Optimization:**
- Vite pre-bundling: react, react-dom, react-router-dom
- Development dependency tree: 40+ dev dependencies
- Node modules: ~500MB (typical for large React projects)

## Additional Features

**Container Support:**
- Sidebar component system with resizable panels
- Modal dialogs via Radix UI
- Toast notifications via Sonner
- Dropdown menus and context menus
- Tooltips and popovers
- Progress indicators
- Select dropdowns with search
- Tabs and accordions
- Avatar and badge components
- Carousels with Embla

**API Client Setup:**
- Supabase JavaScript client with custom fetch wrapper
- CSRF token injection for state-changing requests
- Dynamic storage (localStorage vs sessionStorage based on "remember me")
- Session persistence with auto token refresh
- OAuth token detection from URL
