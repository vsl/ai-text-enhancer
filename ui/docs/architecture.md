> **Historical reference:** This document may describe earlier providers, limits, or deployment steps. For the current public demo, use the [root README](../../README.md), current source configuration, and deployment workflow. Stripe payment functions are a disabled prototype, not live endpoints.

# Architecture

This document provides a high-level overview of the AI Text Enhancer project structure, state management patterns, and key architectural decisions.

## Project Overview

AI Text Enhancer is a Next.js 15 application that processes text through multiple AI assistants simultaneously. Users can create custom workflows with multiple AI assistants, each configured with different models, roles, and enhancement options.

**Core Concepts:**
- **Workflows**: Named collections of AI assistant configurations that can be saved and switched between
- **AI Assistants**: Individual configurations with a model, role, and enhancement options
- **Results**: Output from each enabled assistant after processing user text

## Project Structure

### Source Code Organization

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
├── context/                # React Context providers
├── hooks/                  # Custom React hooks
└── lib/                    # Utilities and configurations
```

### Detailed Package Structure

#### `src/app/` - Application Pages

Next.js App Router with file-based routing:

- **text-ai-assistants/** - Main application page with text enhancement UI
- **contact/** - Contact page
- **settings/** - User settings and account information
- **about/** - About page
- **auth/** - Authentication pages (OAuth callback, password reset)
- **layout.tsx** - Root layout with AuthProvider and ThemeProvider
- **page.tsx** - Home/landing page
- **globals.css** - Global styles and CSS variables

#### `src/components/` - React Components

**ui/** - shadcn/ui primitives (9 components):
- button.tsx, dialog.tsx, select.tsx, sheet.tsx, switch.tsx, textarea.tsx, tooltip.tsx

**features/** - Business logic components (15 components):
- **auth/** - Authentication components:
  - AuthModals.tsx - Container for all auth modals
  - LoginModal.tsx - Email/password login
  - SignUpModal.tsx - User registration
  - ForgotPasswordModal.tsx - Password reset request
  - SocialLoginButtons.tsx - Google/GitHub OAuth buttons
- ConfigEditorModal.tsx - Edit AI assistant configuration
- ConfigSummaryTags.tsx - Display active enhancement options
- ConfirmationModal.tsx - Generic confirmation dialog
- CreateWorkflowModal.tsx - Create new workflow
- CharacterCounter.tsx - Text length display with tier limits
- ResultTextarea.tsx - AI assistant output display
- InfoTooltip.tsx - Help tooltips
- LoadingSpinner.tsx - Loading indicator
- ToggleSwitch.tsx - Enable/disable toggle
- Header.tsx - App header with navigation
- Footer.tsx - App footer
- ThemeProvider.tsx - Dark/light mode provider
- index.ts - Component exports

#### `src/context/` - State Management

**WorkflowContext.tsx** - Main application state:
- Manages workflows, configs, results, and generation state
- Provides handlers for all workflow/config operations
- Automatically persists workflows to localStorage
- Enforces tier limits via AuthContext

**AuthContext.tsx** - Authentication state:
- Manages user session and profile
- Provides authentication functions (signIn, signOut, signInWithOAuth)
- Exposes tier limits based on user's subscription
- Provides token retrieval for API calls

#### `src/hooks/` - Custom Hooks

**useLocalStorage.ts** - localStorage persistence:
- SSR-safe localStorage hook
- Returns default value on first render
- Hydrates from localStorage after mount

#### `src/lib/` - Libraries and Utilities

**supabase.ts** - Supabase client configuration
**constants.ts** - All configuration constants:
- AVAILABLE_MODELS, AVAILABLE_AI_ROLES
- TONES, FORMALITY, LANGUAGE_LEVELS, LANGUAGES
- DEFAULT_OPTIONS, DEFAULT_WORKFLOWS
- TOOLTIP_TEXTS, TIER_LIMITS
- ERROR_MESSAGES, AUTH_ERROR_MESSAGES

**types.ts** - TypeScript type definitions:
- Options, AiConfig, Workflow, Result interfaces
- Authentication types (User, Profile)

**utils.ts** - Utility functions

### Test Organization

```
__tests__/
├── unit/           # Pure logic and utility functions
├── integration/    # Component interactions and modals
└── ...

e2e/                # Playwright E2E tests (full user journeys)
```

## State Management Pattern

### Centralized Context + localStorage

The application uses a **Context + localStorage pattern** for state management:

```
┌─────────────────────────────────────┐
│      WorkflowProvider               │
│  (Single Source of Truth)           │
│                                     │
│  - workflows: Workflow[]            │
│  - selectedWorkflow: string         │
│  - results: Map<number, Result>     │
│  - isGenerating: boolean            │
│                                     │
│  Handlers:                          │
│  - handleGenerate()                 │
│  - handleAddConfig()                │
│  - handleUpdateConfig()             │
│  - handleDeleteConfig()             │
│  - handleSwitchWorkflow()           │
│  - etc.                             │
└─────────────────────────────────────┘
           │
           ├─> useWorkflow() hook (components)
           │
           └─> useLocalStorage() (persistence)
```

**Key Principles:**
1. **WorkflowProvider** wraps the main page component
2. Components access state via **useWorkflow()** hook
3. **Never manipulate state directly** - always use provided handlers
4. **Auto-save** triggers on config changes via `autoSaveWorkflow()`
5. **localStorage** persists workflows between sessions

### Authentication Integration

**WorkflowProvider** accesses **AuthContext** via `useAuth()` hook to:
- Get authentication tokens for API calls
- Enforce tier limits (text length, batch size, available models)
- Display user-specific UI (character counters with limits)

## Component Hierarchy

### Root Layout

```
src/app/layout.tsx (root layout)
└── AuthProvider (src/context/AuthContext.tsx)
    └── ThemeProvider
        └── Header, children, Footer
```

### Main Application Page

```
src/app/text-ai-assistants/page.tsx
└── WorkflowProvider (src/context/WorkflowContext.tsx)
    └── TextAIAssistantsContent
        ├── Left Column: Input & Controls
        │   ├── Input textarea (with CharacterCounter)
        │   ├── Context textarea (with CharacterCounter)
        │   └── Enhance/Cancel button
        │
        └── Right Column: Workflows & Results
            ├── Workflow tabs (with delete buttons)
            ├── Assistant cards (one per config)
            │   ├── Toggle switch (enable/disable)
            │   ├── ConfigSummaryTags
            │   ├── ResultTextarea
            │   └── Kebab menu (edit/duplicate/remove)
            └── Add Assistant card
```

## Data Flow

### Text Enhancement Flow

```
User Input → WorkflowContext.handleGenerate()
    ↓
1. Filter enabled assistants
2. Get auth token from AuthContext
3. Create AbortController for cancellation
4. Set loading state
    ↓
5. POST /enhance with all assistants
    ↓
6. Update results map with success/error
    ↓
7. Display results in ResultTextarea components
```

### Workflow Persistence Flow

```
User modifies config → Handler from useWorkflow()
    ↓
WorkflowContext updates state
    ↓
autoSaveWorkflow() callback triggered
    ↓
Update workflow in workflows array
    ↓
useLocalStorage persists to localStorage
```

## Authentication System

### Architecture

**Supabase Authentication** with tier-based access control:

1. **Email/Password** - Traditional authentication
2. **OAuth2** - Google and GitHub providers
3. **Session Management** - JWT tokens with automatic refresh
4. **Protected API** - All endpoints validate JWT tokens

### Tier System

| Tier     | Text Limit | Context Limit | Batch Size | Models                          |
|----------|-----------|---------------|------------|---------------------------------|
| Free     | 500       | 800           | 3          | gemini-flash, open-router-free  |
| Plus     | 2000      | 3000          | 10         | + gemini-pro                    |
| Premium  | 5000      | 10000         | 10         | + gpt-4                         |

**Unauthenticated users**: Treated as 'free' tier

### Enforcement Levels

**Frontend (UX-level)**:
- Character counters show current/max with color coding
- Buttons disabled when limits exceeded
- Unavailable models shown as disabled

**Backend (Security-level)**:
- API validates JWT token
- Enforces tier limits server-side
- Returns error codes for quota violations

## Type System

Core types defined in `src/lib/types.ts`:

### Options Interface
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
```

### Core Domain Types
```typescript
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

## Configuration Constants

All constants in `src/lib/constants.ts`:

- **AVAILABLE_MODELS** - AI models (gemini-flash, open-router-free, local-debug-model)
- **AVAILABLE_AI_ROLES** - Role names with prompt descriptions
- **TONES** - Tone options with emojis
- **FORMALITY** - Formality levels with emojis
- **LANGUAGE_LEVELS** - Complexity options
- **LANGUAGES** - Translation targets
- **DEFAULT_OPTIONS** - Default enhancement settings
- **DEFAULT_WORKFLOWS** - Three pre-configured workflows
- **TOOLTIP_TEXTS** - All UI tooltips
- **TIER_LIMITS** - Feature limits per tier
- **ERROR_MESSAGES** - Generic API errors
- **AUTH_ERROR_MESSAGES** - Auth/quota errors

## Key Implementation Details

### Workflow Loading Logic

Located in `src/context/WorkflowContext.tsx:92-115`:

- Validates selection before loading configs
- Prevents race conditions during hydration
- Resets to first workflow if selected doesn't exist
- Deep copies configs to avoid mutations

### Auto-save Mechanism

- All config mutations trigger `autoSaveWorkflow()`
- Updates corresponding workflow in workflows array
- Persisted to localStorage via `useLocalStorage`

### Generation Flow

1. Filter to enabled assistants only
2. Get authentication token via `getAuthToken()` from AuthContext
3. Create AbortController for cancellation
4. Set loading state for all enabled assistants
5. Make API request with all assistants in parallel
6. Update results map with success/error for each
7. Handle AbortError separately from network errors
8. Display user-friendly error messages

## Import Path Convention

All imports use the `@/` alias mapping to `src/`:

```typescript
import { Button } from '@/components/ui/button'
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal'
import { useWorkflow } from '@/context/WorkflowContext'
```

Configured in:
- `tsconfig.json` (paths)
- `jest.config.js` (moduleNameMapper)

## Styling

- **Framework**: Tailwind CSS v4
- **Component Library**: shadcn/ui (New York style, Neutral theme)
- **Theme**: Dark/light mode via next-themes
- **CSS Variables**: Defined in `src/app/globals.css`

**Important**: Use Tailwind classes exclusively. Avoid custom CSS unless necessary.

## Build Configuration

**Static Export** configured in `next.config.ts`:
- `output: 'export'` - Generates static site in `out/` directory
- `images.unoptimized: true` - Required for static export
