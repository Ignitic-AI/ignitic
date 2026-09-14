# Testing Strategy & Guidelines

This document describes the recommended testing approach for the Ignitic AI frontend.

> **Current state:** The project does not yet have a testing suite configured. This document defines the recommended strategy to adopt as the codebase matures.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Testing Levels](#2-testing-levels)
3. [Recommended Tooling](#3-recommended-tooling)
4. [Setting Up the Test Environment](#4-setting-up-the-test-environment)
5. [Unit Tests](#5-unit-tests)
6. [Component Tests](#6-component-tests)
7. [Integration Tests](#7-integration-tests)
8. [End-to-End Tests](#8-end-to-end-tests)
9. [Test Coverage Targets](#9-test-coverage-targets)
10. [Running Tests in CI](#10-running-tests-in-ci)

---

## 1. Testing Philosophy

The testing strategy follows the **Testing Trophy** model, emphasizing integration tests that provide high confidence with manageable overhead:

```
        /\
       /  \          E2E Tests (few, critical paths)
      /────\
     /      \        Integration Tests (medium)
    /────────\
   /          \      Component Tests (many)
  /────────────\
 /              \    Unit Tests (utility functions)
/────────────────\
```

Tests should:
- Be **co-located** with the code they test (`*.test.ts` next to the source file or in `__tests__/` subdirectories).
- Prefer testing **behavior over implementation** — what the user sees and does, not internal implementation details.
- Mock only what is necessary (external APIs, WebSocket connections).

---

## 2. Testing Levels

| Level | Scope | Tools |
|---|---|---|
| **Unit** | Pure functions (`lib/`, `utils/`, store actions) | Vitest |
| **Component** | Individual React components | React Testing Library + Vitest |
| **Integration** | Multiple components working together, API interactions | React Testing Library + MSW |
| **E2E** | Full user flows in a real browser | Playwright |

---

## 3. Recommended Tooling

| Tool | Purpose | Rationale |
|---|---|---|
| [Vitest](https://vitest.dev/) | Test runner + assertions | Fast, native ESM support, compatible with Vite ecosystem |
| [React Testing Library](https://testing-library.com/react) | Component testing | Encourages behavior-based tests |
| [Mock Service Worker (MSW)](https://mswjs.io/) | API mocking | Intercepts fetch/axios at the network level for realistic mocks |
| [Playwright](https://playwright.dev/) | E2E browser tests | Supports Chromium, Firefox, WebKit; excellent for SSR apps |
| [jest-dom](https://github.com/testing-library/jest-dom) | DOM assertions | Custom matchers like `toBeInTheDocument()` |

---

## 4. Setting Up the Test Environment

### Install dependencies

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw playwright
```

### Vitest config (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Test setup file (`src/test/setup.ts`)

```typescript
import '@testing-library/jest-dom'
```

### Add test scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## 5. Unit Tests

Unit tests cover pure utility functions and Zustand store logic.

### Priority targets

| Module | What to test |
|---|---|
| `lib/credits.ts` | `canUseAction`, `featureEnabled`, `modelAllowed`, `toolAllowed`, `calculateEstimatedCost` |
| `lib/auth.ts` | `isBackendTokenExpired` edge cases |
| `lib/validations.ts` | Zod schema validation for step1Schema and step2Schema |
| `app/_store/useOrgStore.ts` | `syncOrganizations`, `removeOrganization`, `setCurrentOrg` |
| `app/(sidebar)/analytics/analytics-types.ts` | `migrateStoredWidget` migration logic |

### Example: credits.ts unit test

```typescript
import { describe, it, expect } from 'vitest'
import { canUseAction } from '@/lib/credits'

const mockOverview = {
  owner_type: 'user' as const,
  owner_id: '1',
  plan: 'pro',
  total_credits: 1000,
  credits_consumed: 0,
  available_credits: 1000,
  cycle_start: '2024-01-01',
  cycle_end: '2024-01-31',
  status: 'active',
}

const mockEntitlements = {
  plan: 'pro',
  rules: {
    features: { chat_message: true },
    limits: {},
    costs: {
      action_costs: { chat_message: { base: 10 } },
      model_multipliers: { 'gpt-4o': 2 },
    },
  },
}

describe('canUseAction', () => {
  it('allows action when credits are sufficient', () => {
    const result = canUseAction(mockOverview, mockEntitlements, 'chat_message')
    expect(result.allowed).toBe(true)
    expect(result.estimatedCost).toBe(10)
  })

  it('blocks action when credits are insufficient', () => {
    const overview = { ...mockOverview, available_credits: 5 }
    const result = canUseAction(overview, mockEntitlements, 'chat_message')
    expect(result.allowed).toBe(false)
  })

  it('applies model multiplier to estimated cost', () => {
    const result = canUseAction(mockOverview, mockEntitlements, 'chat_message', 'gpt-4o')
    expect(result.estimatedCost).toBe(20) // 10 * 2.0
  })
})
```

---

## 6. Component Tests

Component tests verify that UI components render correctly and respond to user interactions.

### Priority targets

| Component | Key behaviors to test |
|---|---|
| `SignIn.tsx` | Renders form, submits credentials, shows error on failure |
| `OrgDropdown.tsx` | Lists organizations, switches active org on selection |
| `PromptBox.tsx` | Renders input, handles submit |
| `Checklist.tsx` | Renders todos, marks complete |
| `DashboardMetrics.tsx` | Renders metric cards |
| `Step1.tsx` – `Step4.tsx` | Renders form fields, updates store on change |

### Example: OrgDropdown component test

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { OrgDropdown } from '@/components/OrgDropdown'
import { useOrgStore } from '@/app/_store/useorgStore'

// Mock zustand store
vi.mock('@/app/_store/useorgStore')

describe('OrgDropdown', () => {
  it('displays the current organization name', () => {
    (useOrgStore as any).mockReturnValue({
      currentOrg: { id: '1', name: 'Acme Corp' },
      organizations: [{ id: '1', name: 'Acme Corp' }],
      setCurrentOrg: vi.fn(),
    })

    render(<OrgDropdown />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})
```

---

## 7. Integration Tests

Integration tests cover multi-component interactions and API-driven flows using MSW to mock the backend.

### MSW Setup

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      name: 'Test User',
      email: 'test@example.com',
    })
  }),

  http.get('/api/v1/organizations', () => {
    return HttpResponse.json({
      organizations: [
        { id: 1, name: 'Test Org', user_role: 'owner', /* ... */ }
      ]
    })
  }),
]
```

### Priority integration scenarios

- Sign-in flow: renders form → submits → session created → redirects to dashboard
- Organization loading: fetches orgs on mount → displays org cards
- Onboarding step validation: prevents advancing on invalid input

---

## 8. End-to-End Tests

E2E tests use **Playwright** to run critical user journeys against a real (or test) environment.

### Critical paths to test

| Flow | Steps |
|---|---|
| **Sign in** | Navigate to `/signin` → Enter credentials → Verify redirect to `/` |
| **Onboarding** | Complete all 4 onboarding steps → Verify dashboard redirect |
| **New chat** | Click Chat in sidebar → Verify unique chat URL generated |
| **Shared chat** | Visit `/shared/chat/{token}` without auth → Verify messages displayed |
| **Organization creation** | Fill create org form → Submit → Verify org appears in list |

### Example Playwright test

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test('user can sign in with valid credentials', async ({ page }) => {
  await page.goto('/signin')
  await page.fill('[name="email"]', 'user@example.com')
  await page.fill('[name="password"]', 'password')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
})
```

### Playwright config (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
```

---

## 9. Test Coverage Targets

| Layer | Target |
|---|---|
| `lib/` utilities | ≥ 90% |
| Zustand store actions | ≥ 80% |
| Core components | ≥ 70% |
| E2E critical paths | 100% (all listed flows) |

---

## 10. Running Tests in CI

Add the following job to your GitHub Actions workflow (see [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)):

```yaml
test:
  name: Unit & Component Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm test -- --run          # Vitest in CI mode (non-interactive)
    - run: npm run test:coverage

e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npx playwright install --with-deps
    - name: Start dev server
      run: npm run dev &
      env:
        NEXT_PUBLIC_API_URL: ${{ secrets.TEST_API_URL }}
        NEXTAUTH_SECRET: test-secret
        NEXTAUTH_URL: http://localhost:3000
    - run: npm run test:e2e
```
