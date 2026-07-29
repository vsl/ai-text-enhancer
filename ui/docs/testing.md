# Testing Guide

Comprehensive guide to testing strategies, commands, organization, and best practices for the AI Text Enhancer project.

## Overview

The project uses a multi-layered testing approach:

- **Unit Tests** - Pure logic and utility functions (Jest + React Testing Library)
- **Integration Tests** - Component interactions and modals (Jest + React Testing Library)
- **E2E Tests** - Full user journeys (Playwright)

**Coverage Target:** Maintain >90% coverage for core logic

## Test Commands

### Unit and Integration Tests (Jest)

```bash
# Run all tests
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
# Opens: coverage/lcov-report/index.html

# Run specific test file
npm run test -- path/to/test.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="test name pattern"
```

### E2E Tests (Playwright)

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run tests in Playwright UI mode (interactive)
npm run test:e2e:ui

# Run tests with browser visible
npm run test:e2e:headed

# Run specific E2E test file
npm run test:e2e -- path/to/test.spec.ts
```

### One-Time Setup

Install Playwright browsers (required for E2E tests):

```bash
npx playwright install --with-deps
```

## Test Organization

### Directory Structure

```
__tests__/
├── unit/              # Pure logic and utility functions
│   ├── utils.test.ts
│   ├── constants.test.ts
│   └── hooks/
│       └── useLocalStorage.test.ts
│
├── integration/       # Component interactions and modals
│   ├── ConfigEditorModal.test.tsx
│   ├── WorkflowContext.test.tsx
│   └── AuthContext.test.tsx
│
e2e/                   # Full user journeys
├── workflow-management.spec.ts
├── text-enhancement.spec.ts
├── authentication.spec.ts
└── theme-toggle.spec.ts
```

### Test Categories

#### Unit Tests (`__tests__/unit/`)

**Purpose:** Test pure logic and utility functions in isolation

**What to test:**
- Utility functions in `src/lib/utils.ts`
- Constants validation
- Custom hooks (e.g., `useLocalStorage`)
- Type guards and validators

**Example:**
```typescript
// __tests__/unit/utils.test.ts
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('combines class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
});
```

#### Integration Tests (`__tests__/integration/`)

**Purpose:** Test component interactions, modals, and context integration

**What to test:**
- Modal components (open, close, form submission)
- Context providers and consumers
- Component interactions with state
- Form validation and error handling

**Example:**
```typescript
// __tests__/integration/ConfigEditorModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal';

describe('ConfigEditorModal', () => {
  it('updates config on save', async () => {
    const onSave = jest.fn();
    render(<ConfigEditorModal open={true} onSave={onSave} />);

    // Interact with modal
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalled();
  });
});
```

#### E2E Tests (`e2e/`)

**Purpose:** Test complete user flows across the application

**What to test:**
- Workflow management (create, switch, delete)
- Text enhancement end-to-end
- Authentication flows (login, signup, logout)
- Theme toggle and persistence
- Multi-assistant batch processing

**Example:**
```typescript
// e2e/workflow-management.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and switch workflows', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Create new workflow
  await page.click('text=Create Workflow');
  await page.fill('input[name="name"]', 'My Workflow');
  await page.click('text=Create');

  // Verify workflow appears in tabs
  await expect(page.locator('text=My Workflow')).toBeVisible();
});
```

## Testing Best Practices

### 1. Test Pure Functions in Isolation

**Good:**
```typescript
// Test utility function directly
import { validateEmail } from '@/lib/utils';

test('validates email correctly', () => {
  expect(validateEmail('user@example.com')).toBe(true);
  expect(validateEmail('invalid')).toBe(false);
});
```

**Avoid:**
```typescript
// Don't test implementation details
expect(component.state.email).toBe('user@example.com');
```

### 2. Test Component Interactions, Not Implementation

**Good:**
```typescript
// Test user interactions
fireEvent.click(screen.getByRole('button', { name: 'Save' }));
expect(screen.getByText('Saved successfully')).toBeInTheDocument();
```

**Avoid:**
```typescript
// Don't test internal state directly
expect(component.state.isSaved).toBe(true);
```

### 3. Test Context Integration

**Good:**
```typescript
// Wrap component with context provider
const wrapper = ({ children }) => (
  <WorkflowProvider>{children}</WorkflowProvider>
);

render(<MyComponent />, { wrapper });
```

### 4. Use Data Attributes for Stable Selectors

**In components:**
```tsx
<button data-testid="enhance-button">Enhance Text</button>
```

**In tests:**
```typescript
const enhanceButton = screen.getByTestId('enhance-button');
fireEvent.click(enhanceButton);
```

**Why:** Class names and text may change, but data-testid attributes remain stable.

### 5. Maintain Coverage Targets

**Core logic:** >90% coverage
**UI components:** >80% coverage
**Integration flows:** All critical paths covered

**Check coverage:**
```bash
npm run test:coverage
```

Open `coverage/lcov-report/index.html` to view detailed coverage report.

## Common Test Patterns

### Testing Modal Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateWorkflowModal } from '@/components/features/CreateWorkflowModal';

describe('CreateWorkflowModal', () => {
  it('creates workflow on form submission', async () => {
    const onCreate = jest.fn();

    render(
      <CreateWorkflowModal
        open={true}
        onClose={() => {}}
        onCreate={onCreate}
      />
    );

    // Fill form
    const input = screen.getByLabelText('Workflow Name');
    fireEvent.change(input, { target: { value: 'My Workflow' } });

    // Submit
    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    // Verify
    expect(onCreate).toHaveBeenCalledWith('My Workflow');
  });
});
```

### Testing Context Providers

```typescript
import { renderHook, act } from '@testing-library/react';
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext';

describe('WorkflowContext', () => {
  it('adds config to workflow', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    );

    const { result } = renderHook(() => useWorkflow(), { wrapper });

    act(() => {
      result.current.handleAddConfig();
    });

    expect(result.current.configs).toHaveLength(4); // 3 default + 1 new
  });
});
```

### Testing Async Operations

```typescript
import { render, screen, waitFor } from '@testing-library/react';

describe('TextEnhancement', () => {
  it('displays enhanced text after API call', async () => {
    // Mock API
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          results: [{
            id: '1',
            status: 'success',
            enhancedText: 'Enhanced text here'
          }]
        })
      })
    );

    render(<TextEnhancementPage />);

    // Trigger enhancement
    fireEvent.click(screen.getByText('Enhance'));

    // Wait for result
    await waitFor(() => {
      expect(screen.getByText('Enhanced text here')).toBeInTheDocument();
    });
  });
});
```

### Testing E2E with Playwright

```typescript
import { test, expect } from '@playwright/test';

test.describe('Text Enhancement Flow', () => {
  test('enhances text successfully', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000/text-ai-assistants');

    // Fill input
    await page.fill('textarea[placeholder*="Enter your text"]', 'test text');

    // Click enhance
    await page.click('button:has-text("Enhance Text")');

    // Wait for result
    await page.waitForSelector('text=Enhanced');

    // Verify result appears
    const result = await page.textContent('[data-testid="result-0"]');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });
});
```

## Mock Data and Fixtures

### Mock Workflows

```typescript
export const mockWorkflow: Workflow = {
  name: 'Test Workflow',
  configs: [
    {
      id: 1,
      model: 'gemini-flash',
      aiRole: 'General Assistant',
      enabled: true,
      options: {
        improve: true,
        fixMistakes: true,
        format: false,
        shorten: false,
        lengthen: false,
        addEmojis: false,
        formality: 'Neutral',
        tone: 'Confident',
        languageLevel: '',
        translateTo: ''
      }
    }
  ]
};
```

### Mock API Responses

```typescript
export const mockEnhanceResponse = {
  results: [
    {
      id: '1',
      status: 'success',
      enhancedText: 'This is enhanced text.',
      total_tokens: 42
    }
  ]
};

export const mockErrorResponse = {
  results: [
    {
      id: '1',
      status: 'error',
      error: {
        code: 'INSUFFICIENT_QUOTA',
        message: 'Not enough tokens'
      }
    }
  ]
};
```

## Continuous Integration

The `UI` GitHub Actions workflow runs Jest and the production build for UI
changes. Cloudflare Pages publishes the static export after changes reach its
connected branch. Run Playwright locally before merging when a user flow changes:

```bash
npm test
npm run test:e2e
```

## Debugging Tests

### Jest Tests

**Run single test file:**
```bash
npm run test -- ConfigEditorModal.test.tsx
```

**Run tests matching pattern:**
```bash
npm run test -- --testNamePattern="creates workflow"
```

**Debug with Node inspector:**
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests

**Debug mode (opens DevTools):**
```bash
npx playwright test --debug
```

**Headed mode (see browser):**
```bash
npm run test:e2e:headed
```

**UI mode (interactive):**
```bash
npm run test:e2e:ui
```

## Test Coverage Reports

**Generate coverage:**
```bash
npm run test:coverage
```

**Coverage output:**
- Console: Summary table
- HTML: `coverage/lcov-report/index.html`
- LCOV: `coverage/lcov.info`

**Viewing HTML report:**
```bash
# macOS
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html
```

## Testing Checklist

Before submitting a PR, ensure:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Coverage >90% for new code
- [ ] No console errors or warnings
- [ ] Test data attributes added for new components
- [ ] Edge cases covered (empty state, error state, loading state)
- [ ] Accessibility tested (keyboard navigation, screen readers)

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
