# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.8.3 - All source code, components, and edge functions
- HTML5 / CSS3 - UI markup and styling

**Secondary:**
- SQL - Database migrations and queries in `supabase/migrations/`
- Deno - Edge function runtime (TypeScript executed via Deno)

## Runtime

**Environment:**
- Node.js (version specified in package.json via npm)
- Browser (React 18.3.1 - client-side rendering)
- Deno (for Supabase Edge Functions)

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present
- Alternative: `bun` lock file also present (`bun.lock`)

## Frameworks

**Core:**
- React 18.3.1 - UI library and component framework
- React Router 6.30.2 - Client-side routing
- Vite 5.4.19 - Build tool and dev server

**UI & Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- shadcn/ui - Component library built on Radix UI primitives
- @radix-ui/* (comprehensive suite) - Accessible UI components
  - Dialog, dropdown-menu, select, tabs, toast, accordion, avatar, checkbox, collapsible, context-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, separator, slider, switch, toggle, toggle-group, tooltip

**Forms & Validation:**
- React Hook Form 7.69.0 - Form state management
- @hookform/resolvers 3.10.0 - Form validation adapters
- Zod 3.25.76 - Schema validation and type-safe parsing

**Data Fetching & State:**
- @tanstack/react-query 5.90.16 - Server state management and caching
- @supabase/supabase-js 2.89.0 - Supabase client library

**Mapping & Visualization:**
- Mapbox GL 3.16.0 - Interactive maps
- Recharts 2.15.4 - Chart and graph components
- Embla Carousel 8.6.0 - Carousel component
- @dnd-kit/* - Drag and drop utilities (core, sortable, modifiers, utilities)

**Mobile & Native:**
- @capacitor/core 8.2.0 - Native mobile runtime
- @capacitor/ios 8.2.0 - iOS support
- @capacitor/cli 8.2.0 - Capacitor CLI tools

**Other Libraries:**
- Next Themes 0.4.6 - Dark mode / theme switching
- React Helmet Async 2.0.5 - Document head management
- Sonner 1.7.4 - Toast notifications
- class-variance-authority 0.7.1 - Variant-based component styling
- React Day Picker 9.1.3 - Date picker
- React Resizable Panels 2.1.9 - Resizable UI panels
- Input OTP 1.4.2 - OTP input component
- Vaul 0.9.9 - Drawer/sheet component
- Date-fns 3.6.0 - Date utilities
- pg 8.13.1 - PostgreSQL driver (for backend utilities)

**Testing:**
- Vitest 4.1.4 - Unit test runner
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- jsdom 29.0.2 - DOM environment for testing

**Build & Development:**
- @vitejs/plugin-react-swc 3.11.0 - React + SWC support for Vite
- TypeScript ESLint 8.38.0 - TypeScript linting
- ESLint 9.32.0 - Code linting
- Autoprefixer 10.4.21 - CSS vendor prefixing
- PostCSS 8.5.6 - CSS transformation
- tsx 4.21.0 - TypeScript execution for scripts
- lovable-tagger 1.1.11 - Component tagging for Lovable integration
- CSV Parse 6.1.0 - CSV parsing for data imports

**Fonts:**
- @fontsource-variable/inter - Variable Inter font
- @fontsource-variable/dm-sans - Variable DM Sans font
- @fontsource-variable/plus-jakarta-sans - Variable Plus Jakarta Sans font
- @fontsource-variable/geist-mono - Variable Geist Mono font
- @fontsource/lora - Lora serif font

## Configuration

**Environment:**
- Vite environment variables prefixed with `VITE_` (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_PUBLIC_TOKEN`)
- Environment variables are injected at build time via Vite
- Fallback values provided in `vite.config.ts` for Lovable Cloud builds
- `.env` files are listed in `.gitignore`

**Build Configuration:**
- `vite.config.ts` - Main Vite configuration with CSP security headers, manual chunk splitting, and optimization settings
- `tsconfig.json` - TypeScript configuration with path aliases (`@/*` → `./src/*`)
- `tsconfig.app.json` - App-specific TypeScript configuration
- `tsconfig.node.json` - Node/build script TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration with custom colors, animations, and font families
- `postcss.config.js` - PostCSS configuration (used by Tailwind)
- `eslint.config.js` - ESLint configuration for TypeScript and React
- `vercel.json` - Vercel deployment configuration with security headers and routing rules
- `components.json` - shadcn/ui component configuration

**Supabase Edge Functions:**
- `supabase/config.toml` - Project configuration with function verify_jwt settings
- Edge functions runtime: Deno
- Functions use explicit CORS handling and origin validation

## Platform Requirements

**Development:**
- Node.js (npm) or Bun for package management
- TypeScript knowledge for all code
- Vite dev server running on `localhost:8080` (configurable)

**Production:**
- Vercel for frontend hosting (indicated by `vercel.json`)
- Supabase for backend (PostgreSQL database, authentication, Edge Functions)
- Browser support: Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS support via Capacitor native build

---

*Stack analysis: 2026-04-11*
