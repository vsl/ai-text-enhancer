# Development Guide

Practical guide for daily development, including setup, commands, patterns, and conventions for the AI Text Enhancer project.

## Prerequisites

- **Node.js** 18+ (recommended: use LTS version)
- **npm** or **yarn**
- **Git**

## Getting Started

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ai-test-enh-v2
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Commands

### Running the Application

```bash
# Start development server with Turbopack
npm run dev
# Server runs at: http://localhost:3000

# Create optimized production build
npm run build
# Output: static site in out/ directory

# Start production server (not used for static export)
npm run start
```

### Testing Commands

See [Testing Guide](./testing.md) for comprehensive testing documentation.

```bash
# Unit/Integration tests
npm run test                # Run all Jest tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report

# E2E tests
npm run test:e2e            # Run Playwright tests (headless)
npm run test:e2e:ui         # Run tests in Playwright UI mode
npm run test:e2e:headed     # Run tests with browser visible
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code (if configured)
npm run format
```

## Project Structure Quick Reference

```
src/
├── app/                    # Next.js App Router pages
│   ├── text-ai-assistants/ # Main application
│   ├── settings/           # User settings
│   ├── auth/               # Auth pages
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   └── features/           # Business logic components
├── context/                # React Context providers
│   ├── WorkflowContext.tsx # Main state management
│   └── AuthContext.tsx     # Authentication
├── hooks/                  # Custom React hooks
└── lib/                    # Utilities and configs
    ├── constants.ts        # All configuration constants
    ├── types.ts            # TypeScript types
    ├── utils.ts            # Utility functions
    └── supabase.ts         # Supabase client
```

## Import Path Convention

**All imports use the `@/` alias** which maps to `src/`:

```typescript
// Components
import { Button } from '@/components/ui/button'
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal'

// Context
import { useWorkflow } from '@/context/WorkflowContext'
import { useAuth } from '@/context/AuthContext'

// Utilities
import { cn } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/lib/constants'
import type { AiConfig, Workflow } from '@/lib/types'
```

**Configuration:**
- Defined in `tsconfig.json` (paths)
- Mapped in `jest.config.js` (moduleNameMapper)

**Why use `@/` alias:**
- Cleaner imports (no `../../..`)
- Easier refactoring
- Consistent across codebase

## Styling Guidelines

### Framework: Tailwind CSS v4

**Use Tailwind classes exclusively.** Avoid custom CSS unless absolutely necessary.

**Component Library:** shadcn/ui (New York style, Neutral theme)

**Theme Support:** Dark/light mode via next-themes

### Tailwind Best Practices

**Good:**
```tsx
<div className="flex items-center gap-2 p-4 rounded-lg bg-background">
  <Button variant="default" size="sm">
    Click me
  </Button>
</div>
```

**Avoid:**
```tsx
<div style={{ display: 'flex', padding: '16px' }}>
  <button className="custom-button">Click me</button>
</div>
```

### Using cn() Utility

Combine class names with conditional logic:

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class"
)}>
  Content
</div>
```

### CSS Variables

Defined in `src/app/globals.css`:

```css
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --secondary: ...;
  /* etc. */
}
```

**Usage:**
```tsx
<div className="bg-background text-foreground">
  Themed content
</div>
```

## Common Development Patterns

### Adding a New Enhancement Option

**Steps:**

1. **Add to `Options` interface** (`src/lib/types.ts`):
   ```typescript
   interface Options {
     // ... existing options
     myNewOption: boolean;  // Add this
   }
   ```

2. **Add to `DEFAULT_OPTIONS`** (`src/lib/constants.ts`):
   ```typescript
   export const DEFAULT_OPTIONS: Options = {
     // ... existing
     myNewOption: false,  // Add this
   };
   ```

3. **Add to UI** (`src/components/features/ConfigEditorModal.tsx`):
   ```tsx
   <div className="flex items-center gap-2">
     <Switch
       checked={editedConfig.options.myNewOption}
       onCheckedChange={(checked) =>
         handleOptionChange('myNewOption', checked)
       }
     />
     <label>My New Option</label>
   </div>
   ```

4. **Add to summary tags** (`src/components/features/ConfigSummaryTags.tsx`):
   ```tsx
   {config.options.myNewOption && (
     <span className="tag">My Option</span>
   )}
   ```

### Adding a New AI Role

**Steps:**

1. **Add to `AVAILABLE_AI_ROLES`** (`src/lib/constants.ts`):
   ```typescript
   export const AVAILABLE_AI_ROLES = {
     // ... existing roles
     'My Custom Role': 'System prompt for this role...',
   };
   ```

2. **Add role mapping** (`src/context/WorkflowContext.tsx:271-276`):
   ```typescript
   const roleMap: Record<string, string> = {
     'General Assistant': 'editor',
     'Summarizer Assistant': 'summarizer',
     'Professional Email Assistant': 'email_assistant',
     'Social Media Assistant': 'social_media_assistant',
     'My Custom Role': 'my_custom_role',  // Add this
   };
   ```

### Modifying Application State

**❌ Never do this:**
```typescript
// DON'T manipulate state directly
configs[0].enabled = true;  // BAD
setConfigs(configs);        // BAD
```

**✅ Always do this:**
```typescript
// Use handlers from useWorkflow() hook
const { handleUpdateConfig } = useWorkflow();

handleUpdateConfig(configId, { enabled: true });
```

**Why:**
- Auto-save mechanism triggers
- State updates are tracked
- Prevents mutations
- Maintains consistency

### Creating a New Component

**1. Create component file:**
```tsx
// src/components/features/MyComponent.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAction}>Action</Button>
    </div>
  );
}
```

**2. Export from index:**
```typescript
// src/components/features/index.ts
export { MyComponent } from './MyComponent';
```

**3. Use in pages:**
```tsx
import { MyComponent } from '@/components/features';

<MyComponent title="Hello" onAction={() => console.log('clicked')} />
```

### Adding a New Page

**1. Create page directory and file:**
```tsx
// src/app/my-page/page.tsx
export default function MyPage() {
  return (
    <div className="container mx-auto p-4">
      <h1>My Page</h1>
    </div>
  );
}
```

**2. Add to navigation:**
```tsx
// src/components/features/Header.tsx
<Link href="/my-page">My Page</Link>
```

**3. Add metadata:**
```tsx
// src/app/my-page/page.tsx
export const metadata = {
  title: 'My Page - AI Text Enhancer',
  description: 'Page description',
};
```

## Working with Context

### Accessing Workflow State

```typescript
import { useWorkflow } from '@/context/WorkflowContext';

function MyComponent() {
  const {
    workflows,
    selectedWorkflow,
    configs,
    results,
    isGenerating,
    handleGenerate,
    handleAddConfig,
    handleUpdateConfig,
    // ... other handlers
  } = useWorkflow();

  // Use state and handlers
}
```

### Accessing Auth State

```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const {
    user,
    profile,
    tierLimits,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
    getAuthToken,
  } = useAuth();

  // Use auth state and functions
}
```

## Environment Variables

### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-anon-key

# API Base URL
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

### Accessing Environment Variables

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_APP_SUPABASE_URL;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Build Configuration

### Static Export

Configured in `next.config.ts`:

```typescript
const nextConfig = {
  output: 'export',              // Generate static site
  images: {
    unoptimized: true,           // Required for static export
  },
};
```

**Output:** Static site in `out/` directory

**Deploy:** Upload `out/` directory to any static hosting service

### Turbopack

Development server uses Turbopack for faster builds:

```bash
npm run dev
# Uses Turbopack by default in Next.js 15
```

## Code Organization Best Practices

### Component Structure

**Single Responsibility:**
```tsx
// Good: Focused component
export function ConfigSummaryTags({ config }: Props) {
  return <div>{/* Display tags only */}</div>;
}

// Avoid: Component doing too much
export function ConfigCard({ config }: Props) {
  // Handles display, editing, deletion, API calls, etc.
}
```

### File Naming Conventions

- **Components:** PascalCase - `ConfigEditorModal.tsx`
- **Utilities:** camelCase - `utils.ts`, `constants.ts`
- **Hooks:** camelCase with 'use' prefix - `useLocalStorage.ts`
- **Types:** PascalCase - `types.ts` (contains `AiConfig`, `Workflow`, etc.)

### Type Safety

**Always define types:**
```typescript
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  // ...
}

// Avoid
export function Button(props: any) {
  // ...
}
```

**Use TypeScript features:**
```typescript
// Union types
type Tier = 'free' | 'plus' | 'premium';

// Type guards
function isTierValid(tier: string): tier is Tier {
  return ['free', 'plus', 'premium'].includes(tier);
}
```

## Debugging

### Development Tools

**React DevTools:**
- Install browser extension
- Inspect component tree
- View props and state

**Next.js DevTools:**
- Built-in error overlay
- Fast refresh for instant updates

**Browser DevTools:**
- Console for logs
- Network tab for API requests
- Application tab for localStorage

### Common Issues

**Issue: Components not updating**
- Check if state mutation is happening
- Ensure using handlers from context
- Verify dependencies in useEffect

**Issue: Import errors**
- Check `@/` alias is configured
- Verify file paths are correct
- Restart dev server if needed

**Issue: Styling not applied**
- Check Tailwind class names are correct
- Verify globals.css is imported in layout
- Check theme provider is wrapping app

## Git Workflow

### Branch Naming

```bash
feature/add-new-enhancement
fix/auth-token-refresh
refactor/workflow-context
docs/update-readme
```

### Commit Messages

**Format:** `type: description`

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation changes
- `test:` Adding or updating tests
- `style:` Formatting changes
- `chore:` Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add emoji support to enhancement options"
git commit -m "fix: handle token expiration in auth context"
git commit -m "docs: update API integration guide"
```

## Performance Tips

### Optimize Re-renders

**Use React.memo for expensive components:**
```typescript
export const ConfigSummaryTags = React.memo(({ config }: Props) => {
  // Component logic
});
```

**Use useCallback for stable callbacks:**
```typescript
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency]);
```

**Use useMemo for expensive calculations:**
```typescript
const filteredConfigs = useMemo(() => {
  return configs.filter(c => c.enabled);
}, [configs]);
```

### Lazy Loading

**Dynamic imports for large components:**
```typescript
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <LoadingSpinner />,
});
```

## Troubleshooting

### Build Errors

**Clear Next.js cache:**
```bash
rm -rf .next
npm run build
```

**Clear node_modules:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Runtime Errors

**Check browser console** for error messages
**Check terminal** for server-side errors
**Verify environment variables** are set correctly

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Quick Reference

### Keyboard Shortcuts

- `Ctrl/Cmd + C` - Stop dev server
- `Ctrl/Cmd + Shift + R` - Hard refresh browser
- `F12` - Open browser DevTools

### Useful Commands

```bash
# Check Node version
node --version

# Check npm version
npm --version

# List all npm scripts
npm run

# Clear cache and reinstall
npm ci

# Update dependencies
npm update
```
