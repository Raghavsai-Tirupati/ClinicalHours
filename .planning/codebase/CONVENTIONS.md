# Conventions

## Code Style

### Formatting & Linting
- **ESLint Configuration**: Uses flat config with TypeScript ESLint
- **Base Rules**: Extends `@eslint/js` recommended and TypeScript ESLint recommended configs
- **React Plugins**:
  - `eslint-plugin-react-hooks`: Enforces Rules of Hooks with recommended rules enabled
  - `eslint-plugin-react-refresh`: Warns on non-component exports (allowConstantExport: true)
- **Disabled Rules**:
  - `@typescript-eslint/no-unused-vars`: Off (development preference)
- **No Prettier Config**: Project uses ESLint only; no dedicated Prettier configuration found
- **Language Version**: ECMAScript 2020 (ES2020)

### CSS & Styling
- **Framework**: Tailwind CSS 3.4.17 with custom configuration
- **Color System**: Dark mode via class strategy with CSS custom properties (HSL)
- **Font Stack**:
  - Sans (default): Inter, DM Sans, system fonts
  - Heading: Plus Jakarta Sans, DM Sans, system fonts
  - Display: Playfair Display, Georgia, serif
  - Mono: Courier New, monospace
- **Self-Hosted Fonts**: Uses `@fontsource-variable` packages (no external CDN dependencies)
  - @fontsource-variable/inter
  - @fontsource-variable/dm-sans
  - @fontsource-variable/plus-jakarta-sans
- **Custom Animations**: Multiple keyframe animations (accordion, fade-in variants, scale-in, float, pulse-glow)
- **Plugins**: tailwindcss-animate for animation utilities
- **Utility Classes**: Extensive use of clsx and tailwind-merge via `cn()` utility function

### TypeScript Configuration
- **Target**: ES2020
- **Module**: ESNext with bundler module resolution
- **JSX**: React 17+ new JSX transform (jsx: "react-jsx")
- **Strict Mode**: Disabled (strict: false) for development flexibility
- **Checks Disabled**:
  - noUnusedLocals: false
  - noUnusedParameters: false
  - noImplicitAny: false
  - noFallthroughCasesInSwitch: false
- **Isolation**: isolatedModules and moduleDetection: "force" for proper module boundary detection
- **Import Extensions**: allowImportingTsExtensions enabled for bundler compatibility
- **Path Aliases**: `@/*` maps to `./src/*` for clean imports

## Naming Patterns

### Components
- **File Naming**: PascalCase (e.g., `ErrorBoundary.tsx`, `LoadingSpinner.tsx`)
- **Component Types**:
  - **Functional Components**: Named exports with React.forwardRef for ref support
  - **UI Components**: Located in `src/components/ui/` (Radix UI + shadcn/ui patterns)
  - **Feature Components**: Located in `src/components/` with descriptive names
  - **Subdirectories**: `admin/`, `tutorial/` for organized component groups
- **Export Pattern**: Default exports for page/route components, named exports for reusable components
- **Props Interfaces**: Named with `Props` suffix (e.g., `LoadingSpinnerProps`, `ButtonProps`)

### Functions & Variables
- **Event Handlers**: camelCase with `handle` prefix (e.g., `handleSignIn`, `handleGoHome`)
- **Utility Functions**: camelCase, descriptive (e.g., `sanitizeErrorMessage`, `cn()`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth`, `useKeyboardShortcuts`, `useAppKeyboardShortcuts`)
- **Constants**: UPPER_SNAKE_CASE for truly immutable values (e.g., `REMEMBER_ME_KEY`, `VITE_SUPABASE_URL`)
- **State Variables**: camelCase, descriptive (e.g., `isSubmittingRef`, `rememberMe`, `showPassword`)
- **Ref Variables**: camelCase with `Ref` suffix (e.g., `isSubmittingRef`)

### Files & Directories
- **Pages**: PascalCase in `src/pages/` (e.g., `Auth.tsx`, `Dashboard.tsx`, `AdminDashboard.tsx`)
- **Utilities**: camelCase in `src/lib/` (e.g., `logger.ts`, `errorUtils.ts`, `authCookie.ts`)
- **Hooks**: camelCase in `src/hooks/` (e.g., `useKeyboardShortcuts.tsx`, `useAuth.tsx`)
- **Types**: Stored in integration files or alongside features (e.g., `src/integrations/supabase/types.ts`)
- **APIs**: Organized in `src/lib/api/` or `src/integrations/`

### Database/API
- **Supabase Tables**: snake_case with underscores (e.g., `hospital_accounts`, `email_verified`)
- **Field Names**: snake_case (e.g., `account_status`, `contact_email`, `user_id`)
- **Database Client**: Exported as `supabase` from `src/integrations/supabase/client.ts`

## Component Patterns

### Functional Component Structure
```typescript
// Props interface at top
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

// Main component with clear responsibility
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Logic
  return JSX;
}
```

### UI Component Pattern (Radix + shadcn/ui)
- Uses slot pattern via `@radix-ui/react-slot` for component composition
- Uses `class-variance-authority` (CVA) for variant styling
- Exported with `displayName` for debugging
- Uses React.forwardRef for ref support
- Applied to both primitive and composed components

### Page Components
- Lazy loaded via React.lazy() in router for code splitting
- Use Suspense with PageLoader fallback component
- Organized with clear sections (forms, lists, layouts)
- Implement error boundary wrapping

### Dialog/Modal Pattern
- Using shadcn/ui Dialog/Drawer components
- Controlled via state (open/close)
- Form validation with Zod schemas
- Error handling with toast notifications

### Form Pattern
- React Hook Form for form management
- Zod for schema validation
- Clear validation messages displayed to users
- Double-submission prevention via refs
- Email sanitization to prevent enumeration attacks

## Error Handling

### Error Handling Strategy
- **Centralized Logger**: `src/lib/logger.ts`
  - Development: Console output
  - Production: Silent (prepared for Sentry integration)
  - Methods: `error()`, `warn()`, `info()`, `debug()`
- **Error Sanitization**: `src/lib/errorUtils.ts`
  - `sanitizeErrorMessage()`: User-facing error messages
  - Removes internal service references (Supabase, Lovable)
  - Maps database error codes to user-friendly messages
  - Example: "23505" (duplicate) → "This item already exists"
  - Generic fallback for technical errors
- **Error Boundary**: React.ErrorBoundary class component
  - Catches render errors in component tree
  - Shows custom ErrorFallback UI with error details in dev mode
  - Provides "Try Again" and "Go Home" recovery options
  - Logs to monitoring service in production (Sentry ready)

### Auth Error Handling
- Prevents email enumeration: Generic "Invalid email or password" message
- Handles Zod validation errors with specific field messages
- JWT/token expiration: "Your session has expired. Please sign in again."
- Network errors: "Connection error. Please check your internet connection and try again."
- Rate limiting: "Too many requests. Please wait a moment and try again."

### Toast Notifications
- Uses `sonner` for toast UI
- Error, success, and info variants
- Displays sanitized error messages to users
- Example: `toast.error(sanitizeErrorMessage(error))`

## TypeScript Patterns

### Type Definitions
- **Props Types**: Interface pattern with optional fields using `?`
  ```typescript
  interface Props {
    children: ReactNode;
    fallback?: ReactNode;
  }
  ```
- **State Types**: Component-local interfaces for state
- **API/Database Types**: Centralized in `src/integrations/supabase/types.ts`
- **Utility Types**: Using React built-in types (`ReactNode`, `ErrorInfo`, etc.)

### Generic Patterns
- React component generics: `Component<Props, State>`
- Hook generics for data management
- API response typing from Supabase types

### Zod Schemas
- Used for form validation
- Schemas defined at component level or in `src/lib/`
- Example validation:
  ```typescript
  const authSchema = z.object({
    email: z.string().email(),
    password: z.string()
      .min(8)
      .refine(val => /[a-zA-Z]/.test(val) && /[0-9]/.test(val))
  });
  ```

### Type Safety
- Minimal use of `any` (noImplicitAny: false allows it but not preferred)
- Union types for multiple state values
- Type guards for error instanceof checks
- RequestInit type for fetch options

## Import Patterns

### Path Aliases
- **Alias**: `@/*` maps to `./src/*`
- **Benefits**: Clean imports regardless of nesting level
- **Usage**:
  - `import { Button } from '@/components/ui/button'`
  - `import { supabase } from '@/integrations/supabase/client'`
  - `import { cn } from '@/lib/utils'`

### Import Organization
1. React/external packages first
2. Component imports
3. Type imports
4. Utility/lib imports
5. Asset imports (images, CSS)

### Barrel File Pattern
- Radix UI components exported from individual files (no barrel files)
- UI components follow shadcn/ui convention (individual files in `ui/` folder)
- Integration clients exported from `src/integrations/supabase/client.ts`

### Lazy Loading
- Pages lazy loaded with `React.lazy()`
- Used in main router (`src/App.tsx`)
- Suspense boundary with PageLoader fallback
- Improves initial bundle size

## Code Organization

### Security Patterns
- **CSP Headers**: Vite plugin in `vite.config.ts`
  - Development: Allows unsafe-inline and unsafe-eval for HMR
  - Production: Blocks unsafe-eval, allows unsafe-inline for React
  - Supabase and Mapbox whitelisted
- **CSRF Protection**: Custom fetch wrapper adds CSRF tokens
  - Only for edge functions (not Supabase auth)
  - State-changing methods: POST, PUT, PATCH, DELETE
- **Email Enumeration Prevention**: Generic error messages on auth failure
- **Session Storage Strategy**: Dynamic adapter (localStorage with "remember me", sessionStorage otherwise)
- **Credentials Handling**: Custom fetch wrapper for proper CORS and credentials mode

### Environment Variables
- **Pattern**: `VITE_*` prefix for client-side variables
- **Validation**: Checked in Supabase client initialization
- **Fallbacks**: Safe public values as fallbacks (published keys only)
- **Access**: Via `import.meta.env.VITE_*`

### Validation & Input Handling
- **Auth Validation**: Zod schemas with custom refinements
- **Password Requirements**: 8+ chars, letters AND numbers required
- **Email Format**: Standard email validation via Zod
- **Form Field Trimming**: `.trim()` for string inputs
- **Optional Fields**: Clear usage of `.optional()` in schemas
- **Field Constraints**: Max lengths enforced (email max 255, password max 128)

### State Management
- **QueryClient**: TanStack React Query for server state
  - Retry strategy: 2 attempts with exponential backoff
  - Stale time: 5 minutes default
  - Configured in App.tsx
- **Local State**: React useState for UI state
- **Auth State**: Custom hooks (useAuth) managing sessions and roles
- **Ref State**: useRef for non-rendering values (submission flags)

### API Integration
- **Supabase Client**: Configured with dynamic storage and custom fetch
- **Edge Functions**: Invoked via `supabase.functions.invoke()`
- **Database Queries**: Via Supabase query builder
- **Error Handling**: Wrapped in try-catch with sanitization
