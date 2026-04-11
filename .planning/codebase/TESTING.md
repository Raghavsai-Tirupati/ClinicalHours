# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- `vitest` 4.1.4
- Config: `vite.config.ts` (lines 255-259)
- Environment: `jsdom` (browser-like environment for React testing)
- Globals: enabled (no need to import `describe`, `it`, `expect`)

**Assertion Library:**
- Built-in vitest assertions (via `expect`)
- `@testing-library/react` 16.3.2 for component testing
- `@testing-library/jest-dom` 6.9.1 for DOM matchers
- `@testing-library/user-event` 14.6.1 for user interaction simulation

**Run Commands:**
```bash
npm run test              # Run tests in watch mode
npm run test:run          # Run tests once (CI mode)
```

## Test File Organization

**Location:**
- Co-located pattern: Test files placed in `__tests__` subdirectory next to source files
- Example: `src/components/admin/__tests__/AdminUserProfile.utils.test.ts` tests utilities from `src/components/admin/AdminUserProfile.tsx`

**Naming:**
- Pattern: `{ComponentName}.utils.test.ts` for utility functions
- Pattern: `{ComponentName}.test.tsx` for component tests
- Suffix: `.test.ts` or `.test.tsx` required for vitest discovery

**Structure:**
```
src/
├── components/
│   └── admin/
│       ├── AdminUserProfile.tsx
│       └── __tests__/
│           └── AdminUserProfile.utils.test.ts
├── lib/
│   ├── errorUtils.ts
│   └── logger.ts
└── types/
    └── index.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { formatLastFirst, emailToColor } from '../AdminUserProfile';

describe('formatLastFirst', () => {
  it('formats "Shivam Kanodia" as "Kanodia, Shivam"', () => {
    expect(formatLastFirst('Shivam Kanodia')).toBe('Kanodia, Shivam');
  });

  it('handles multi-word first names: "Mary Jo Smith" → "Smith, Mary Jo"', () => {
    expect(formatLastFirst('Mary Jo Smith')).toBe('Smith, Mary Jo');
  });

  it('returns the raw value when there is no space', () => {
    expect(formatLastFirst('Madonna')).toBe('Madonna');
  });
});

describe('emailToColor', () => {
  it('returns a valid Tailwind bg color class', () => {
    const validColors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
    ];
    const result = emailToColor('shivam@example.com');
    expect(validColors).toContain(result);
  });

  it('returns the same color for the same email (deterministic)', () => {
    expect(emailToColor('a@b.com')).toBe(emailToColor('a@b.com'));
  });

  it('returns different colors for different emails (likely)', () => {
    const c1 = emailToColor('alice@example.com');
    const c2 = emailToColor('bob@example.com');
    expect(c1).toMatch(/^bg-\w+-500$/);
    expect(c2).toMatch(/^bg-\w+-500$/);
  });
});
```

**Patterns observed:**
- One `describe()` block per function being tested
- Descriptive test names using `it()` that explain both input and expected output
- Arrange-Act-Assert pattern (implicit in examples)
- Edge case testing (e.g., multi-word names, single-word names, determinism, variation)

## Setup and Teardown

**Global Setup:**
- File: `src/test-setup.ts` (configured in `vite.config.ts` setupFiles)
- Content: `import '@testing-library/jest-dom'`
- Purpose: Provides DOM matchers like `.toBeInTheDocument()`, `.toHaveClass()`, etc.

**Per-test setup/teardown:**
- Not currently visible in examined test files
- Would use `beforeEach()`, `afterEach()`, `beforeAll()`, `afterAll()` if needed

## Mocking

**Framework:** vitest's built-in mocking (no separate library required)

**Current usage:**
- No mocking examples found in analyzed test files
- API mocking capabilities available but not yet implemented

**Patterns if needed:**
```typescript
// For modules
import { vi } from 'vitest';
vi.mock('@/lib/someModule', () => ({
  functionName: vi.fn(() => 'mock result'),
}));

// For functions
const mockFn = vi.fn().mockReturnValue('result');

// For async functions
const mockAsyncFn = vi.fn().mockResolvedValue({ data: 'result' });
```

**What to Mock:**
- External API calls (supabase, mapbox, etc.)
- Third-party service integrations
- Browser APIs if testing in isolation
- File system operations

**What NOT to Mock:**
- Pure utility functions (test them directly)
- React hooks (use `@testing-library/react` instead)
- DOM APIs in component tests (let jsdom handle)

## Fixtures and Factories

**Test Data:**
- Not extensively used in current codebase
- Direct inline data creation in tests (e.g., email strings, name strings)

**Location:**
- Typically placed in same `__tests__` directory
- Could create `fixtures.ts` or `testData.ts` in `__tests__/` if patterns emerge

**Example pattern (not currently used but recommended):**
```typescript
// __tests__/fixtures.ts
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

export const mockOpportunity = {
  id: 'opp-123',
  name: 'Test Clinic',
  location: 'Boston, MA',
};
```

## Coverage

**Requirements:** No coverage threshold enforced

**View Coverage:**
```bash
npm run test:run -- --coverage
```

**Current state:** Coverage measurement available but not required

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Direct function calls with test inputs, assertion on outputs
- Example: `AdminUserProfile.utils.test.ts` tests pure functions like `formatLastFirst()` and `emailToColor()`
- Tools: vitest with `expect()`

**Integration Tests:**
- Not extensively implemented yet
- Would test interactions between multiple modules (e.g., Auth + Storage)
- Could use vitest + react-testing-library for component integration

**E2E Tests:**
- Framework: Not currently implemented
- Could use: Playwright or Cypress for end-to-end testing
- Not in package.json dependencies

**Component Tests:**
- Framework: React Testing Library (via `@testing-library/react`)
- Approach: Render components, simulate user interactions, assert on DOM
- Not yet extensively implemented in codebase

## Common Patterns

**Async Testing:**
```typescript
it('awaits async operations', async () => {
  const result = await fetchAdminActivityFeed();
  expect(result).toBeDefined();
});

// With user-event for async interactions
import { userEvent } from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(button);
```

**Error Testing:**
```typescript
it('handles errors gracefully', () => {
  const mockError = new Error('Test error');
  const result = sanitizeErrorMessage(mockError);
  expect(result).toBe('An unexpected error occurred. Please try again.');
});

it('sanitizes specific database errors', () => {
  const dupError = new Error('error 23505 duplicate');
  expect(sanitizeErrorMessage(dupError)).toContain('already exists');
});
```

**Snapshot Testing:**
- Not currently used
- Available via vitest if needed: `expect(component).toMatchSnapshot()`

## Test Standards

**Conventions:**
- Test files import test utilities at top: `import { describe, it, expect } from 'vitest'`
- Descriptive test names that serve as documentation
- Each test should be independent and pass/fail on its own
- Use simple data for unit tests, comprehensive fixtures for integration tests

**Best Practices:**
- Keep tests focused on one behavior per test
- Avoid testing implementation details; test behavior instead
- Use meaningful assertions with clear failure messages
- Group related tests in describe blocks

---

*Testing analysis: 2026-04-11*
