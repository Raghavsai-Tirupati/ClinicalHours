# Testing

## Framework

### Current Testing Setup
**Status**: No dedicated test framework currently configured

**Missing Test Infrastructure**:
- No Vitest, Jest, or other unit test framework installed
- No test scripts in package.json
- No test files in source directory (src/)
- No test configuration files (vitest.config.ts, jest.config.js)
- No testing libraries (@testing-library/react, etc.)

### Available Development Tools
- **Node Types**: `@types/node` and `@types/react` for type checking
- **TypeScript**: Full TypeScript support with strict checks disabled
- **ESLint**: For code quality and style enforcement
- **Vite**: For development and build with HMR support

## Test Structure

### Where Tests Should Live
Following common conventions for React/TypeScript projects:
- **Unit Tests**: `src/**/__tests__/*.test.ts(x)` or `src/**/*.test.ts(x)`
- **Integration Tests**: `src/__integration__/*.test.ts(x)` or separate directory
- **E2E Tests**: `e2e/` or `tests/e2e/` directory with Playwright/Cypress
- **Test Fixtures**: `src/__fixtures__/` for test data

### Naming Conventions (Recommended)
- **Test Files**: `*.test.ts` or `*.test.tsx` for unit/integration
- **Spec Files**: `*.spec.ts` or `*.spec.tsx` (alternative)
- **Test Suites**: Group related tests in describe blocks
- **Test Cases**: Descriptive names with "should" pattern
  - Example: `should sanitize error message and remove service references`

### Test Organization Pattern
```typescript
describe('ComponentName', () => {
  describe('with default props', () => {
    it('should render correctly', () => {
      // test
    });
  });

  describe('with custom props', () => {
    it('should apply custom styles', () => {
      // test
    });
  });
});
```

## Mocking Patterns

### Mocking Strategy (To Be Implemented)

#### Supabase Client Mocking
```typescript
// Mock supabase client for tests
import { supabase } from '@/integrations/supabase/client';

jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));
```

#### React Router Mocking
```typescript
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

// Wrap component in MemoryRouter for navigation testing
const wrapper = ({ children }) => (
  <MemoryRouter initialEntries={['/']}>
    {children}
  </MemoryRouter>
);
```

#### React Query Mocking
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);
```

#### Form/Validation Mocking
```typescript
// Mock Zod schema validation
const mockAuthSchema = {
  parse: jest.fn((data) => data),
};

// Mock Toast notifications
import { toast } from 'sonner';
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));
```

#### Component Rendering Patterns
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Auth Component', () => {
  it('should handle sign in', async () => {
    const user = userEvent.setup();

    render(<Auth />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');

    const button = screen.getByRole('button', { name: /sign in/i });
    await user.click(button);

    // Assert results
  });
});
```

## Coverage

### Areas Requiring Test Coverage

#### High Priority (Core Functionality)
- **Authentication Module** (`src/pages/Auth.tsx`)
  - Sign up validation (email, password requirements)
  - Sign in error handling
  - Password reset flow
  - Email enumeration prevention
  - Hospital signup flow
  - "Remember me" functionality
  - OAuth callback handling

- **Error Handling** (`src/lib/errorUtils.ts`)
  - Error message sanitization
  - Database error code mapping (23505, 23503, 23514)
  - JWT/token error detection
  - Network error handling
  - Rate limit detection

- **Supabase Integration** (`src/integrations/supabase/client.ts`)
  - Dynamic storage adapter (localStorage vs sessionStorage)
  - CSRF token injection
  - Custom fetch wrapper behavior
  - Environment variable validation
  - Session persistence

- **Forms with Validation**
  - Zod schema validation
  - Field-level validation
  - Form submission prevention (double-click)
  - Error message display

#### Medium Priority (UI Components)
- **ErrorBoundary Component**
  - Error catching and display
  - Recovery actions (Try Again, Go Home)
  - Development vs production error display
  - Error logging trigger

- **Loading States** (`src/components/LoadingSpinner.tsx`)
  - Size variants (sm, md, lg)
  - Text display
  - Full screen mode
  - CSS animation classes

- **UI Components** (`src/components/ui/`)
  - Button variants and states
  - Form inputs and labels
  - Dialog/Modal open/close
  - Select and dropdown behavior

- **Utility Functions**
  - `cn()` class merging
  - `sanitizeErrorMessage()` error transformation
  - Date/time utilities
  - Validation helpers

#### Lower Priority (Integration/E2E)
- **Multi-page Flows** (E2E)
  - Complete sign-up → verification → login flow
  - Hospital registration approval flow
  - Dashboard navigation
  - Permission-based routing

- **API Integration** (Integration Tests)
  - Supabase query builder calls
  - Edge function invocations
  - Error response handling
  - Token refresh flows

### Coverage Gaps & Recommendations
- **No Unit Tests**: Add tests for utilities, error handling, validation
- **No Component Tests**: Add tests for reusable UI components
- **No Integration Tests**: Test component interactions and API calls
- **No E2E Tests**: Playwright or Cypress for user flow testing
- **No Mock Data**: Create fixtures for test data (users, opportunities, hospitals)

### Current Coverage: 0%
- No test files present in source directory
- No test execution configured
- No coverage reporting tools installed

## Running Tests

### Recommended Test Setup

#### 1. Install Testing Dependencies
```bash
# Unit testing framework
npm install -D vitest @vitest/ui
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
npm install -D @vitest/coverage-v8

# Optional: E2E testing
npm install -D playwright @playwright/test
npm install -D @percy/cli
```

#### 2. Create Configuration Files

**vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### 3. Create Setup File
**src/tests/setup.ts**
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => cleanup());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

#### 4. Add Test Scripts to package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### CI/CD Integration
**GitHub Actions Example** (.github/workflows/test.yml)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### Best Practices
1. **Arrange-Act-Assert Pattern**: Organize tests clearly
2. **Descriptive Names**: Test names should explain what they test
3. **Isolation**: Each test should be independent
4. **Minimal Mocks**: Only mock external dependencies
5. **User-Centric**: Test from user perspective, not implementation
6. **Async Handling**: Use async/await and waitFor for async operations
7. **Coverage Goals**: Aim for 80%+ coverage on critical paths
