# UI/UX Improvement Tasks

This document contains actionable tasks to improve the UI/UX of the AI Text Enhancer application. Each task includes the issue, location, and expected implementation.

## Progress Summary
- **Completed:** 20/23 tasks (87%)
- **Time saved:** ~6 hours 40 minutes (CRITICAL: 25min, HIGH: 2h 50min, MEDIUM: 2h 10min, LOW: 1h 15min)
- **Remaining:** 3 tasks (~1 hour 15 minutes)

### Completion by Priority
- 🔴 **CRITICAL:** 2/2 completed (100%) ✅
- 🟠 **HIGH:** 5/5 completed (100%) ✅
- 🟡 **MEDIUM:** 5/6 completed (83%) 🎯
- 🟢 **LOW:** 8/10 completed (80%) ✅

## Priority Legend
- 🔴 **CRITICAL** - Must fix immediately (affects accessibility/functionality)
- 🟠 **HIGH** - Should fix soon (major UX/quality issues)
- 🟡 **MEDIUM** - Important improvements (nice to have)
- 🟢 **LOW** - Minor enhancements (future improvements)

---

## 🔴 CRITICAL PRIORITY

### Task 1: Add prefers-reduced-motion support ✅ COMPLETED
**Issue:** Animations don't respect user's motion preferences (WCAG 2.1 violation)
**File:** `src/app/globals.css`
**WCAG:** 2.1 Success Criterion 2.3.3 (Animation from Interactions)
**Status:** ✅ Implemented in `src/app/globals.css:123-132`

**What to do:**
Add CSS media query to disable/reduce animations for users who prefer reduced motion.

**Implementation:**
Add this to `src/app/globals.css` after the `@layer base` section:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }

  /* Add this new section */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

---

### Task 2: Add error boundary files ✅ COMPLETED
**Issue:** No error.tsx files to catch and display errors gracefully
**Files created:**
- `src/app/error.tsx` ✅
- `src/app/text-ai-assistants/error.tsx` ✅
**Status:** ✅ Both error boundary files implemented

**What to do:**
Create error boundary files to handle runtime errors gracefully.

**Implementation:**
Create `src/app/error.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
      <h2 className="text-2xl font-bold text-center">Something went wrong!</h2>
      <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

Create `src/app/text-ai-assistants/error.tsx` with the same content.

---

## 🟠 HIGH PRIORITY

### Task 3: Fix Map mutation bug in handleResultTextChange ✅ COMPLETED
**Issue:** Direct mutation of Map without updating context state
**File:** `src/app/text-ai-assistants/page.tsx` (lines 148-158)
**Status:** ✅ Removed broken function and onChange prop

**What to do:**
Either remove this unused handler or integrate it properly with WorkflowContext.

**Current code (BROKEN):**
```tsx
const handleResultTextChange = (newText: string, configId: number) => {
  const currentResult = results.get(configId);
  if (currentResult) {
    results.set(configId, { ...currentResult, text: newText }); // Direct mutation!
  }
};
```

**Option 1 - Remove (RECOMMENDED):**
Delete lines 148-158 and remove the `onChange` prop from ResultTextarea at line 436.

**Option 2 - Fix properly:**
1. Add this handler to `src/context/WorkflowContext.tsx`:

```tsx
const handleUpdateResult = useCallback((configId: number, newText: string) => {
  setResults(prevResults => {
    const newResults = new Map(prevResults);
    const current = newResults.get(configId);
    if (current) {
      newResults.set(configId, { ...current, text: newText });
    }
    return newResults;
  });
}, []);
```

2. Export it from the context interface
3. Use it in the page component

---

### Task 4: Add autocomplete attributes to form inputs ✅ COMPLETED
**Issue:** Missing autocomplete attributes on email/password fields
**Files:**
- `src/components/features/auth/LoginModal.tsx` ✅
- `src/components/features/auth/SignUpModal.tsx` ✅
- `src/components/features/auth/ForgotPasswordModal.tsx` ✅

**WCAG:** 2.1 Success Criterion 1.3.5 (Identify Input Purpose)
**Status:** ✅ All form inputs now have proper autocomplete attributes

**What to do:**
Add `autoComplete` attributes to all form inputs.

**Implementation:**
In `LoginModal.tsx`:

```tsx
<input
  id="login-email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="you@example.com"
  required
  autoComplete="email" // ADD THIS
  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
/>

<input
  id="login-password"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="Enter your password"
  required
  autoComplete="current-password" // ADD THIS
  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
/>
```

In `SignUpModal.tsx`, use `autoComplete="new-password"` for password fields.

Apply similar changes to all form inputs.

---

### Task 5: Add password visibility toggle ✅ COMPLETED
**Issue:** Password fields lack show/hide toggle button
**Files:**
- `src/components/features/auth/LoginModal.tsx` ✅
- `src/components/features/auth/SignUpModal.tsx` ✅
**Status:** ✅ Password visibility toggles with Eye/EyeOff icons added

**What to do:**
Add a button to toggle password visibility.

**Implementation:**
1. Import Eye icons:
```tsx
import { Eye, EyeOff } from 'lucide-react';
```

2. Add state:
```tsx
const [showPassword, setShowPassword] = useState(false);
```

3. Update password input:
```tsx
<div className="space-y-2">
  <label htmlFor="login-password" className="text-sm font-medium">
    Password
  </label>
  <div className="relative">
    <input
      id="login-password"
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Enter your password"
      required
      autoComplete="current-password"
      className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
</div>
```

---

### Task 6: Refactor large TextAIAssistantsContent component ✅ COMPLETED
**Issue:** Component is 543 lines with mixed concerns
**Files:**
- `src/app/text-ai-assistants/page.tsx` ✅ (reduced from 543 to ~400 lines)
- `src/components/features/AssistantCard.tsx` ✅ (NEW - 190 lines)
**Status:** ✅ Extracted AssistantCard component, improved maintainability

**What to do:**
Extract smaller sub-components for better maintainability.

**Implementation:**
1. Create `src/components/features/AssistantCard.tsx`:

```tsx
'use client';

import { AiConfig, Result } from '@/lib/types';
import { ToggleSwitch } from './ToggleSwitch';
import { ConfigSummaryTags } from './ConfigSummaryTags';
import { ResultTextarea } from './ResultTextarea';
import { LoadingSpinner } from './LoadingSpinner';
import { InfoTooltip } from './InfoTooltip';
import { TOOLTIP_TEXTS } from '@/lib/constants';

interface AssistantCardProps {
  config: AiConfig;
  result?: Result;
  onToggle: (id: number) => void;
  onEdit: (id: number) => void;
  onCopy: (id: number) => void;
  onRemove: (id: number) => void;
  onCopyResult: (text: string) => void;
  onImproveVersion: (text: string) => void;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
}

export function AssistantCard({
  config,
  result,
  onToggle,
  onEdit,
  onCopy,
  onRemove,
  onCopyResult,
  onImproveVersion,
  isMenuOpen,
  onMenuToggle,
}: AssistantCardProps) {
  return (
    <li
      data-testid={`assistant-card-${config.id}`}
      className={`bg-background p-6 rounded-lg border flex flex-col gap-4 relative transition-opacity duration-300 ${
        !config.enabled ? 'opacity-60' : ''
      }`}
      style={{ borderColor: result?.error ? 'var(--destructive)' : 'var(--border)' }}
    >
      {/* Assistant Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 flex-grow">
          <div className="flex items-center gap-3">
            <ToggleSwitch
              id={`toggle-${config.id}`}
              checked={config.enabled}
              onChange={() => onToggle(config.id)}
            />
            <h3 className="text-base text-secondary m-0">{config.aiRole}</h3>
          </div>
          <small className="text-muted-foreground">{config.model}</small>
        </div>

        {/* Kebab Menu */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            data-testid={`kebab-menu-${config.id}`}
            className="bg-transparent border-none p-1 rounded-full cursor-pointer leading-none hover:bg-surface-hover transition-colors"
            onClick={onMenuToggle}
            aria-label="More options"
            title="More options"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="fill-muted-foreground hover:fill-foreground transition-colors"
              aria-hidden="true"
            >
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
            </svg>
          </button>
          {isMenuOpen && (
            <div className="absolute top-[calc(100%+4px)] right-0 bg-surface-hover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-10 w-[180px] overflow-hidden py-2">
              <button
                data-testid={`edit-assistant-${config.id}`}
                onClick={() => onEdit(config.id)}
                className="block w-full px-4 py-3 bg-none border-none text-foreground text-left cursor-pointer text-sm rounded-none hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Edit Assistant
              </button>
              <button
                data-testid={`duplicate-assistant-${config.id}`}
                onClick={() => onCopy(config.id)}
                className="block w-full px-4 py-3 bg-none border-none text-foreground text-left cursor-pointer text-sm rounded-none hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Duplicate Assistant
              </button>
              <button
                data-testid={`remove-assistant-${config.id}`}
                onClick={() => onRemove(config.id)}
                className="block w-full px-4 py-3 bg-none border-none text-destructive text-left cursor-pointer text-sm rounded-none hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                Remove Assistant
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Config Summary Tags */}
      <ConfigSummaryTags options={config.options} onClick={() => onEdit(config.id)} />

      {/* Assistant Card Body */}
      <div className="bg-card rounded-lg p-4 min-h-[100px] flex flex-col">
        {result?.isLoading ? (
          <div className="mx-auto my-8">
            <LoadingSpinner />
            <span className="sr-only">Loading...</span>
          </div>
        ) : result ? (
          <div className="flex flex-col">
            <ResultTextarea
              value={result.text}
              onChange={() => {}} // Remove this if not needed
              aria-label="Generated text"
            />
            <div className="mt-4 flex justify-end items-center gap-2">
              {!result.error && (
                <button
                  data-testid={`improve-version-${config.id}`}
                  onClick={() => onImproveVersion(result.text)}
                  className="flex items-center gap-2 px-6 py-3 bg-muted hover:bg-muted-foreground/20 text-foreground rounded-lg transition-colors cursor-pointer"
                  title="Use this text as the next input"
                >
                  Improve this Version
                  <InfoTooltip text={TOOLTIP_TEXTS.useThisText} position="left" />
                </button>
              )}
              <button
                data-testid={`copy-result-${config.id}`}
                onClick={() => onCopyResult(result.text)}
                className="bg-transparent border-none p-2 opacity-60 hover:opacity-100 hover:text-secondary transition-all leading-none cursor-pointer"
                aria-label="Copy result to clipboard"
                title="Copy result to clipboard"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6Z"
                  />
                  <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground m-auto flex flex-col gap-2">
            <p className="font-medium">Ready to enhance your text?</p>
            <p className="text-sm">Enter text in the input field and click "Enhance Text" to see results here.</p>
          </div>
        )}
      </div>
    </li>
  );
}
```

2. Update `src/app/text-ai-assistants/page.tsx` to use the new component:

```tsx
import { AssistantCard } from '@/components/features/AssistantCard';

// In the render:
{configs.map((config) => (
  <AssistantCard
    key={config.id}
    config={config}
    result={results.get(config.id)}
    onToggle={handleToggleAssistant}
    onEdit={handleOpenEditModal}
    onCopy={handleCopyConfig}
    onRemove={handleRemoveConfig}
    onCopyResult={copyToClipboard}
    onImproveVersion={handleImproveThisVersion}
    isMenuOpen={openMenuId === config.id}
    onMenuToggle={() => setOpenMenuId(openMenuId === config.id ? null : config.id)}
  />
))}
```

---

### Task 7: Add unsaved changes confirmation ✅ COMPLETED
**Issue:** User can close ConfigEditorModal with unsaved changes without warning
**File:** `src/components/features/ConfigEditorModal.tsx` ✅
**Status:** ✅ Confirmation dialog added when closing with unsaved changes

**What to do:**
Add confirmation dialog when closing with dirty form state.

**Implementation:**
Update the Sheet's `onOpenChange` handler:

```tsx
const handleClose = () => {
  if (isFormDirty) {
    const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
    if (!confirmed) return;
  }
  onClose();
};

// Update Sheet component:
<Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
```

---

## 🟡 MEDIUM PRIORITY

### Task 8: Fix Jest coverage configuration
**Issue:** Coverage report shows 0% despite 137 passing tests
**File:** `jest.config.js`

**What to do:**
Fix Jest configuration to properly track code coverage.

**Implementation:**
Ensure your `jest.config.js` includes:

```js
module.exports = {
  // ... existing config
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/out/',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

### Task 9: Add loading.tsx files ✅ COMPLETED
**Issue:** No loading states for route transitions
**Files created:**
- `src/app/loading.tsx` ✅
- `src/app/text-ai-assistants/loading.tsx` ✅
**Status:** ✅ Loading files created with LoadingSpinner component

**What to do:**
Create loading UI for better perceived performance.

**Implementation:**
Create `src/app/text-ai-assistants/loading.tsx`:

```tsx
import { LoadingSpinner } from '@/components/features/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <LoadingSpinner />
      <span className="sr-only">Loading AI Text Enhancer...</span>
      <p className="text-muted-foreground">Loading your workspace...</p>
    </div>
  );
}
```

---

### Task 10: Replace manual kebab menu with DropdownMenu ✅ COMPLETED
**Issue:** Manual state management for dropdown menus
**Files:**
- `src/components/ui/dropdown-menu.tsx` ✅ (NEW)
- `src/components/features/AssistantCard.tsx` ✅
- `src/app/text-ai-assistants/page.tsx` ✅
**Status:** ✅ Radix UI DropdownMenu implemented, removed manual state management

**What to do:**
Use Radix UI's DropdownMenu component for better UX and accessibility.

**Implementation:**
1. Create `src/components/ui/dropdown-menu.tsx`:

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[180px] overflow-hidden rounded-lg border bg-surface-hover p-2 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded px-4 py-3 text-sm outline-none transition-colors",
      "hover:bg-primary hover:text-primary-foreground",
      "focus:bg-primary focus:text-primary-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
```

2. Install the package:
```bash
npm install @radix-ui/react-dropdown-menu
```

3. Update AssistantCard (or the main page) to use it:

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Replace the manual menu with:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      data-testid={`kebab-menu-${config.id}`}
      className="bg-transparent border-none p-1 rounded-full cursor-pointer leading-none hover:bg-surface-hover transition-colors"
      aria-label="More options"
      title="More options"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="fill-muted-foreground hover:fill-foreground transition-colors"
        aria-hidden="true"
      >
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
      </svg>
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => handleOpenEditModal(config.id)}>
      Edit Assistant
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleCopyConfig(config.id)}>
      Duplicate Assistant
    </DropdownMenuItem>
    <DropdownMenuItem
      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
      onSelect={() => handleRemoveConfig(config.id)}
    >
      Remove Assistant
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

4. Remove the window click listener useEffect (lines 59-69) and `openMenuId` state.

---

### Task 11: Add copy button feedback ✅ COMPLETED
**Issue:** No visual confirmation when copying to clipboard
**Files:**
- `src/app/text-ai-assistants/page.tsx` ✅
- `src/components/features/AssistantCard.tsx` ✅
**Status:** ✅ Copy feedback with Check icon shows for 2 seconds after copying

**What to do:**
Add temporary visual feedback when copy succeeds.

**Implementation:**
1. Import Check icon:
```tsx
import { Copy, Check } from 'lucide-react';
```

2. Add state:
```tsx
const [copiedId, setCopiedId] = useState<number | null>(null);
```

3. Update copyToClipboard function:
```tsx
const copyToClipboard = (text: string, configId: number) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      setCopiedId(configId);
      setTimeout(() => setCopiedId(null), 2000);
    })
    .catch((err) => console.error('Failed to copy: ', err));
};
```

4. Update button:
```tsx
<button
  data-testid={`copy-result-${config.id}`}
  onClick={() => copyToClipboard(result.text, config.id)}
  className="bg-transparent border-none p-2 opacity-60 hover:opacity-100 hover:text-secondary transition-all leading-none cursor-pointer"
  aria-label={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
  title={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
>
  {copiedId === config.id ? (
    <Check className="h-5 w-5 text-green-500" />
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6Z"
      />
      <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z" />
    </svg>
  )}
</button>
```

---

### Task 12: Add form field-level validation ✅ COMPLETED
**Issue:** Form validation only occurs on submit
**Files:**
- `src/components/features/auth/LoginModal.tsx` ✅
- `src/components/features/auth/SignUpModal.tsx` ✅
**Status:** ✅ Real-time field validation with error messages and ARIA attributes

**What to do:**
Add real-time validation feedback as user types.

**Implementation:**
1. Add validation state:
```tsx
const [emailError, setEmailError] = useState('');
const [passwordError, setPasswordError] = useState('');
```

2. Add validation functions:
```tsx
const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Invalid email format';
  return '';
};

const validatePassword = (password: string) => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return '';
};
```

3. Update inputs:
```tsx
<input
  id="login-email"
  type="email"
  value={email}
  onChange={(e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(validateEmail(e.target.value));
  }}
  onBlur={(e) => setEmailError(validateEmail(e.target.value))}
  placeholder="you@example.com"
  required
  autoComplete="email"
  aria-invalid={!!emailError}
  aria-describedby={emailError ? 'email-error' : undefined}
  className={`w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:border-primary ${
    emailError ? 'border-destructive' : 'border-border'
  }`}
/>
{emailError && (
  <p id="email-error" className="text-destructive text-sm mt-1">{emailError}</p>
)}
```

Apply similar pattern to password field.

---

### Task 13: Standardize responsive breakpoint patterns ✅ COMPLETED
**Issue:** Mixing min-width and max-width breakpoints
**File:** `src/app/text-ai-assistants/page.tsx` ✅
**Status:** ✅ Converted to mobile-first approach with min-width breakpoints only

**What to do:**
Use consistent mobile-first approach with only min-width breakpoints.

**Implementation:**
Replace:
```tsx
className="w-1/4 flex-shrink-0 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto max-lg:w-1/2 max-[1400px]:w-1/3 max-md:w-full max-md:static"
```

With:
```tsx
className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4 flex-shrink-0 md:sticky top-8 max-h-[calc(100vh-4rem)] md:overflow-y-auto"
```

---

## 🟢 LOW PRIORITY

### Task 14: Add skip navigation link ✅ COMPLETED
**Issue:** No skip to main content link for keyboard users
**File:** `src/app/layout.tsx` ✅
**WCAG:** 2.1 Success Criterion 2.4.1 (Bypass Blocks)
**Status:** ✅ Skip link added with proper styling and main content ID

**What to do:**
Add skip link as first focusable element.

**Implementation:**
After opening `<body>` tag in layout.tsx:

```tsx
<body className={`${inter.variable} font-sans antialiased`}>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
  >
    Skip to main content
  </a>
  <ThemeProvider
    // ...
  >
```

Then add `id` to main element:
```tsx
<main id="main-content" className="flex-1">{children}</main>
```

---

### Task 15: Add keyboard shortcuts ✅ COMPLETED
**Issue:** No keyboard shortcuts for common actions
**File:** `src/app/text-ai-assistants/page.tsx` ✅
**Status:** ✅ Cmd/Ctrl+Enter keyboard shortcut implemented to trigger enhancement

**What to do:**
Add Cmd+Enter to trigger text enhancement.

**Implementation:**
Add this useEffect:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (inputText.trim() && configs.some((c) => c.enabled)) {
        handleGenerate();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [inputText, configs, handleGenerate]);
```

Add help text near the Enhance button:
```tsx
<p className="text-xs text-muted-foreground text-center mt-2">
  Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to enhance
</p>
```

---

### Task 16: Fix tab panel ARIA attributes ✅ COMPLETED
**Issue:** Tab panels missing proper ARIA relationships
**File:** `src/app/text-ai-assistants/page.tsx` ✅
**WCAG:** 2.1 Success Criterion 4.1.2 (Name, Role, Value)
**Status:** ✅ Added proper ARIA attributes (aria-controls, aria-labelledby, tabIndex) to tabs and panels

**What to do:**
Add proper ARIA attributes to connect tabs with panels.

**Implementation:**
Update tab content div:

```tsx
<div
  className="tab-content"
  role="tabpanel"
  aria-labelledby={`tab-${selectedWorkflow.toLowerCase().replace(/\s+/g, '-')}`}
  id={`panel-${selectedWorkflow.toLowerCase().replace(/\s+/g, '-')}`}
>
```

Update tabs in workflow list:

```tsx
<div
  id={`tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
  data-testid={`workflow-tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
  className={/* ... */}
  onClick={() => handleLoadWorkflow(workflow.name)}
  role="tab"
  aria-selected={selectedWorkflow === workflow.name}
  aria-controls={`panel-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
  tabIndex={selectedWorkflow === workflow.name ? 0 : -1}
>
```

---

### Task 17: Replace role="button" divs with button elements ✅ COMPLETED
**Issue:** Interactive div elements instead of semantic buttons
**File:** `src/components/features/ConfigSummaryTags.tsx` ✅
**WCAG:** 2.1 Success Criterion 4.1.2 (Name, Role, Value)
**Status:** ✅ Replaced div with semantic button element, removed manual keyboard handlers

**What to do:**
Use native button elements for better accessibility.

**Implementation:**
Replace:
```tsx
<div
  role="button"
  onClick={onClick}
  className="cursor-pointer"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick();
    }
  }}
>
```

With:
```tsx
<button
  onClick={onClick}
  className="cursor-pointer bg-transparent border-none p-0"
  type="button"
>
```

---

### Task 19: Add AbortController cleanup on unmount ✅ COMPLETED
**Issue:** Component unmount doesn't abort pending requests
**File:** `src/context/WorkflowContext.tsx` ✅
**Status:** ✅ Added cleanup effect to abort pending requests on unmount

**What to do:**
Add cleanup effect to abort requests on unmount.

**Implementation:**
Add this useEffect at the end of the WorkflowProvider component:

```tsx
// Cleanup on unmount
useEffect(() => {
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);
```

---

### Task 20: Add JSDoc comments to component interfaces ✅ COMPLETED
**Issue:** Missing prop documentation for better DX
**Files:** All component files in `src/components/features/` ✅
**Status:** ✅ Added JSDoc comments to major component interfaces (ConfigEditorModal, AssistantCard, ConfigSummaryTags, CreateWorkflowModal, CharacterCounter, ConfirmationModal)

**What to do:**
Add JSDoc comments to all interface props.

**Implementation example for ConfigEditorModal:**

```tsx
/**
 * Props for the ConfigEditorModal component
 */
interface ConfigEditorModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Callback fired when the modal should close */
  onClose: () => void;
  /** Callback fired when the configuration is saved */
  onSave: (config: AiConfig) => void;
  /** The AI assistant configuration data to edit */
  configData: AiConfig;
  /** Whether we're adding a new assistant or editing an existing one */
  mode: 'add' | 'edit';
}
```

Apply similar documentation to all component interfaces.

---

### Task 21: Improve empty state messaging ✅ COMPLETED
**Issue:** Generic empty state message doesn't guide users
**File:** `src/components/features/AssistantCard.tsx` ✅
**Status:** ✅ Improved empty state with actionable guidance and helpful tips

**What to do:**
Provide actionable guidance in empty states.

**Implementation:**
Replace:
```tsx
<p className="text-center text-muted-foreground m-auto">
  Output will appear here after enhancement.
</p>
```

With:
```tsx
<div className="text-center text-muted-foreground m-auto flex flex-col gap-2 p-4">
  <p className="font-medium text-base">Ready to enhance your text?</p>
  <p className="text-sm">
    Enter text in the input field on the left and click "Enhance Text" to see AI-generated results here.
  </p>
  <p className="text-xs opacity-75">
    Tip: Enable multiple assistants to compare different enhancement styles
  </p>
</div>
```

---

### Task 22: Optimize structuredClone usage ✅ COMPLETED
**Issue:** Deep cloning entire config arrays frequently impacts performance
**File:** `src/context/WorkflowContext.tsx` ✅
**Status:** ✅ Replaced structuredClone with shallow cloning using spread operators for better performance

**What to do:**
Consider using Immer for better immutable update performance.

**Implementation:**
1. Install Immer:
```bash
npm install immer
```

2. Update WorkflowContext:
```tsx
import { produce } from 'immer';

// Replace structuredClone usage with produce:
useEffect(() => {
  const workflowToLoad = workflows.find(w => w.name === selectedWorkflow);

  if (workflowToLoad) {
    const migratedConfigs = workflowToLoad.configs.map(c => ({
      ...c,
      enabled: c.enabled ?? true,
    }));
    setConfigs(migratedConfigs); // No need for deep clone
  } else if (workflows.length > 0) {
    setSelectedWorkflow(workflows[0].name);
  } else {
    setConfigs([]);
  }
}, [selectedWorkflow, workflows, setSelectedWorkflow]);

// For mutations, use produce:
const handleSaveConfig = useCallback((updatedConfig: AiConfig) => {
  setConfigs(prevConfigs => {
    return produce(prevConfigs, draft => {
      const existingIndex = draft.findIndex(c => c.id === updatedConfig.id);
      if (existingIndex > -1) {
        draft[existingIndex] = updatedConfig;
      } else {
        draft.push(updatedConfig);
      }
    });
  });
}, []);
```

---

## Quick Reference: Estimated Time

| Priority | Task | Time Estimate | Status |
|----------|------|---------------|--------|
| 🔴 Critical | Task 1: prefers-reduced-motion | 10 min | ✅ Done |
| 🔴 Critical | Task 2: Error boundaries | 15 min | ✅ Done |
| 🟠 High | Task 3: Fix Map mutation | 5 min | ✅ Done |
| 🟠 High | Task 4: Autocomplete attrs | 15 min | ✅ Done |
| 🟠 High | Task 5: Password toggle | 20 min | ✅ Done |
| 🟠 High | Task 6: Refactor component | 2 hours | ✅ Done |
| 🟠 High | Task 7: Unsaved changes | 10 min | ✅ Done |
| 🟡 Medium | Task 8: Fix Jest coverage | 15 min | ⏳ Pending |
| 🟡 Medium | Task 9: Loading states | 20 min | ✅ Done |
| 🟡 Medium | Task 10: DropdownMenu | 30 min | ✅ Done |
| 🟡 Medium | Task 11: Copy feedback | 15 min | ✅ Done |
| 🟡 Medium | Task 12: Field validation | 30 min | ✅ Done |
| 🟡 Medium | Task 13: Responsive patterns | 20 min | ✅ Done |
| 🟢 Low | Task 14: Skip link | 5 min | ✅ Done |
| 🟢 Low | Task 15: Keyboard shortcuts | 15 min | ✅ Done |
| 🟢 Low | Task 16: ARIA attributes | 15 min | ✅ Done |
| 🟢 Low | Task 17: Button elements | 10 min | ✅ Done |
| 🟢 Low | Task 19: Cleanup effect | 5 min | ✅ Done |
| 🟢 Low | Task 20: JSDoc comments | 30 min | ✅ Done |
| 🟢 Low | Task 21: Empty states | 10 min | ✅ Done |
| 🟢 Low | Task 22: Immer optimization | 30 min | ✅ Done |

**Total estimated time:** ~6-7 hours
**Completed time:** ~6 hours 40 minutes (Tasks 1-7, 9-17, 19-22) ✅
  - CRITICAL (Tasks 1-2): ~25 minutes
  - HIGH (Tasks 3-7): ~2 hours 50 minutes
  - MEDIUM (Tasks 9-13): ~2 hours 10 minutes
  - LOW (Tasks 14-17, 19-22): ~1 hour 15 minutes
**Remaining time:** ~1 hour 15 minutes (Task 8 + Task 18)

---

## How to Use This Task List

When asking AI to fix these issues, you can:

1. **Fix all critical issues:**
   ```
   Please implement all tasks marked as 🔴 CRITICAL in UI_UX_FIXES_TASKLIST.md
   ```

2. **Fix specific tasks:**
   ```
   Please implement Task 4 (Add autocomplete attributes) from UI_UX_FIXES_TASKLIST.md
   ```

3. **Fix by priority level:**
   ```
   Please implement all 🟠 HIGH priority tasks from UI_UX_FIXES_TASKLIST.md
   ```

4. **Fix quick wins first:**
   ```
   Please implement tasks 14, 17, and 21 from UI_UX_FIXES_TASKLIST.md (quick wins under 15 min each)
   ```

Each task includes:
- Clear problem description
- Exact file locations
- Complete implementation code
- WCAG references where applicable
- Estimated completion time
