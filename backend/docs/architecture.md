# Architecture Guide

**Last Updated:** January 2025

Complete system architecture documentation covering the two-layer design, request flow, key patterns, and platform portability.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Two-Layer Design](#two-layer-design)
3. [Request Flow](#request-flow)
4. [Core Services](#core-services)
5. [Authentication Architecture](#authentication-architecture)
6. [Token Quota Management](#token-quota-management)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Platform Portability](#platform-portability)
9. [Technology Stack](#technology-stack)

---

## Architecture Overview

### Design Philosophy

The AI Text Enhancer Backend is a **serverless application** designed with **complete platform portability** as the core principle. The entire business logic can migrate to AWS Lambda, Cloudflare Workers, or other platforms in 4-8 hours by rewriting only the thin handler layer (~36 lines).

**Core Value Proposition:** This is not a simple LLM wrapper—it's an intelligent engine that:
- Abstracts prompt engineering complexity
- Manages user quotas with atomic database operations
- Controls tier-based access
- Processes batches of enhancement requests in parallel across multiple LLM providers

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                        │
│                  (Web/Mobile/Desktop)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Request
                         │ POST /functions/v1/enhance
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION (Deno)                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  HANDLER LAYER (Platform-Specific, <100 lines)         │ │
│ │  - Extract Request/Headers                              │ │
│ │  - Initialize Services                                  │ │
│ │  - Call Core Logic                                      │ │
│ │  - Format Response                                      │ │
│ │  - Handle CORS                                          │ │
│ └────────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│ ┌────────────────────▼────────────────────────────────────┐ │
│ │  CORE LOGIC LAYER (Platform-Agnostic)                  │ │
│ │  - Authentication (AuthService + Supabase Auth)        │ │
│ │  - Authorization (AuthorizationService)                │ │
│ │  - Quota Management (QuotaService + Database)          │ │
│ │  - Batch Orchestration (BatchOrchestrator)             │ │
│ │  - Prompt Engineering (PromptBuilder)                  │ │
│ │  - LLM Provider Routing (Connectors)                   │ │
│ │  - Response Aggregation                                │ │
│ └────────────────────┬────────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────┘
                       │
        ┌──────────────┼───────────────┐
        │              │               │
        ▼              ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  Supabase    │ │   LLM    │ │  PostgreSQL  │
│  Auth + DB   │ │ Providers│ │  Functions   │
│  (JWT, Users)│ │ (Gemini, │ │  (Quotas)    │
│              │ │OpenRouter│ │              │
└──────────────┘ └──────────┘ └──────────────┘
```

---

## Two-Layer Design

### Layer 1: Handler (Platform-Specific)

**Location:** `supabase/functions/enhance/index.ts` + `handler.ts`

**Size:** Currently 36 lines (must stay under 100 lines)

**Allowed APIs:** `Deno.*`, `Request`, `Response`

**Purpose:** Minimal adapter between serverless platform and core logic

**Responsibilities:**
- Receive native platform `Request` object (Deno `Request`)
- Extract authentication headers (`Authorization: Bearer <token>`)
- Initialize services with configuration
- Invoke core business logic
- Format response into platform `Response` object
- Handle platform-specific concerns (CORS headers, error formatting)

**Critical Constraint:** **MUST NOT contain any business logic**

**Migration Impact:** This is the **ONLY** code that needs rewriting when migrating platforms.

**Example Handler Structure:**

```typescript
// index.ts - Entry point (~20 lines)
import { loadConfig, validateConfig } from '../../../src/config/index.ts';
import { BatchOrchestrator } from '../../../src/services/batch-orchestrator.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';

// Load configuration once at startup
const config = loadConfig();
validateConfig(config);

// Initialize services
const orchestrator = new BatchOrchestrator(/* ... */);
const authMiddleware = new AuthMiddleware(config);

// Start HTTP server
Deno.serve(async (req: Request) => {
  return await handleRequest(req, { orchestrator, authMiddleware });
});
```

---

### Layer 2: Core Logic (Platform-Agnostic)

**Location:** `src/` directory

**Purpose:** Contains 100% of business logic using standard JavaScript/TypeScript

**Key Services:**
1. **AuthService** - JWT validation with Supabase Auth
2. **AuthMiddleware** - Token extraction and user profile fetching
3. **QuotaService** - Token quota management with atomic database operations
4. **QuotaMiddleware** - Pre-flight quota validation
5. **AuthorizationService** - Model access control based on user tier
6. **BatchOrchestrator** - Main orchestrator for parallel processing
7. **PromptBuilder** - Prompt construction from options and role definitions
8. **PromptTemplates** - Template functions for prompt formatting
9. **LLM Connectors** - Provider-specific adapters (Gemini, OpenRouter, LM Studio)

**Constraints:**
- **CANNOT use:** `Deno.*`, platform-specific imports
- **CAN use:** `fetch`, `process.env`, npm packages (via `npm:` in Deno)
- **MUST be:** Testable with Jest in Node.js environment

**Migration Impact:** **ZERO** changes needed when migrating platforms ✅

---

## Request Flow

### Complete Request Pipeline (10 Steps)

```
1. Client → POST /functions/v1/enhance + Bearer Token

2. Handler extracts token and body

3. AuthMiddleware.authenticate(token)
   ↓
   AuthService validates JWT locally (jose library)
   ↓
   Extract userId from JWT payload (sub claim)
   ↓
   UserRepository fetches profile + quota from database
   ↓
   Check user.isActive (throw UserBlockedError if false)
   ↓
   Returns UserProfile with tier, admin status, quota info

4. QuotaMiddleware.checkQuota(user, estimatedTokens)
   ↓
   Estimate total tokens needed (4 chars ≈ 1 token + 500 overhead per task)
   ↓
   QuotaRepository.checkBalance(userId, requiredTokens)
   ↓
   Calls database function check_user_quota() with FOR UPDATE lock
   ↓
   Throw InsufficientQuotaError if insufficient

5. AuthorizationService validates model access based on user tier

6. Request validation (schema validation with tier-specific limits)

7. BatchOrchestrator.processBatch(user, request):
   a. Validate batch structure (unique IDs, tier-based size limits)
   b. Process assistants in parallel using Promise.allSettled
   c. For each assistant:
      - PromptBuilder constructs system + user prompts
      - Route to LLM provider via Connector
      - Enforce 30-second timeout per LLM call (AbortController)
      - Collect enhanced text + token count
   d. Aggregate results (success/error per task)

8. Calculate actual token usage from successful tasks

9. QuotaService.deductTokens(userId, tokensUsed)
   ↓
   QuotaRepository.deductTokens(userId, tokensUsed)
   ↓
   Calls database function deduct_tokens() with FOR UPDATE lock
   ↓
   Atomic deduction (fire-and-forget, no retry on failure)

10. Handler formats BatchResponse and returns to client (HTTP 200)
```

### Parallel Processing Strategy

- **Each assistant is processed independently**
- Uses `Promise.allSettled` to allow partial success
- Individual task failures don't block other tasks
- Timeout enforced per task using `AbortController`
- Results array maintains order matching request assistants

---

## Core Services

### BatchOrchestrator

**File:** `src/services/batch-orchestrator.ts`

**Main Orchestrator** for processing multiple assistants in parallel.

**Responsibilities:**
- Validate batch structure (1-10 assistants, unique IDs)
- Estimate token usage for pre-flight quota check
- Process all assistants with `Promise.allSettled`
- Aggregate results (partial success pattern)
- Calculate actual token usage
- Report usage to database (post-flight)

**Key Methods:**
- `processBatch(user, request): Promise<BatchResponse>`
- `validateBatchRequest(request): void`
- `processAllAssistants(assistants): Promise<ProcessingResult[]>`

---

### AuthService

**File:** `src/services/auth-service.ts`

**JWT validation** using local verification (jose library) and database-backed user profiles.

**Responsibilities:**
- Validate JWT tokens locally (no HTTP calls to Supabase Auth API)
- Extract userId from JWT payload (sub claim)
- Fetch user profile + quota from database
- Check user.isActive (throw UserBlockedError if false)
- Return `UserProfile` with tier and quota information

**Key Methods:**
- `validateToken(token): Promise<AuthResult>`
- `extractToken(authHeader): string`

**Architecture Note:** Uses local JWT verification for efficiency in Edge Functions, avoiding HTTP calls to Supabase Auth API.

---

### AuthMiddleware

**File:** `src/services/auth-middleware.ts`

**Authentication middleware** for extracting and validating Bearer tokens.

**Responsibilities:**
- Extract Bearer token from Authorization header
- Call AuthService to validate token
- Return `UserProfile` with tier and quota info
- Throw authentication errors (InvalidTokenError, UserBlockedError, UserNotFoundError)

**Key Methods:**
- `authenticate(headers): Promise<UserProfile>`

---

### QuotaService

**File:** `src/services/quota-service.ts`

**Token quota management** with atomic database operations.

**Responsibilities:**
- Pre-flight quota validation (check if user has sufficient tokens)
- Post-flight token deduction (atomic database update)
- Estimate token counts for text (4 chars ≈ 1 token + 500 overhead)

**Key Methods:**
- `checkQuota(user, requiredTokens): QuotaCheckResult`
- `requireQuota(user, requiredTokens): void` (throws on failure)
- `deductTokens(userId, tokensUsed): Promise<void>`
- `estimateTokens(text): number`

**Architecture Note:** All quota operations use PostgreSQL functions with row-level locking (`FOR UPDATE`) for atomic operations.

---

### QuotaMiddleware

**File:** `src/services/quota-middleware.ts`

**Pre-flight quota validation** before processing requests.

**Responsibilities:**
- Estimate total tokens needed for batch
- Check user has sufficient quota
- Throw `InsufficientQuotaError` if needed

**Key Methods:**
- `checkQuota(user, estimatedTokens): void`

---

### AuthorizationService

**File:** `src/services/authorization-service.ts`

**Tier-based model access control**.

**Responsibilities:**
- Validate model access based on user tier
- Check if models are allowed for specific AI roles
- Throw `ModelAccessDeniedError` if unauthorized

**Key Methods:**
- `validateModelAccess(user, modelId): void`
- `isModelAllowedForRole(modelId, roleId): boolean`

---

### PromptBuilder

**File:** `src/services/prompt-builder.ts`

**Prompt construction orchestrator** that builds system and user prompts.

**Responsibilities:**
- Build system prompt from role configuration
- Build user prompt from TransformationOptions
- Combine userText, contextText, and options
- Enforce JSON-only response format

**Key Methods:**
- `buildPrompt(request): ConstructedPrompt`

---

### LLM Connectors

**Location:** `src/connectors/llm-connectors/`

All connectors implement the `LLMConnector` interface for provider abstraction:

```typescript
interface LLMConnector {
  generateEnhancement(
    prompt: string,
    modelId: string,
    timeoutMs: number
  ): Promise<{ enhancedText: string; total_tokens: number }>;
}
```

**Available Connectors:**
1. **GeminiConnector** - Google Gemini API via SDK
   - **Known limitation:** Token counting hardcoded to 0 (API limitation)
2. **OpenRouterConnector** - OpenRouter REST API
3. **LMStudioConnector** - Local LM Studio (development only)

**Factory Pattern:** `LLMConnectorFactory` creates all connectors at startup based on provider configuration.

---

## Authentication Architecture

### Overview

The system uses **Supabase Auth** for JWT-based authentication with database-backed user profiles:

- **JWT Validation:** Local JWT verification using `jose` library (no external HTTP calls)
- **User Profiles:** Database-backed user data with tier, admin status, active status
- **Token Quotas:** Per-user token balances tracked in `user_quotas` table
- **Auth Providers:** Support for email, Google, GitHub, Apple, Facebook, Twitter, Azure, **Anonymous**

### Authentication Flow

```
Request with Bearer token
    ↓
AuthMiddleware.authenticate(headers)
    ↓
AuthService.validateToken(token)
    ↓
1. Local JWT verification with jose library
   - Verify signature with JWT_SECRET
   - Extract payload with sub claim (user ID)
2. UserRepository.getUserById(userId)
   - Single JOIN query fetches profile + quota
   - SELECT from users + user_quotas tables
3. Check user.isActive
   - Throw UserBlockedError if false
4. Return UserProfile with quota information
```

### Anonymous Sign-Ins

The system supports **anonymous authentication**, allowing users to start using the service without providing email or credentials:

**Key Features:**
- Same benefits as regular users (free tier with 50k welcome tokens)
- No email required - users identified by UUID only
- Automatic profile creation via `handle_new_user()` database trigger
- Provider tracking - stored as `auth_provider = 'anonymous'` in database
- Rate limited - 30 anonymous sign-ins per hour per IP address (configured in `config.toml`)

**Important Notes:**
- Anonymous users lose access if they clear browser storage (no account recovery)
- Account linking is NOT enabled - anonymous users cannot convert to permanent accounts
- Email field is auto-generated by Supabase (e.g., `anonymous-uuid@supabase.io`)

---

## Token Quota Management

### Overview

Token quotas are **NOT daily limits** - they are one-time balances that deplete with usage. Tokens can be purchased or granted by admins.

### Quota Workflow

#### Pre-Flight Check (Before LLM Calls)

```typescript
// 1. Estimate token usage
const estimatedTokens = this.estimateTotalTokens(request.assistants);
// Formula: (text.length / 4) + 500 overhead per task

// 2. Check quota - throws if insufficient
this.quotaMiddleware.checkQuota(user, estimatedTokens);
// Calls database: check_user_quota(user_id, tokens_required)
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION check_user_quota(
  p_user_id UUID,
  p_tokens_required INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT tokens_available >= p_tokens_required
    FROM user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE  -- Row-level lock
  );
END;
$$ LANGUAGE plpgsql;
```

**Errors Thrown:**
- `InsufficientQuotaError` - Not enough tokens (HTTP 429)

---

#### Post-Flight Deduction (After LLM Calls)

```typescript
// 1. Calculate actual token usage from successful tasks
const totalTokensUsed = processingResults
  .filter(r => r.success)
  .reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

// 2. Deduct tokens (fire-and-forget pattern)
try {
  await this.quotaService.deductTokens(user.userId, totalTokensUsed);
  // Calls database: deduct_tokens(user_id, tokens_used)
} catch (error) {
  // Log but don't fail - user already got results
  console.error('Failed to deduct tokens:', error);
}
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id UUID,
  p_tokens_used INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE user_quotas
  SET
    tokens_available = tokens_available - p_tokens_used,
    tokens_used = tokens_used + p_tokens_used,
    updated_at = NOW()
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Row-level lock (atomic operation)
END;
$$ LANGUAGE plpgsql;
```

**Important:** Token deduction failures are logged but don't block user requests (fire-and-forget pattern).

---

### Admin Token Management

Admins can adjust user token balances:

```typescript
// Add tokens
await adminService.adjustTokens(userId, 100000, "Bonus tokens");
// Calls database: add_tokens(user_id, tokens_added, 'admin_adjustment', ...)

// Subtract tokens
await adminService.adjustTokens(userId, -50000);
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION add_tokens(
  p_user_id UUID,
  p_tokens_added INTEGER,
  p_purchase_type VARCHAR,
  p_description TEXT
) RETURNS VOID AS $$
BEGIN
  -- Update quota
  UPDATE user_quotas
  SET
    tokens_available = tokens_available + p_tokens_added,
    updated_at = NOW()
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Record transaction
  INSERT INTO token_purchases (user_id, tokens, purchase_type, description)
  VALUES (p_user_id, p_tokens_added, p_purchase_type, p_description);
END;
$$ LANGUAGE plpgsql;
```

---

## Error Handling Patterns

### Partial Success Pattern

**Key Principle:** Individual task failures don't block other tasks.

**Implementation:**
- HTTP 200 status even with partial failures
- Each task has `status: 'success' | 'error'`
- `Promise.allSettled` ensures all tasks complete
- Results array matches request assistant order

**Example Response:**

```json
{
  "results": [
    {
      "id": "task-1",
      "status": "success",
      "enhancedText": "...",
      "total_tokens": 45
    },
    {
      "id": "task-2",
      "status": "error",
      "error": {
        "code": "LLM_TIMEOUT",
        "message": "LLM provider timeout after 30 seconds"
      }
    }
  ]
}
```

---

### Timeout Strategy

**Configuration:** `LLM_TIMEOUT_MS` (default: 30000ms)

**Implementation:**
- Uses `AbortController` for cancellation
- Applied per LLM call
- Prevents hanging requests
- Returns timeout error for affected task

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

### Error Classes

**Location:** `src/errors/`

- **auth-errors.ts** - `InvalidTokenError`, `UserBlockedError`, `UserNotFoundError`
- **quota-errors.ts** - `InsufficientQuotaError`
- **orchestration-errors.ts** - `BatchSizeError`, `EmptyBatchError`, `TaskTimeoutError`
- **llm-errors.ts** - LLM provider-specific errors

All errors extend base `AppError` class with `code` and `httpStatus` properties.

---

## Platform Portability

### Design Principles

1. **Separation of Concerns:** Handler (platform) vs Core (portable)
2. **Standard APIs Only:** Use `fetch`, `process.env`, standard libraries
3. **No Framework Lock-in:** No Express, Fastify, Hono
4. **Universal Modules:** All core code works in Node.js and Deno

### Forbidden Patterns in Core Logic

**❌ NOT ALLOWED in `src/`:**

```typescript
// Deno-specific APIs
const apiKey = Deno.env.get('API_KEY');
const file = await Deno.readTextFile('config.json');

// Deno imports
import { serve } from "https://deno.land/std/http/server.ts";

// Platform-specific request handling
function handler(req: Request): Response { }
```

**✅ ALLOWED in `src/`:**

```typescript
// Standard environment variables
const apiKey = process.env.API_KEY;

// Standard fetch API
const response = await fetch(url, options);

// Standard JavaScript/TypeScript
import { something } from './module.js';
```

---

### Migration Checklist

**To migrate to AWS Lambda (example):**

**Estimated Time:** 4-8 hours

**Steps:**

1. **Create new handler** (`lambda/index.ts` ~50-100 lines):
   ```typescript
   import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
   import { BatchOrchestrator } from '../src/services/batch-orchestrator';

   export const handler = async (
     event: APIGatewayProxyEvent
   ): Promise<APIGatewayProxyResult> => {
     const authToken = event.headers['Authorization']?.replace('Bearer ', '');
     const body = JSON.parse(event.body || '{}');

     // Initialize services (same as Deno)
     const config = loadConfig();
     const orchestrator = new BatchOrchestrator(/* ... */);

     const user = await authMiddleware.authenticate(authToken);
     const result = await orchestrator.processBatch(user, body);

     return {
       statusCode: 200,
       body: JSON.stringify(result),
       headers: { 'Content-Type': 'application/json' }
     };
   };
   ```

2. **Update deployment:** `serverless.yml` or AWS SAM template
3. **Test locally:** AWS SAM CLI
4. **Deploy to AWS**
5. **Core Logic (`src/`):** **NO CHANGES REQUIRED** ✅

---

### Portability Validation

**Automated Check:**

```bash
npm run lint:portability
# Checks for Deno.* in src/
```

**Manual Verification:**

```bash
# Should return 0 matches
grep -r "Deno\." src/

# Should find Request/Response only in handler
grep -r "Request\|Response" src/
```

---

## Technology Stack

### Runtime & Platform

| Component | Current | Compatible With |
|-----------|---------|-----------------|
| **Runtime** | Deno | Node.js 22, Cloudflare Workers |
| **Platform** | Supabase Edge Functions | AWS Lambda, Vercel, Netlify |
| **Deployment** | Supabase CLI | AWS CLI, Serverless Framework |

### Core Technologies

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Language** | TypeScript (strict mode) | Type safety, better DX |
| **HTTP Client** | Native `fetch` + AbortController | Universal compatibility |
| **Authentication** | Supabase Auth + jose | JWT validation (local) |
| **Database** | PostgreSQL + Supabase | User profiles, quotas, atomic operations |
| **LLM SDKs** | `@google/genai`, REST APIs | Multi-provider support |
| **Testing** | Jest | Unit tests (validates portability) |
| **Config** | TypeScript modules + env vars | Type-safe, portable |

### Dependencies

**No Web Framework** - Direct Request/Response handling for maximum portability

**Package Management:**
- **For Deno:** `npm:` specifiers in imports
- **For Testing:** npm packages in `package.json`

**Import Example:**

```typescript
// In Deno (handler)
import { GoogleGenerativeAI } from 'npm:@google/genai';

// In src/ (portable)
import { GoogleGenerativeAI } from '@google/genai';
// Works because import map maps it to npm: in Deno
```

---

## Summary

The AI Text Enhancer Backend uses a **two-layer architecture** with complete separation between platform-specific code (handler, <100 lines) and platform-agnostic business logic (core, `src/` directory). This design enables:

1. **Easy Platform Migration:** 4-8 hours to switch from Supabase to AWS Lambda/Cloudflare Workers
2. **Robust Authentication:** Supabase Auth with JWT validation and database-backed user profiles
3. **Atomic Quota Management:** PostgreSQL functions with row-level locking for token operations
4. **Partial Success Pattern:** Individual task failures don't block other tasks
5. **Parallel Processing:** `Promise.allSettled` with timeout enforcement per task
6. **Testability:** 100% of business logic is testable with Jest in Node.js

**Related Documentation:**
- [API Reference](./api-reference.md) - Complete API specification
- [Developer Guides](./developer-guides.md) - Implementation patterns and how-to guides
- [Known Issues](./known-issues.md) - Current limitations and technical debt
- [Configuration](./configuration.md) - Environment variables and settings
