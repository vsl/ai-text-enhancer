# CLAUDE.md

> **Complete Documentation:** For comprehensive project documentation, see **[docs/index.md](./docs/index.md)**. This file contains AI-specific instructions and quick reference for Claude Code.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A **serverless backend** for AI-powered text enhancement designed with platform portability as the core principle. This is not a simple LLM wrapper—it's an intelligent engine that abstracts prompt engineering complexity, manages user quotas, controls tier-based access, and processes batches of enhancement requests in parallel across multiple LLM providers.

**Core Value Proposition:** The entire business logic can migrate to AWS Lambda, Cloudflare Workers, or other platforms in 4-8 hours by rewriting only the thin handler layer (~36 lines).

## Architecture: Two-Layer Design

### Layer 1: Handler (Platform-Specific)
- **Location:** `supabase/functions/enhance/`
- **Size:** <100 lines (currently 36 lines)
- **Allowed APIs:** `Deno.*`, `Request`, `Response`
- **Purpose:** Extract request → Call core logic → Format response
- **Migration impact:** This layer gets rewritten for new platforms

### Layer 2: Core Logic (Platform-Agnostic)
- **Location:** `src/`
- **Technology:** Standard TypeScript/JavaScript
- **Forbidden APIs:** `Deno.*` or any platform-specific imports
- **Allowed APIs:** `fetch()`, `process.env`, npm packages
- **Purpose:** 100% of business logic
- **Migration impact:** Zero changes required

**Critical Rule:** If adding business logic, it MUST go in `src/`, never in the handler.

## Development Commands

### Testing
```bash
npm test                    # Run Jest unit tests (validates portability)
npm test -- --watch         # Watch mode for development
npm run test:coverage       # Generate coverage report
npm run type-check          # TypeScript type checking
npm run lint:portability    # Ensure no Deno.* in src/ (critical check)
```

### Local Development
```bash
supabase start              # Start local Supabase stack (keep running)
npm run dev                 # Serve function with hot reload at http://localhost:54321/functions/v1/enhance

# Test health endpoint
curl http://localhost:54321/functions/v1/enhance/health
```

### Deployment
```bash
npm run setup:env           # Set environment variables in Supabase
npm run deploy              # Deploy to Supabase
npm run health              # Check deployment health
npm run logs                # View function logs
npm run logs:tail           # Tail logs in real-time
```

### GitHub Actions CI/CD
The monorepo includes automated CI/CD via GitHub Actions (`../.github/workflows/backend.yml`):

**Pipeline Steps:**
1. TypeScript type checking
2. Jest unit tests
3. Platform portability validation
4. Sync secrets to Supabase
5. Deploy Edge Function
6. Health check verification

**Trigger:** Runs only for non-documentation changes under `backend/`. Pull
requests run checks and deploy to staging; changes merged to `main` run checks
and deploy to production.

**For Setup Instructions:** See the root
[setup guide](../docs/getting-started.md).

### Single Test Execution
```bash
npm test -- src/services/batch-orchestrator.test.ts
npm test -- tests/unit/services/prompt-builder.test.ts
```

## High-Level Architecture Flow

```
POST /enhance
    ↓
1. Handler (index.ts) extracts request
    ↓
2. AuthMiddleware validates Bearer token → User Service → Get UserProfile + tier
    ↓
3. QuotaMiddleware pre-flight check (estimate tokens, verify quota)
    ↓
4. BatchOrchestrator processes 1-10 assistants in parallel
    ↓
5. For each assistant:
   - AuthorizationService checks model access for user tier
   - PromptBuilder creates system + user prompts from options
   - LLMConnectorFactory routes to provider (Gemini/OpenRouter/LM Studio)
   - Provider returns enhanced text + token count
    ↓
6. QuotaService post-flight deduction (report actual tokens used)
    ↓
7. Return BatchResponse (HTTP 200 even if individual tasks fail)
```

## Key Services & Their Responsibilities

### Core Services (src/services/)

- **BatchOrchestrator** - Parallel processing coordinator
  - Validates batch structure (1-10 tasks, unique IDs)
  - Estimates tokens for pre-flight quota check
  - Processes all assistants with `Promise.allSettled`
  - Aggregates results (partial success pattern)
  - Reports actual token usage post-flight

- **AuthMiddleware** - Token extraction and user validation
  - Extracts Bearer token from Authorization header
  - Calls User Service to validate token
  - Returns `UserProfile` (userId, tier, email)

- **QuotaMiddleware** - Pre-flight quota verification
  - Estimates total token usage for batch
  - Checks user has sufficient quota
  - Throws `InsufficientQuotaError` if needed

- **QuotaService** - Token quota management
  - Validates user has sufficient quota
  - Reports usage to external User Service (fire-and-forget)
  - **Known limitation:** Usage reporting has no retry logic

- **AuthorizationService** - Tier-based model access control
  - Checks if user's tier can access requested model
  - Throws `ModelAccessDeniedError` if unauthorized
  - Uses `allowedTiers` array from model config

- **PromptBuilder** - Prompt construction orchestrator
  - Builds system prompt from role config
  - Builds user prompt from PromptTemplates
  - Combines userText, contextText, and options

- **PromptTemplates** - User prompt generation
  - Converts enhancement options into natural language instructions
  - Enforces JSON-only response format
  - Handles formality, tone, language level, translation, etc.

### LLM Connectors (src/connectors/llm-connectors/)

All connectors implement the same interface for provider abstraction:

- **GeminiConnector** - Google Gemini API (uses SDK)
  - **Known limitation:** Token counting hardcoded to 0 (API limitation)

- **OpenRouterConnector** - OpenRouter API (REST)

- **LMStudioConnector** - Local LM Studio (development only)

- **LLMConnectorFactory** - Provider routing
  - Maps provider name to connector instance
  - Creates all connectors at startup

## Configuration System

All configuration lives in **TypeScript modules** (not JSON) under `src/config/`:

### models.config.ts
```typescript
{
  id: 'gemini-flash',              // Internal ID used in API
  provider: 'gemini',              // Maps to connector
  providerModelId: 'gemini-2.5-flash', // Actual model name for API
  allowedTiers: ['free', 'plus', 'premium'], // Array of tiers with access
  displayName: 'Gemini 2.5 Flash',
  contextWindow: 1000000,
  costPer1kTokens: { input: 0.00, output: 0.00 }
}
```

**Key insight:** `allowedTiers` is an array—models can be accessible to multiple tiers.

### roles.config.ts
```typescript
{
  id: 'editor',                    // Role ID used in API
  name: 'Editor',
  systemPrompt: 'You are a professional text editor...', // LLM system prompt
  allowedModels: ['gemini-flash', 'open-router-free']    // Model restrictions
}
```

### quota.config.ts
```typescript
const QUOTA_LIMITS: Record<UserTier, number> = {
  free: 100_000,      // 100k tokens/day
  plus: 1_000_000,    // 1M tokens/day
  premium: 10_000_000 // 10M tokens/day
};
```

### loader.ts
- Loads environment variables using `getEnvVar()` helper
- Throws errors on missing required variables
- Exports complete `AppConfig` object

### validator.ts
- Validates complete config structure
- Ensures models reference valid providers
- Ensures roles reference valid models

## API Request/Response Structure

### Single Endpoint: POST /functions/v1/enhance

**Request:**
```typescript
{
  assistants: [{
    id: string,              // Client-side unique ID (required)
    model: string,           // Model ID from models.config.ts
    aiRoleId: string,        // Role ID from roles.config.ts
    userText: string,        // Max 500 chars
    contextText?: string,    // Max 800 chars (optional)
    options: {
      improve?: boolean,
      fixMistakes?: boolean,
      shorten?: boolean,     // Mutually exclusive with lengthen
      lengthen?: boolean,
      formality?: 'Casual' | 'Neutral' | 'Formal',
      tone?: string,
      languageLevel?: 'default' | 'simple' | 'intermediate' | 'advanced' | 'fluent' | 'native',
      translateTo?: string,  // ISO language code
      addEmojis?: boolean
    }
  }]  // 1-10 assistants maximum
}
```

**Response (HTTP 200 even with partial failures):**
```typescript
{
  results: [{
    id: string,              // Matches request assistant.id
    status: 'success' | 'error',
    enhancedText?: string,   // Present on success
    total_tokens?: number,   // Present on success
    error?: {                // Present on error
      code: string,
      message: string
    }
  }]
}
```

## Critical Patterns & Conventions

### Import Style
```typescript
import { foo } from './bar.js'  // ALWAYS use .js extension
import Ajv from 'npm:ajv'       // Use npm: prefix for Deno imports
```

### Portability Enforcement
Run `npm run lint:portability` before commits. It checks for `Deno.*` in `src/` directory.

**Allowed in src/:**
- Standard TypeScript/JavaScript
- `fetch()` for HTTP calls
- `process.env` for environment variables
- npm packages (with `npm:` prefix in Deno)

**Forbidden in src/:**
- `Deno.*` namespace
- Platform-specific APIs
- Direct `Request`/`Response` handling

### Error Handling Philosophy
- Custom error classes in `src/errors/` with `code` and `message`
- `Promise.allSettled` enables partial batch success
- `AbortController` enforces 30-second timeout per LLM call
- Individual task failures don't block other tasks
- HTTP 200 response with per-task status

### Testing Strategy
- Jest tests run in Node.js (validates portability claim)
- Unit tests in `tests/unit/` mirror `src/` structure
- Mock external services (User Service, LLM APIs)
- Use `beforeEach`/`afterAll` for env setup/teardown

## Authentication & Token Management

### Authentication Architecture

The system uses **Supabase Auth** for JWT-based authentication with database-backed user profiles:

- **JWT Validation** - Local JWT verification using `jose` library (no external HTTP calls)
- **User Profiles** - Database-backed user data with tier, admin status, active status
- **Token Quotas** - Per-user token balances tracked in `user_quotas` table
- **Auth Providers** - Support for email, Google, GitHub, Apple, Facebook, Twitter, Azure, **Anonymous**

### Authentication Flow

```
Request with Bearer token
    ↓
AuthMiddleware.authenticate(headers)
    ↓
AuthService.validateToken(token)
    ↓
1. Local JWT verification with jose library
2. Extract userId from JWT payload (sub claim)
3. UserRepository.getUserById(userId) → fetch profile + quota
4. Check user.isActive (throw UserBlockedError if false)
    ↓
Return UserProfile with quota information
```

### Core Authentication Services

#### AuthMiddleware ([src/services/auth-middleware.ts](src/services/auth-middleware.ts))
- Extracts Bearer token from Authorization header
- Validates JWT and fetches user profile
- Returns `UserProfile` with tier and quota info
- **Errors:** `InvalidTokenError`, `UserBlockedError`, `UserNotFoundError`

#### AuthService ([src/services/auth-service.ts](src/services/auth-service.ts))
- **Local JWT verification** using `jose` library (efficient for Edge Functions)
- No HTTP calls to Supabase Auth API
- Fetches user profile + quota from database
- Checks active status before returning user

#### UserRepository ([src/repositories/user.repository.ts](src/repositories/user.repository.ts))
Database operations for user management:
- `getUserById()` - Fetch user with quota (single JOIN query)
- `getUserByEmail()` - Lookup by email
- `updateUserTier()` - Change tier (free/plus/premium)
- `updateUserStatus()` - Block/unblock user (is_active flag)
- `listUsers()` - Paginated user list for admin

### Token Quota Management

#### QuotaRepository ([src/repositories/quota.repository.ts](src/repositories/quota.repository.ts))
Database operations for token balance:
- `getQuota()` - Get current token balance
- `checkBalance()` - Check if sufficient tokens (calls `check_user_quota()` function)
- `deductTokens()` - Atomically subtract tokens (calls `deduct_tokens()` function)
- `addTokens()` - Add tokens and record transaction (calls `add_tokens()` function)
- `getPurchaseHistory()` - Get token purchase history

#### Database Functions (Atomic Operations)
All quota operations use PostgreSQL functions with row-level locking:
- `check_user_quota(user_id, tokens_required)` - Returns boolean
- `deduct_tokens(user_id, tokens_used)` - Atomic deduction with `FOR UPDATE`
- `add_tokens(user_id, tokens_added, purchase_type, ...)` - Atomic addition + transaction record

#### Token Flow in Batch Processing
1. **Pre-flight Check** (QuotaMiddleware)
   - Estimate total tokens needed (4 chars ≈ 1 token + 500 overhead per task)
   - Call `checkBalance()` to verify quota
   - Throw `InsufficientQuotaError` if insufficient

2. **Process Batch** (BatchOrchestrator)
   - Execute all enhancement tasks
   - Collect actual token counts from LLM responses

3. **Post-flight Deduction** (QuotaService)
   - Sum actual tokens used from all successful tasks
   - Call `deductTokens()` for atomic database update
   - Fire-and-forget pattern (no retry on failure)

### Admin System

#### AdminService ([src/services/admin.service.ts](src/services/admin.service.ts))
Platform-agnostic admin operations:
- `adjustTokens()` - Add or subtract tokens from user account
- `changeTier()` - Update user tier (free/plus/premium)
- `blockUser()` / `unblockUser()` - Toggle user active status
- `getUserDetails()` - Get profile + quota + purchase history
- `listUsers()` - Paginated user list
- `bootstrapUsers()` - Create 6 predefined test users (idempotent)

#### Admin Edge Function
Separate function at `/admin` with its own handler:
- **Location:** `supabase/functions/admin/`
- **Routes:**
  - `POST /admin/bootstrap` - Create test users (requires `BOOTSTRAP_SECRET_KEY`)
  - `GET /admin/users` - List all users (requires admin JWT)
  - `GET /admin/users/:userId` - Get user details
  - `POST /admin/users/:userId/tokens` - Adjust token balance
  - `PUT /admin/users/:userId/tier` - Change tier
  - `PUT /admin/users/:userId/status` - Block/unblock user

### User Profile API

#### Me Edge Function
Separate function at `/me` for fetching current user's profile and quota:
- **Location:** `supabase/functions/me/`
- **Route:** `GET /me` - Get current user's profile and quota
- **Authentication:** JWT token (extracts user automatically)
- **No query params needed** - User identified from JWT

**Purpose:** Provides UI with user data without complex REST API queries

**Response format:**
```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "is_admin": false,
    "is_active": true,
    "auth_provider": "email"
  },
  "quota": {
    "tokens_available": 50000,
    "tokens_used": 0
  }
}
```

**Use cases:**
- After signup/login - display tier and token balance
- Page refresh - get updated token balance
- Account settings page - show complete user info

#### Bootstrap Test Users
6 predefined users for development (created by `/admin/bootstrap`):
- `admin@textenhancer.dev` - Admin user (premium, 10M tokens)
- `free@textenhancer.dev` - Free tier (50k tokens)
- `plus@textenhancer.dev` - Plus tier (500k tokens)
- `premium@textenhancer.dev` - Premium tier (5M tokens)
- `zero@textenhancer.dev` - Zero balance (0 tokens, for quota testing)
- `blocked@textenhancer.dev` - Blocked user (10k tokens, is_active=false)

See [Testing](docs/testing.md) for commands and testing scenarios.

### Anonymous Users

The system supports **anonymous sign-ins** via Supabase Auth, allowing users to start using the service without providing email or credentials:

**Key Features:**
- **Same benefits as regular users** - Free tier with 50k welcome tokens
- **No email required** - Users identified by UUID only
- **Automatic profile creation** - Same `handle_new_user()` trigger creates profile + quota
- **Provider tracking** - Stored as `auth_provider = 'anonymous'` in database
- **Rate limited** - 30 anonymous sign-ins per hour per IP address (configured in `config.toml`)

**How it works:**
1. Client calls Supabase Auth API to create anonymous session
2. Supabase returns JWT token with `sub` (user ID) claim
3. Backend validates JWT and fetches user profile (same flow as regular users)
4. Anonymous user has same tier limits and quota management as free tier users

**Important notes:**
- Anonymous users lose access if they clear browser storage (no account recovery)
- Account linking is NOT enabled - anonymous users cannot convert to permanent accounts
- Email field is auto-generated by Supabase (e.g., `anonymous-uuid@supabase.io`)

See [Testing](docs/testing.md) for authentication testing guidance.

## Payment System (Stripe Integration)

The system integrates **Stripe Checkout** for token purchases. **Only registered users** can purchase tokens (anonymous users are blocked to prevent token loss).

### Architecture

**Two-layer design** (following project principles):
- **Handler Layer:** `/create-checkout` and `/stripe-webhook` Edge Functions (signature verification, request extraction)
- **Core Logic Layer:** `PaymentService` in `src/services/payment-service.ts` (platform-agnostic payment processing)

### Key Features

- **Token Packages** - Fixed packages defined in `src/config/payment.config.ts` (e.g., 100k tokens @ $5, 500k @ $20)
- **Stripe Checkout** - Hosted payment page (PCI-compliant, mobile-friendly)
- **Webhook Processing** - Handle `checkout.session.completed`, `charge.refunded`, `payment_intent.payment_failed`
- **Idempotency** - Duplicate webhook events safely ignored using event ID tracking
- **Proportional Refunds** - Token deduction calculated based on refund percentage
- **Atomic Operations** - Reuses existing `add_tokens()` database function with `purchase_type='purchase'`

### Edge Functions

**POST /create-checkout** - Create Stripe checkout session
- Authentication: JWT required
- Blocks anonymous users (`auth_provider='anonymous'`)
- Returns `{ sessionId, url }` for frontend redirect
- Creates session with user metadata for webhook processing

**POST /stripe-webhook** - Process Stripe webhooks
- Authentication: Stripe signature verification
- Always returns 200 OK (prevents retries)
- Processes payments, refunds, and failures
- Uses event ID for idempotency

### Database Schema (Already Prepared)

The `token_purchases` table already has payment-ready columns:
- `amount_paid` - Payment amount (DECIMAL)
- `currency` - ISO currency code (TEXT, default 'USD')
- `description` - Stores event ID for idempotency
- `purchase_type` - Includes `'purchase'` enum value

### Anonymous User Restriction

Anonymous users **cannot purchase tokens** to prevent:
- Token loss when browser storage cleared
- Support issues with unverifiable ownership
- Missing email for Stripe receipts

Implementation: `/create-checkout` checks `user.auth_provider !== 'anonymous'` and returns 403 error.

### Complete Documentation

See **[docs/payment.md](./docs/payment.md)** for comprehensive documentation including:
- Token package configuration
- Payment flow diagrams
- Webhook event handling
- Security and idempotency
- Testing with Stripe CLI
- Deployment checklist

## Known Limitations (Technical Debt)

1. **Token Counting**
   - Gemini connector returns 0 for token count (API limitation)
   - Pre-flight estimates are rough (4 chars ≈ 1 token + 500 overhead)

2. **Rate Limiting**
   - Only quota limits implemented
   - No request rate limiting per user (requests per minute/hour)

3. **Error Recovery**
   - Post-flight token deduction is fire-and-forget (no retry logic)
   - No circuit breaker pattern for external service failures

See `spec/technical_debt.md` for complete details.

## Common Development Tasks

### Testing with Bootstrap Users

**Create test users:**
```bash
# Start Supabase local stack
supabase start

# Bootstrap 6 test users (idempotent - safe to run multiple times)
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: your-bootstrap-secret"
```

**Login and get JWT token:**
```bash
# Get anon key from: supabase status
ANON_KEY="<your-anon-key>"

# Login as free user
curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "free@textenhancer.dev",
    "password": "Free_User_2025"
  }' | jq -r '.access_token'
```

**Fetch user profile:**
```bash
TOKEN="<jwt-token-from-login>"

curl -X GET http://localhost:54321/functions/v1/me \
  -H "Authorization: Bearer $TOKEN"
```

**Test enhancement with JWT:**
```bash
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Hello world",
      "options": { "improve": true }
    }]
  }'
```

### Admin Operations (Local)

**List all users:**
```bash
ADMIN_TOKEN="<admin-jwt-token>"

curl http://localhost:54321/functions/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Adjust user tokens:**
```bash
# Add tokens
curl -X POST http://localhost:54321/functions/v1/admin/users/$USER_ID/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "tokens": 100000, "description": "Bonus tokens" }'

# Subtract tokens
curl -X POST http://localhost:54321/functions/v1/admin/users/$USER_ID/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "tokens": -50000 }'
```

**Change user tier:**
```bash
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/tier \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "tier": "premium" }'
```

**Block/unblock user:**
```bash
# Block
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'

# Unblock
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": true }'
```

### Adding a New Model
1. Add entry to `MODELS` array in `src/config/models.config.ts`
2. Set appropriate `allowedTiers` array
3. Map to existing provider or create new connector
4. Run `npm run type-check`

### Adding a New Role
1. Add entry to `ROLES` array in `src/config/roles.config.ts`
2. Write effective system prompt
3. Set `allowedModels` array to restrict model access
4. Run `npm run type-check`

### Changing Quota Limits
1. Update `QUOTA_LIMITS` in `src/config/quota.config.ts`
2. No deployment required (config loaded at startup)

### Adding a New LLM Provider
1. Create connector in `src/connectors/llm-connectors/`
2. Implement `LLMConnector` interface
3. Update `LLMConnectorFactory.createAll()`
4. Add provider config to environment variables
5. Add tests in `tests/unit/connectors/`

## Environment Variables

Required variables (see `.env.local.example`):

```bash
# Supabase Configuration (Required)
SUPABASE_URL=http://127.0.0.1:54321                  # Get from: supabase status
APP_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Get from: supabase status (Secret key)
APP_SUPABASE_JWT_SECRET=your_jwt_secret              # Get from: supabase status -o json | grep JWT_SECRET
BOOTSTRAP_SECRET_KEY=local-dev-secret-123            # For /admin/bootstrap endpoint

# LLM Providers (Required)
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

# Payment System (Required for token purchases)
STRIPE_SECRET_KEY=sk_test_...                # Stripe API secret key (test or live)
STRIPE_WEBHOOK_SECRET=whsec_...              # Webhook signing secret from Stripe Dashboard
STRIPE_PUBLISHABLE_KEY=pk_test_...           # For frontend (safe to expose)

# Optional: Local Development
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Configuration (Optional)
LLM_TIMEOUT_MS=30000      # Default: 30 seconds
MAX_BATCH_SIZE=10         # Default: 10
```

**Getting Supabase credentials for local development:**
```bash
# Get all credentials
supabase status

# Output includes:
# - API URL (SUPABASE_URL)
# - Publishable key (anon key - for client-side, not needed in .env.local)
# - Secret key (service_role key - use for APP_SUPABASE_SERVICE_ROLE_KEY)

# Get JWT secret
supabase status -o json | grep JWT_SECRET
```

**Important:** In production, use Supabase Dashboard to get these values from Settings → API.

## Documentation Structure

The `spec/` directory contains extensive documentation:

- **QUICK_CONTEXT.md** - Compact 350-line overview (best for LLM context)
- **CORE_GUIDE.md** - Complete 600+ line architecture guide
- **API_REFERENCE.md** - Full 900+ line API specification
- **quick_reference.md** - Developer commands and setup
- **implementation_guide.md** - Coding patterns and conventions
- **prompt_construction.md** - Prompt engineering details
- **technical_debt.md** - Known issues and TODOs

## Common Pitfalls to Avoid

- ❌ Adding business logic to handler files (`supabase/functions/enhance/`)
- ❌ Using `Deno.*` APIs anywhere in `src/`
- ❌ Forgetting `.js` extensions in import statements
- ❌ Mutating `process.env` in tests without cleanup
- ❌ Assuming all batch tasks succeed (always use partial success pattern)
- ❌ Not enforcing timeouts on external API calls
- ❌ Creating new files instead of editing existing ones
- ❌ Hardcoding configuration instead of using config modules

## Handler Size Limit

The handler file must stay under 100 lines. Current size: 36 lines. This constraint ensures:
- Platform migration remains trivial
- All business logic lives in testable `src/` directory
- Clear separation of concerns

Check handler size: `wc -l supabase/functions/enhance/index.ts`
