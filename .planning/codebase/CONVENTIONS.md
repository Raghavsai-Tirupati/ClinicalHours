# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- React components (functional): `PascalCase.tsx` (e.g., `AddMomentDialog.tsx`, `AdminUserProfile.tsx`)
- Utilities and helpers: `camelCase.ts` (e.g., `errorUtils.ts`, `authCookie.ts`, `logger.ts`)
- Type definitions: `camelCase.ts` in `/types` directory (e.g., `index.ts`, `ApplicationStatus.ts`)
- Test files: `{ComponentName}.test.ts` or `{ComponentName}.utils.test.ts` in `__tests__` subdirectory (e.g., `AdminUserProfile.utils.test.ts`)
- API services: `camelCase.ts` in `/lib/api` directory (e.g., `interceptor.ts`, `adminAnalytics.ts`, `citySearch.ts`)

**Functions:**
- Component functions: `PascalCase` (e.g., `AddMomentDialog`, `ActivityFeed`)
- Utility functions: `camelCase` (e.g., `sanitizeErrorMessage`, `generateUUID`, `getGuestSessionId`, `lazyRetry`)
- Event handlers in components: `handle{EventName}` (e.g., `handleSave`, `handleOpenChange`, `handleKeyPress`)
- API fetch functions: `fetch{Resource}` or `{action}{Resource}` (e.g., `fetchAdminActivityFeed`, `searchCities`)

**Variables:**
- Local state: `camelCase` (e.g., `moment`, `date`, `saving`, `sessionId`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `SESSION_TIMEOUT_MS`, `REMEMBER_ME_KEY`, `GUEST_MODE_KEY`, `STATE_CHANGING_METHODS`)
- Boolean getters: prefix with `is` or `get` (e.g., `isStateChanging`, `getGuestModePreference`, `isDevelopment`)
- Storage keys: `UPPER_SNAKE_CASE` (e.g., `GUEST_SESSION_ID_KEY`, `REMEMBER_ME_KEY`)

**Types and Interfaces:**
- Interface names: `PascalCase` (e.g., `AddMomentDialogProps`, `ActivityEvent`, `Opportunity`, `SavedOpportunity`, `Question`)
- Type aliases: `PascalCase`
- Generic parameters: `T`, `K`, `V` (standard convention)
- Props interfaces: `{ComponentName}Props` pattern (e.g., `AddMomentDialogProps`)

## Code Style

**Formatting:**
- Use 2-space indentation (enforced via TypeScript/Vite defaults)
- Line length: No hard limit, but readability-conscious
- No formatter like Prettier is explicitly configured, relying on editor defaults

**Linting:**
- Tool: `eslint` with TypeScript support (`typescript-eslint`)
- Config file: `eslint.config.js` (uses new flat config format)
- Disabled rules that are relaxed:
  - `@typescript-eslint/no-unused-vars`: turned OFF (non-strict development)
  - `noUnusedLocals`: TypeScript compiler option OFF
  - `noUnusedParameters`: TypeScript compiler option OFF
  - `noImplicitAny`: OFF (flexible typing allowed)
  - `strictNullChecks`: OFF (lenient null handling)
  - `strict`: FALSE overall (relaxed mode for rapid development)

**Enabled rules:**
- `react-hooks/recommended`: Enforces Rules of Hooks
- `react-refresh/only-export-components`: Components exported from modules must be the default or named exports of components (allowConstantExport: true)
- `@typescript-eslint/recommended`: Basic TypeScript best practices

## Import Organization

**Order:**
1. React and React-DOM imports (e.g., `import { useState, useEffect } from "react"`)
2. Third-party library imports (e.g., `import { supabase } from "@/integrations/supabase/client"`, `import { QueryClient } from "@tanstack/react-query"`)
3. Internal imports using path aliases (e.g., `import { logAuthEvent } from "@/lib/auditLogger"`)
4. UI component imports (e.g., `import { Dialog, DialogContent } from "@/components/ui/dialog"`)

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json`)
- All internal imports use `@/` prefix (e.g., `@/components/ui/dialog`, `@/integrations/supabase/client`, `@/lib/errorUtils`)

**Barrel exports:**
- Not extensively used; most files import directly from specific modules
- Some component libraries use index.ts for re-exports (e.g., `@/components/ui/*`)

## Error Handling

**Patterns:**
- Errors are caught and transformed to user-friendly messages using `sanitizeErrorMessage()` in `src/lib/errorUtils.ts`
- Error categories handled:
  - Database constraint violations (unique, foreign key, check constraint) → user-friendly messages
  - JWT/token errors → "Your session has expired"
  - Network errors → "Connection error"
  - Rate limiting → "Too many requests"
  - Generic fallback → "An unexpected error occurred"
- Error messages are sanitized to remove internal service references (Supabase, Lovable, URLs)
- For logging, `sanitizeErrorForLogging()` keeps more details but redacts URLs
- Async operations use try/finally pattern (e.g., in `handleSave`:
  ```typescript
  setSaving(true);
  try {
    await onSave(moment.trim(), date);
    setMoment('');
  } finally {
    setSaving(false);
  }
  ```

## Logging

**Framework:** Custom logger utility in `src/lib/logger.ts` using `console` methods

**Log methods:**
- `logger.error(message, error?)` - Error level, only in development
- `logger.warn(message, ...args)` - Warning level, development only
- `logger.info(message, ...args)` - Info level, development only
- `logger.debug(message, ...args)` - Debug level, development only

**Patterns:**
- Production: Commented-out Sentry integration available but not active
- Development mode: All logs output to console
- Environment check: `import.meta.env.MODE === 'development'` or `import.meta.env.DEV`
- No logging to external services currently enabled

## Comments

**When to Comment:**
- Complex logic that isn't self-evident (e.g., `lazyRetry` function in `App.tsx` has detailed explanation of chunk-loading failure handling)
- Security-related code (e.g., CSP policy generation, CSRF protection)
- Non-obvious workarounds or special cases
- Storage key usage (e.g., `REMEMBER_ME_KEY` documented with purpose)

**JSDoc/TSDoc:**
- Used for utility functions and complex logic
- Function documentation format:
  ```typescript
  /**
   * Brief description
   * Detailed explanation if needed
   */
  export function functionName(): ReturnType {
    ...
  }
  ```
- Examples in codebase:
  - `generateUUID()` documented with JSDoc
  - `getGuestSessionId()` documented with JSDoc
  - `sanitizeErrorMessage()` documented with error mappings

## Function Design

**Size:** Functions are kept focused and reasonably short (< 50 lines typically)

**Parameters:**
- Use object destructuring for component props (e.g., `const { open, onOpenChange, opportunityName, onSave } = props`)
- Explicit parameter documentation in JSDoc
- Default values for optional parameters (e.g., `limit: number = 10`)

**Return Values:**
- Async functions return `Promise<T>`
- Void functions used for state setters
- Type annotations explicit (e.g., `Promise<Response>`, `string[]`, `boolean`)
- Utility functions return transformed/sanitized data (e.g., `sanitizeErrorMessage()` returns `string`)

## Module Design

**Exports:**
- Named exports for utilities and types (e.g., `export interface Opportunity`, `export async function searchCities()`)
- Default exports for React components when used with lazy loading (e.g., `export default AddMomentDialog`)
- Mix of default and named exports in the same module acceptable

**Services organization:**
- API services isolated in `src/lib/api/` (e.g., `interceptor.ts`, `adminAnalytics.ts`)
- Integration services in `src/integrations/supabase/` (e.g., `client.ts`)
- Utility functions in `src/lib/` (e.g., `logger.ts`, `errorUtils.ts`, `authCookie.ts`)
- Hooks in `src/hooks/` (e.g., `useAuth.tsx`, `useKeyboardShortcuts.ts`)
- Types in `src/types/` (e.g., `index.ts`)

**Barrel files:**
- UI components use index.ts for re-exporting (e.g., `src/components/ui/`)
- Main types exported from `src/types/index.ts`
- Not used extensively for application logic

## Development Standards

**TypeScript Config:**
- Relaxed mode: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- Allows flexibility but relies on developer discipline
- Path resolution: `bundler` with `@/` alias

**Module Resolution:**
- `moduleResolution: "bundler"` (modern bundler-friendly)
- `moduleDetection: "force"` (forces module context)
- `allowImportingTsExtensions: true` (allows importing .ts files directly)

---

*Convention analysis: 2026-04-11*
