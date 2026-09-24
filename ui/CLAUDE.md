# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📚 For detailed documentation, see [docs/index.md](./docs/index.md)**

This file contains quick reference information. For comprehensive guides on architecture, testing, API integration, and development, refer to the documentation in the `docs/` folder.

## Project Overview

AI Text Enhancer is a Next.js 15 application that processes text through multiple AI assistants simultaneously. Users can create custom workflows with multiple AI assistants, each configured with different models, roles, and enhancement options (improve, fix mistakes, format, translate, adjust tone/formality, etc.).

**Key Concepts:**
- **Workflows**: Named collections of AI assistant configurations that can be saved and switched between
- **AI Assistants**: Individual configurations with a model, role, and enhancement options
- **Results**: Output from each enabled assistant after processing user text

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with Turbopack at http://localhost:3000
npm run build        # Create optimized production build (static export to out/)
npm run start        # Start production server (not used for static export)
```

### Testing
```bash
# Unit/Integration Tests
npm run test              # Run all Jest tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report (opens coverage/lcov-report/index.html)

# Run specific test file
npm run test -- path/to/test.spec.ts
npm run test -- --testNamePattern="test name pattern"

# E2E Tests
npm run test:e2e          # Run Playwright tests (headless)
npm run test:e2e:ui       # Run tests in Playwright UI mode
npm run test:e2e:headed   # Run tests with browser visible

# Run specific E2E test file
npm run test:e2e -- path/to/test.spec.ts

# Install Playwright browsers (one-time setup)
npx playwright install --with-deps
```

### Test Organization
- Unit tests: `__tests__/unit/` - Pure logic and utility functions
- Integration tests: `__tests__/integration/` - Component interactions and modals
- E2E tests: `e2e/` - Full user journeys across the application

## Project Structure

```
├── src/                             # All source code
│   ├── app/                         # Next.js app router
│   │   ├── text-ai-assistants/      # Main application page
│   │   ├── contact/                 # Contact page
│   │   ├── settings/                # User settings and account info
│   │   ├── about/                   # About page
│   │   ├── auth/                    # Auth callback and reset password pages
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Home page
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── ui/                      # shadcn UI primitives
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── tooltip.tsx
│   │   └── features/                # Business logic components
│   │       ├── auth/                # Authentication components
│   │       │   ├── AuthModals.tsx
│   │       │   ├── LoginModal.tsx
│   │       │   ├── SignUpModal.tsx
│   │       │   ├── ForgotPasswordModal.tsx
│   │       │   └── SocialLoginButtons.tsx
│   │       ├── ConfigEditorModal.tsx
│   │       ├── ConfigSummaryTags.tsx
│   │       ├── ConfirmationModal.tsx
│   │       ├── CreateWorkflowModal.tsx
│   │       ├── CharacterCounter.tsx
│   │       ├── ResultTextarea.tsx
│   │       ├── InfoTooltip.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ToggleSwitch.tsx
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       ├── ThemeProvider.tsx
│   │       └── index.ts
│   ├── context/
│   │   ├── WorkflowContext.tsx      # Main state management
│   │   └── AuthContext.tsx          # Authentication context
│   ├── hooks/
│   │   └── useLocalStorage.ts       # localStorage hook
│   └── lib/
│       ├── supabase.ts              # Supabase client
│       ├── constants.ts             # Configuration constants (incl. tier limits)
│       ├── types.ts                 # TypeScript types (incl. auth types)
│       └── utils.ts                 # Utility functions
├── __tests__/                       # Test files
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── ...
├── e2e/                             # E2E tests
├── public/                          # Static assets
└── [config files at root]           # jest.config.js, tsconfig.json, etc.
```

**Import Path Convention**:
- All imports use the `@/` alias which maps to `src/`
- Configured in `tsconfig.json` (paths) and `jest.config.js` (moduleNameMapper)
- Example: `import { Button } from '@/components/ui/button'`
- Example: `import { ConfigEditorModal } from '@/components/features/ConfigEditorModal'`
- Example: `import { useWorkflow } from '@/context/WorkflowContext'`

## Architecture

### State Management Pattern

The application uses a **centralized Context + localStorage pattern** via `WorkflowContext`:

1. **WorkflowProvider** (`src/context/WorkflowContext.tsx`) is the single source of truth
   - Wraps the main page component
   - Manages workflows, configs, results, and generation state
   - Provides handlers for all workflow/config operations
   - Automatically persists workflows to localStorage

2. **useWorkflow hook** - Components access context via this hook
   - Never manipulate state directly in components
   - Always use the provided handlers from context

3. **localStorage Persistence** - Implemented via `useLocalStorage` hook
   - Workflows are saved automatically when configs change (via `autoSaveWorkflow`)
   - SSR-safe: Returns default value on first render, hydrates after mount

### Component Hierarchy

```
src/app/layout.tsx (root layout)
└── AuthProvider (src/context/AuthContext.tsx)
    └── ThemeProvider
        └── Header, children, Footer

src/app/text-ai-assistants/page.tsx (main app page)
└── WorkflowProvider (src/context/WorkflowContext.tsx)
    └── TextAIAssistantsContent
        ├── Left Column: Input & Controls
        │   ├── Input textarea (with CharacterCounter showing tier limits)
        │   ├── Context textarea (with CharacterCounter)
        │   └── Enhance/Cancel button (disabled when limits exceeded)
        └── Right Column: Workflows & Results
            ├── Workflow tabs (with delete buttons for custom workflows)
            ├── Assistant cards (one per config)
            │   ├── Toggle switch (enable/disable)
            │   ├── ConfigSummaryTags (shows active options)
            │   ├── ResultTextarea (shows output)
            │   └── Kebab menu (edit/duplicate/remove)
            └── Add Assistant card (disabled at tier batch limit)
```

**Important**: WorkflowProvider accesses AuthContext via `useAuth()` hook to get authentication tokens for API calls and enforce tier limits.

### API Integration

The app makes a single POST request to enhance text:

**Endpoint**: `https://mupadxckjgpekkqyhohg.supabase.co/functions/v1/enhance`

**Authentication**: All requests include `Authorization: Bearer <token>` header where token is either:
- A valid JWT access token from authenticated user's session (via Supabase Auth)
- `'plus-user-token-123'` string for unauthenticated users (treated as free tier)

**Request Format**:
```typescript
{
  assistants: [
    {
      id: string,           // config.id as string
      model: string,        // e.g., 'gemini-flash'
      aiRoleId: string,     // mapped from aiRole display name
      userText: string,
      contextText: string,
      options: Options      // enhancement options
    }
  ]
}
```

**AI Role Mapping** (in `src/context/WorkflowContext.tsx:271-276`):
- 'General Assistant' → 'editor'
- 'Summarizer Assistant' → 'summarizer'
- 'Professional Email Assistant' → 'email_assistant'

**Response Format**:
```typescript
{
  results: [
    {
      id: string,
      status: 'success' | 'error',
      enhancedText?: string,
      error?: { code: string }
    }
  ]
}
```

### Key Implementation Details

**Workflow Loading Logic** (`src/context/WorkflowContext.tsx:92-115`):
- Uses a robust effect that validates selection before loading configs
- Prevents race conditions during initial hydration
- Resets to first workflow if selected workflow doesn't exist
- Deep copies configs to avoid mutations

**Auto-save Mechanism**:
- All config mutations trigger `autoSaveWorkflow()` callback
- Updates the corresponding workflow in the workflows array
- Persisted to localStorage via `useLocalStorage`

**Generation Flow**:
1. Filters to enabled assistants only
2. Gets authentication token via `getAuthToken()` from AuthContext
3. Creates AbortController for cancellation
4. Sets loading state for all enabled assistants
5. Makes API request with all assistants in parallel (includes auth token in headers)
6. Updates results map with success/error for each assistant
7. Handles AbortError separately from network errors
8. Displays user-friendly error messages for auth/quota errors (from `AUTH_ERROR_MESSAGES`)

## Configuration Constants

All configuration constants live in `src/lib/constants.ts`:

- **AVAILABLE_MODELS**: Available AI models (gemini-flash, open-router-free, local-debug-model)
- **AVAILABLE_AI_ROLES**: Role names mapped to their prompt descriptions
- **TONES**: Available tone options with corresponding emojis in TONE_EMOJIS
- **FORMALITY**: Casual, Neutral, Formal with FORMALITY_EMOJIS
- **LANGUAGE_LEVELS**: Language complexity options
- **LANGUAGES**: Translation target languages
- **DEFAULT_OPTIONS**: Default enhancement options (improve: true, fixMistakes: true, others false)
- **DEFAULT_WORKFLOWS**: Two pre-configured workflows (Quick Fix, Formal Email)
- **TOOLTIP_TEXTS**: All tooltip text for InfoTooltip components
- **TIER_LIMITS**: Tier-based feature limits (maxTextLength, maxContextLength, maxBatchSize, availableModels)
- **ERROR_MESSAGES**: Generic API error messages mapped to error codes
- **AUTH_ERROR_MESSAGES**: Authentication and quota-specific error messages

## Type System

Core types in `src/lib/types.ts`:

```typescript
interface Options {
  improve: boolean;
  fixMistakes: boolean;
  format: boolean;
  shorten: boolean;
  lengthen: boolean;
  addEmojis: boolean;
  formality: string;       // Casual, Neutral, Formal
  tone: string;            // Confident, Empathetic, etc.
  languageLevel: string;   // '', simple, intermediate, advanced, fluent, native
  translateTo: string;     // language code or ''
}

interface AiConfig {
  id: number;
  model: string;
  aiRole: string;
  options: Options;
  enabled: boolean;
}

interface Workflow {
  name: string;
  configs: AiConfig[];
}

interface Result {
  configId: number;
  text: string;
  error?: boolean;
  isLoading: boolean;
}
```

## Styling

- **Framework**: Tailwind CSS v4
- **Component Library**: shadcn/ui (New York style, Neutral theme)
- **Theme**: Supports dark/light mode via next-themes
- **Custom CSS Variables**: Defined in `src/app/globals.css` for colors

**Important**: Use Tailwind classes exclusively. Do not write custom CSS unless absolutely necessary.

## Build Configuration

**Static Export** (`next.config.ts`):
- `output: 'export'` generates static site in `out/` directory
- `images.unoptimized: true` required for static export

## Deployment

**Cloudflare Pages**:
- Monorepo root directory: `ui`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `out`
- Build watch include path: `ui/*`
- Build watch exclude path: `ui/*.md`
- Production builds use production Supabase; preview builds use staging
  Supabase.

**GitHub Actions**:
- `../.github/workflows/ui.yml` runs tests and a production build only for
  non-documentation changes under `ui/`.
- Cloudflare Pages, not GitHub Actions, publishes the static export.

## Testing Best Practices

1. **Unit Tests**: Test pure functions, hooks, and utility logic in isolation
2. **Integration Tests**: Test component interactions, modals, and context integration
3. **E2E Tests**: Test complete user flows (workflow management, text enhancement, theme toggle)
4. **Coverage Target**: Maintain >90% coverage for core logic
5. **Test Data Attributes**: Use `data-testid` attributes for stable selectors

## Authentication

The application uses Supabase Authentication with tier-based access control.

**Supported Authentication Methods**:
- Email/password authentication (sign up, sign in, password reset)
- OAuth2 providers: Google and GitHub
- Session management with JWT tokens
- Protected API endpoints with token validation

### Using Authentication

**Access auth state in any component**:
```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, profile, tierLimits, signIn, signOut, signInWithOAuth } = useAuth();

  // user: Current authenticated user or null
  // profile: User profile from database (tier, tokens, etc.)
  // tierLimits: Current tier limits (maxTextLength, maxBatchSize, etc.)
  // signIn, signOut, signInWithOAuth: Auth functions
  // getAuthToken: Returns JWT token or 'anonymous' for API calls
}
```

### Tier Limits Enforcement

**Frontend enforcement** (UX-level):
- Character counters under textareas show current/max characters
- "Enhance Text" button disabled when limits exceeded
- "Add Assistant" button disabled at batch limit
- Model dropdown shows unavailable models as disabled

**Backend enforcement** (security-level):
- API validates JWT token and enforces tier limits
- Returns error codes for quota/limit violations

### Tier System

| Tier | Text Limit | Context Limit | Batch Size | Models |
|------|-----------|---------------|------------|---------|
| Free | 500 chars | 800 chars | 6 assistants | gemini-flash, open-router-free |
| Plus | 2000 chars | 3000 chars | 10 assistants | + gemini-pro |
| Premium | 5000 chars | 10000 chars | 10 assistants | + gpt-4 |

**Unauthenticated users**: Treated as 'free' tier with all limitations.

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

### Key Components

- **AuthContext** (`src/context/AuthContext.tsx`): Manages auth state, user profile, tier limits, token retrieval
- **AuthModals** (`src/components/features/auth/`): Login, signup, password reset, OAuth login modals
- **Auth Callback Page** (`src/app/auth/callback/page.tsx`): Handles OAuth redirect after Google/GitHub login
- **Password Reset Page** (`src/app/auth/reset-password/page.tsx`): Handles password reset flow
- **Settings Page** (`src/app/settings/page.tsx`): View account info, quota, tier limits
- **CharacterCounter** (`src/components/features/CharacterCounter.tsx`): Shows text length with color coding and tier limits

## Common Patterns

**Adding a New Enhancement Option**:
1. Add property to `Options` interface in `src/lib/types.ts`
2. Add to `DEFAULT_OPTIONS` in `src/lib/constants.ts`
3. Add to `OPTIONS_CHECKBOXES` if it's a checkbox
4. Update `src/components/features/ConfigEditorModal.tsx` to include the new option
5. Update `src/components/features/ConfigSummaryTags.tsx` to display the option when active

**Adding a New AI Role**:
1. Add to `AVAILABLE_AI_ROLES` in `src/lib/constants.ts` with prompt
2. Add mapping in `handleGenerate` in `src/context/WorkflowContext.tsx:271-276`

**Modifying State**:
- Always use handlers from `useWorkflow()` hook
- Never directly mutate configs or workflows
- Auto-save will trigger on config changes via provided handlers
