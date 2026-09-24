> **Historical reference:** This document may describe earlier providers, limits, or deployment steps. For the current public demo, use the [root README](../../README.md), current source configuration, and deployment workflow. Stripe payment functions are a disabled prototype, not live endpoints.

# Project Structure

Complete guide to the codebase organization, explaining every folder and key files with their responsibilities.

**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Visual Project Tree](#visual-project-tree)
3. [Root Directory](#root-directory)
4. [Source Code (`src/`)](#source-code-src)
5. [Supabase Functions (`supabase/functions/`)](#supabase-functions-supabasefunctions)
6. [Tests (`tests/`)](#tests-tests)
7. [Database (`supabase/migrations/`)](#database-supabasemigrations)
8. [Configuration Files](#configuration-files)

---

## Overview

The project follows a **two-layer architecture** designed for platform portability:

- **Layer 1 (Handler)**: Platform-specific request/response handling in `supabase/functions/` (<100 lines each)
- **Layer 2 (Core Logic)**: Platform-agnostic business logic in `src/` (100% of functionality)

**Key Principle:** All business logic lives in `src/` and never uses platform-specific APIs (no `Deno.*`, no `process`, only standard JavaScript/TypeScript and `fetch`).

---

## Visual Project Tree

```
backend/
├── coverage/                   # Test coverage reports (generated)
├── docs/                       # Complete project documentation
│   ├── index.md               # Documentation hub (start here)
│   ├── project-structure.md   # This file
│   ├── getting-started.md     # Setup guide
│   ├── configuration.md       # Environment and config
│   ├── testing.md             # Testing guide
│   ├── deployment.md          # Deployment guide
│   ├── api-reference.md       # API specification
│   ├── architecture.md        # System design
│   ├── developer-guides.md    # How-to guides
│   ├── known-issues.md        # Technical debt
│   └── migration/             # Platform migration guides
├── node_modules/              # npm dependencies
├── src/                       # Core business logic (platform-agnostic)
│   ├── config/                # Configuration modules
│   ├── connectors/            # LLM provider integrations
│   ├── errors/                # Custom error classes
│   ├── repositories/          # Database operations
│   ├── services/              # Business logic services
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── supabase/                  # Supabase project files
│   ├── functions/             # Edge Functions (handlers)
│   │   ├── admin/             # Admin API handler
│   │   ├── enhance/           # Main enhancement handler
│   │   └── me/                # User profile API handler
│   ├── migrations/            # Database schema migrations
│   └── config.toml            # Supabase configuration
├── tests/                     # Jest test suite
│   ├── e2e/                   # End-to-end tests
│   ├── fixtures/              # Test data fixtures
│   ├── integration/           # Integration tests
│   ├── mocks/                 # Test mocks
│   └── unit/                  # Unit tests (mirrors src/)
├── .env.local                 # Local environment variables (not in git)
├── .env.local.example         # Environment template
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # AI assistant instructions
├── README.md                  # Project overview
├── deno.json                  # Deno configuration
├── jest.config.js             # Jest test configuration
├── package.json               # npm dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

---

## Root Directory

### Documentation Files

- **CLAUDE.md** - AI assistant instructions for Claude Code, architecture overview, development commands
- **README.md** - Project overview, quick start, key features, architecture diagram
- **.env.local.example** - Template for environment variables with comments

### Configuration Files

- **package.json** - npm dependencies, scripts (test, dev, deploy, type-check, lint)
- **tsconfig.json** - TypeScript compiler options (strict mode, ES2022 target)
- **deno.json** - Deno configuration for Supabase Edge Functions
- **jest.config.js** - Jest test framework configuration
- **.gitignore** - Files excluded from version control

---

## Source Code (`src/`)

All platform-agnostic business logic lives here. **NEVER use Deno.* APIs in this directory.**

### `src/config/` - Configuration Modules

Configuration is defined in **TypeScript modules** (not JSON) for type safety and validation.

**Files:**

- **index.ts** (12 lines) - Re-exports all configuration for single import point
  ```typescript
  export * from './loader.js'
  export * from './models.config.js'
  // etc.
  ```

- **loader.ts** (178 lines) - Loads and validates environment variables
  - `getEnvVar()` - Helper to read env vars with validation
  - `loadConfig()` - Main function that loads all configuration
  - Exports `AppConfig` object with system, models, roles, quota, tier limits, Supabase config
  - Throws errors on missing required variables

- **models.config.ts** (86 lines) - Defines available LLM models
  - `MODELS` array with 3 models (gemini-flash, open-router-free, lm-studio-local)
  - Each model has: id, provider, providerModelId, allowedTiers, displayName, contextWindow, cost
  - Used for: routing to correct connector, tier validation, displaying model info

- **roles.config.ts** (246 lines) - Defines AI assistant roles
  - `ROLES` array with 12 roles (editor, translator, writer, etc.)
  - Each role has: id, name, systemPrompt, allowedModels
  - System prompts define persona and instructions for LLM
  - Used for: building prompts, restricting model access per role

- **quota.config.ts** (16 lines) - Token quota limits per tier
  - `QUOTA_LIMITS` object: free (100k), plus (1M), premium (10M)
  - Used for: pre-flight quota checks, displaying limits to users

- **tier-limits.config.ts** (52 lines) - Input validation limits per tier
  - For each tier: maxUserTextLength, maxContextTextLength, maxBatchSize
  - Free: 500/800 chars, 5 batch
  - Plus: 2000/3000 chars, 10 batch
  - Premium: 10000/15000 chars, 10 batch
  - Used for: validating request sizes before processing

- **supabase.config.ts** (18 lines) - Supabase client initialization
  - Creates `@supabase/supabase-js` client
  - Uses service role key for admin access
  - Platform-agnostic (works in Deno, Node, Cloudflare Workers)

- **validator.ts** (41 lines) - Configuration validation
  - `validateConfig()` - Ensures models reference valid providers, roles reference valid models
  - Called at startup, throws errors on invalid config

### `src/connectors/` - LLM Provider Integrations

Connects to external LLM APIs. All connectors implement the same `LLMConnector` interface.

**`src/connectors/llm-connectors/`:**

- **index.ts** (3 lines) - Re-exports factory for easy imports

- **factory.ts** (55 lines) - `LLMConnectorFactory` class
  - `createAll()` - Creates instances of all connectors at startup
  - `get(provider)` - Returns connector for given provider name
  - Maps provider names to connector instances

- **gemini-connector.ts** (95 lines) - Google Gemini API integration
  - Uses `@google/generative-ai` SDK
  - Implements: model selection, prompt construction, API call, response parsing
  - **Known limitation:** Token counting returns 0 (Gemini API limitation)
  - Enforces 30-second timeout using `AbortController`

- **openrouter-connector.ts** (117 lines) - OpenRouter API integration
  - Uses REST API (fetch)
  - Supports multiple models via OpenRouter proxy
  - Returns actual token counts from API response
  - Enforces 30-second timeout

- **lmstudio-connector.ts** (102 lines) - LM Studio local API integration
  - For local development and testing
  - Uses OpenAI-compatible REST API
  - Connects to local LM Studio instance (default: http://localhost:1234)
  - Returns actual token counts

**Common Interface:**
```typescript
interface LLMConnector {
  enhance(params: LLMEnhanceParams): Promise<LLMEnhanceResult>
}
```

### `src/errors/` - Custom Error Classes

All errors extend base `AppError` class with `code` and `message` properties.

**Files:**

- **auth-errors.ts** (32 lines) - Authentication and authorization errors
  - `InvalidTokenError` - JWT validation failed
  - `UserNotFoundError` - User doesn't exist in database
  - `UserBlockedError` - User account is blocked (is_active=false)
  - `AdminAccessRequiredError` - Non-admin trying to access admin endpoint

- **quota-errors.ts** (24 lines) - Token quota errors
  - `InsufficientQuotaError` - User doesn't have enough tokens
  - `QuotaServiceError` - Generic quota service error

- **llm-errors.ts** (29 lines) - LLM provider errors
  - `LLMTimeoutError` - Request exceeded 30-second timeout
  - `LLMAPIError` - External API returned error
  - `LLMResponseError` - Response parsing failed

- **orchestration-errors.ts** (43 lines) - Batch processing errors
  - `InvalidModelError` - Requested model doesn't exist
  - `InvalidRoleError` - Requested role doesn't exist
  - `ModelAccessDeniedError` - User tier can't access model
  - `TierLimitExceededError` - Input exceeds tier limits
  - `InvalidBatchSizeError` - Batch has <1 or >10 assistants
  - `DuplicateAssistantIDError` - Duplicate IDs in batch

### `src/repositories/` - Database Operations

Isolate all SQL queries and database interactions. Uses `@supabase/supabase-js` client.

**Files:**

- **user.repository.ts** (172 lines) - User profile database operations
  - `getUserById(userId)` - Fetch user profile + quota (single JOIN query)
  - `getUserByEmail(email)` - Lookup by email
  - `updateUserTier(userId, tier)` - Change tier (free/plus/premium)
  - `updateUserStatus(userId, isActive)` - Block/unblock user
  - `listUsers(page, pageSize)` - Paginated user list for admin
  - All queries use Supabase client with proper error handling

- **quota.repository.ts** (173 lines) - Token quota database operations
  - `getQuota(userId)` - Get current token balance
  - `checkBalance(userId, tokensRequired)` - Check if sufficient tokens (calls `check_user_quota()` function)
  - `deductTokens(userId, tokensUsed)` - Atomic subtraction (calls `deduct_tokens()` function)
  - `addTokens(userId, tokens, purchaseType, ...)` - Add tokens and record transaction (calls `add_tokens()` function)
  - `getPurchaseHistory(userId, limit)` - Get token purchase history
  - Uses PostgreSQL functions with row-level locking for atomic operations

### `src/services/` - Business Logic Services

Core application logic. All services are platform-agnostic.

**Files:**

- **index.ts** (2 lines) - Re-exports all services

- **batch-orchestrator.ts** (254 lines) - **Main coordinator** for batch processing
  - `processBatch(request, userProfile)` - Main entry point
  - Validates batch structure (1-10 tasks, unique IDs)
  - Validates tier limits (message sizes, batch size)
  - Estimates tokens for pre-flight quota check
  - Processes all assistants with `Promise.allSettled` (partial success pattern)
  - Aggregates results (individual task failures don't block others)
  - Reports actual token usage post-flight
  - Returns `BatchResponse` with per-task status

- **auth-middleware.ts** (79 lines) - Request authentication
  - `authenticate(headers)` - Extracts and validates Bearer token
  - Calls `AuthService.validateToken()` to validate JWT
  - Calls `UserRepository.getUserById()` to fetch profile + quota
  - Returns `UserProfile` with tier, quota, admin status
  - Throws `InvalidTokenError`, `UserBlockedError`, `UserNotFoundError`

- **auth-service.ts** (88 lines) - JWT validation and user lookup
  - `validateToken(token)` - **Local JWT verification** using `jose` library (no HTTP calls)
  - Extracts userId from JWT payload (sub claim)
  - Fetches user profile + quota from database
  - Checks active status before returning user
  - Efficient for Edge Functions (no external API calls)

- **authorization-service.ts** (55 lines) - Tier-based access control
  - `checkModelAccess(userTier, modelId)` - Validates user's tier can access requested model
  - Uses `allowedTiers` array from model config
  - Throws `ModelAccessDeniedError` if unauthorized

- **prompt-builder.ts** (57 lines) - Prompt construction orchestrator
  - `buildSystemPrompt(roleId)` - Gets system prompt from role config
  - `buildUserPrompt(params)` - Calls `PromptTemplates.buildPrompt()`
  - Combines userText, contextText, and options into final prompt
  - Validates role and model exist

- **prompt-templates.ts** (221 lines) - User prompt generation
  - `buildPrompt(params)` - Converts enhancement options into natural language instructions
  - Handles: improve, fixMistakes, shorten, lengthen, formality, tone, languageLevel, translateTo, addEmojis
  - Enforces JSON-only response format
  - Returns structured prompt with clear instructions

- **quota-middleware.ts** (63 lines) - Pre-flight quota verification
  - `checkQuota(batch, userProfile, supabaseClient)` - Pre-flight check before processing
  - Estimates total token usage for batch (4 chars ≈ 1 token + 500 overhead per task)
  - Calls `QuotaRepository.checkBalance()` to verify quota
  - Throws `InsufficientQuotaError` if insufficient

- **quota-service.ts** (69 lines) - Token quota management
  - `reportUsage(userId, tokensUsed, supabaseClient)` - Post-flight token deduction
  - Calls `QuotaRepository.deductTokens()` for atomic database update
  - Fire-and-forget pattern (no retry on failure) - **known limitation**

- **admin.service.ts** (244 lines) - Admin operations
  - `adjustTokens(userId, tokens, description, supabaseClient)` - Add or subtract tokens
  - `changeTier(userId, tier, supabaseClient)` - Update user tier
  - `blockUser(userId, supabaseClient)` - Set is_active=false
  - `unblockUser(userId, supabaseClient)` - Set is_active=true
  - `getUserDetails(userId, supabaseClient)` - Get profile + quota + purchase history
  - `listUsers(page, pageSize, supabaseClient)` - Paginated user list
  - `bootstrapUsers(supabaseClient)` - Create 6 predefined test users (idempotent)
  - All operations use repositories for database access

- **model-tier-mapper.ts** (37 lines) - Maps user tiers to allowed models
  - `getModelsForTier(tier)` - Returns models accessible to tier
  - Used for: displaying available models in UI

### `src/types/` - TypeScript Type Definitions

Centralized type definitions for the entire application.

**Files:**

- **api.types.ts** (57 lines) - API request/response types
  - `EnhanceRequest`, `BatchResponse`, `TaskResult`
  - Request body and response structures

- **auth.types.ts** (34 lines) - Authentication types
  - `UserProfile`, `UserTier` ('free' | 'plus' | 'premium')
  - JWT payload structures

- **config.types.ts** (127 lines) - Configuration types
  - `AppConfig`, `SystemConfig`, `ModelConfig`, `RoleConfig`
  - All configuration structure types

- **llm.types.ts** (63 lines) - LLM connector types
  - `LLMConnector` interface, `LLMEnhanceParams`, `LLMEnhanceResult`
  - Provider-agnostic connector interface

- **orchestration.types.ts** (13 lines) - Orchestration types
  - `TaskProcessingResult`
  - Internal processing types

- **prompt.types.ts** (74 lines) - Prompt construction types
  - `TransformationOptions` - All enhancement options (improve, shorten, tone, etc.)
  - `PromptBuildParams`

- **quota.types.ts** (25 lines) - Quota management types
  - `UserQuota`, `PurchaseType` ('welcome_bonus' | 'purchase' | 'admin_adjustment')

- **npm-imports.d.ts** (7 lines) - Type declarations for npm packages
  - Declares `@supabase/supabase-js` and `@google/generative-ai` modules
  - Workaround for Deno's npm: prefix imports

### `src/utils/` - Utility Functions

**Files:**

- **token-limits.ts** (42 lines) - Token estimation utilities
  - `estimateTokens(text)` - Rough estimation (4 chars ≈ 1 token)
  - `SYSTEM_PROMPT_OVERHEAD` - Constant for system prompt token cost
  - Used for pre-flight quota estimation

---

## Supabase Functions (`supabase/functions/`)

Platform-specific handler layer. **All handlers must be <100 lines.**

### `supabase/functions/enhance/` - Main Enhancement API

**Files:**

- **index.ts** (36 lines) - Entry point for Deno
  - Sets up Deno.serve() with handler
  - Platform-specific code (uses Deno.*)
  - Routes all requests to handler.ts

- **handler.ts** (178 lines) - Request/response handling
  - `GET /` - Health check endpoint
  - `POST /` - Main enhancement endpoint
  - Extracts request, calls core logic, formats response
  - Error handling and HTTP status mapping
  - CORS headers

- **test.ts** (91 lines) - Local testing script
  - Simulates requests for local development

- **deno.json** (3 lines) - Deno config for this function
  - Import map and permissions

### `supabase/functions/admin/` - Admin API

**Files:**

- **index.ts** (36 lines) - Entry point for Deno
  - Sets up Deno.serve() with handler

- **handler.ts** (332 lines) - Admin endpoint routing
  - `POST /bootstrap` - Create test users (requires BOOTSTRAP_SECRET_KEY)
  - `GET /users` - List all users (requires admin JWT)
  - `GET /users/:userId` - Get user details
  - `POST /users/:userId/tokens` - Adjust token balance
  - `PUT /users/:userId/tier` - Change tier
  - `PUT /users/:userId/status` - Block/unblock user
  - All routes validate admin access

### `supabase/functions/me/` - User Profile API

**Files:**

- **index.ts** (36 lines) - Entry point for Deno
  - Sets up Deno.serve() with handler

- **handler.ts** (122 lines) - User profile endpoint
  - `GET /` - Get current user's profile and quota
  - `GET /health` - Health check
  - Extracts user from JWT automatically
  - No query params needed

---

## Tests (`tests/`)

Jest test suite that validates platform portability by running in Node.js.

### Directory Structure

- **tests/e2e/** - End-to-end tests (full API flow)
- **tests/fixtures/** - Test data fixtures (sample requests, responses)
- **tests/integration/** - Integration tests (multiple services together)
- **tests/mocks/** - Shared test mocks (Supabase client, LLM APIs)
- **tests/unit/** - Unit tests (mirrors src/ structure)
  - **tests/unit/config/** - Config module tests
  - **tests/unit/connectors/** - LLM connector tests
  - **tests/unit/errors/** - Error class tests
  - **tests/unit/repositories/** - Repository tests
  - **tests/unit/services/** - Service tests
  - **tests/unit/utils/** - Utility function tests

### Key Test Files

- **tests/unit/services/batch-orchestrator.test.ts** - Main orchestrator tests
- **tests/unit/services/auth-middleware.test.ts** - Authentication tests
- **tests/unit/services/quota-service.test.ts** - Quota management tests
- **tests/unit/repositories/user.repository.test.ts** - User database tests (20 tests)
- **tests/unit/repositories/quota.repository.test.ts** - Quota database tests (20 tests)
- **tests/unit/services/admin.service.test.ts** - Admin service tests (16 tests)
- **tests/integration/admin.test.ts** - Admin API integration tests

### Testing Commands

```bash
npm test                     # Run all tests
npm test -- --watch         # Watch mode
npm run test:coverage       # Coverage report
npm test -- path/to/file    # Single test file
```

---

## Database (`supabase/migrations/`)

PostgreSQL schema migrations for Supabase.

### Key Migration Files

- **20251025161359_auth_schema.sql** (482 lines) - Authentication and user management
  - Tables: `user_profiles`, `user_quotas`, `token_purchases`
  - Triggers: `handle_new_user()` - Auto-creates profile + quota on signup
  - Functions: `check_user_quota()`, `deduct_tokens()`, `add_tokens()` (atomic operations with row-level locking)
  - RLS policies for secure access
  - Grants 50,000 welcome bonus tokens to new users

### Seed Data

- **supabase/seed.sql** - Bootstrap test users for local development
  - Creates 6 predefined users with known passwords
  - admin@textenhancer.dev, free@textenhancer.dev, plus@textenhancer.dev, etc.

---

## Configuration Files

### Package Management

- **package.json** - npm dependencies and scripts
  - Dependencies: `@supabase/supabase-js`, `@google/generative-ai`, `ajv`, `jose`
  - DevDependencies: Jest, TypeScript, ESLint
  - Scripts: test, dev, deploy, type-check, lint:portability

### TypeScript

- **tsconfig.json** - TypeScript compiler options
  - Target: ES2022
  - Module: ES2022
  - Strict mode enabled
  - Paths mapping for clean imports

### Deno

- **deno.json** - Deno configuration for Supabase Edge Functions
  - Import map for npm: prefix
  - Permissions configuration

### Jest

- **jest.config.js** - Jest test framework configuration
  - Transform TypeScript with ts-jest
  - Coverage thresholds
  - Test environment: node

### CI/CD

- **../../.github/workflows/backend.yml** - GitHub Actions backend pipeline
  - Checks and deploys backend pull requests to staging
  - Checks and deploys backend changes on `main` to production
  - Steps: type-check → tests → portability validation → deploy → health check

---

## Import/Export Patterns

### Barrel Exports

Many directories use `index.ts` for barrel exports:

```typescript
// src/services/index.ts
export * from './batch-orchestrator.js'
export * from './auth-middleware.js'
// etc.
```

This allows clean imports:
```typescript
import { BatchOrchestrator, AuthMiddleware } from '../services/index.js'
```

### File Extension Convention

**ALWAYS use `.js` extension in imports** (even for TypeScript files):

```typescript
// Correct
import { foo } from './bar.js'

// Wrong
import { foo } from './bar'
import { foo } from './bar.ts'
```

This is required for Deno compatibility.

### npm Prefix for Deno

When importing npm packages in Deno:

```typescript
import Ajv from 'npm:ajv'
import { createClient } from 'npm:@supabase/supabase-js'
```

---

## Key Patterns

### Error Handling

All errors extend `AppError` with `code` and `message`:

```typescript
throw new InsufficientQuotaError('User has 0 tokens available')
```

### Partial Success Pattern

Batch processing uses `Promise.allSettled`:

```typescript
const results = await Promise.allSettled(tasks)
// Some tasks can fail, others succeed
return { results: processedResults }
```

### Timeout Pattern

All external API calls use `AbortController` with 30-second timeout:

```typescript
const controller = new AbortController()
setTimeout(() => controller.abort(), 30000)
await fetch(url, { signal: controller.signal })
```

### Repository Pattern

All database operations isolated in repositories:

```typescript
// Service layer
const user = await UserRepository.getUserById(userId, supabaseClient)

// Repository layer
export async function getUserById(userId: string, client: SupabaseClient) {
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  // ... error handling
}
```

---

## Next Steps

- **For new developers:** See [Getting Started](./getting-started.md) for setup instructions
- **For architecture understanding:** See [Architecture](./architecture.md) for system design
- **For implementation:** See [Developer Guides](./developer-guides.md) for how-to guides
- **For API integration:** See [API Reference](./api-reference.md) for complete API documentation

---

**Last Updated:** January 2025
**Maintained By:** Development Team
