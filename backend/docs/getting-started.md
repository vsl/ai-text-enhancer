# Getting Started

Complete guide to setting up your development environment and making your first API call.

**Last Updated:** January 2025
**Time Required:** 15-20 minutes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup](#quick-setup)
3. [First API Call](#first-api-call)
4. [Project Overview](#project-overview)
5. [Key Concepts](#key-concepts)
6. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** 22 - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Supabase CLI** - [Installation guide](https://supabase.com/docs/guides/cli)
  ```bash
  # macOS
  brew install supabase/tap/supabase

  # Windows (via scoop)
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase

  # Linux
  brew install supabase/tap/supabase
  ```
- **Docker Desktop** - Required for local Supabase ([Download](https://www.docker.com/products/docker-desktop))

### API Keys

You'll need API keys for LLM providers:

- **Google Gemini API Key** - [Get key](https://makersuite.google.com/app/apikey) (Free tier available)
- **OpenRouter API Key** - [Get key](https://openrouter.ai/keys) (Optional, for additional models)

### Optional

- **LM Studio** - For local LLM testing ([Download](https://lmstudio.ai/))
- **Git** - For version control
- **VS Code** - Recommended editor with TypeScript support

---

## Quick Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone git@github-personal:vsl/ai-text-enhancer.git
cd ai-text-enhancer/backend

# Install dependencies
npm install
```

### Step 2: Start Supabase

```bash
# Start local Supabase stack (PostgreSQL + Edge Functions)
supabase start
```

This will start:
- PostgreSQL database on `localhost:54322`
- Supabase Studio on `http://localhost:54323` (database admin UI)
- Edge Functions on `http://localhost:54321`
- Kong API Gateway, GoTrue auth, PostgREST, Realtime

**Important:** Keep this running in a terminal tab throughout development.

### Step 3: Get Supabase Credentials

Run the following command to see your local Supabase credentials:

```bash
supabase status
```

You'll see output like:

```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (publishable key)
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (secret key)
```

**Note the terminology:**
- `anon key` = Publishable key (safe for client-side use)
- `service_role key` = Secret key (server-side only, NEVER expose to clients)

To get the JWT secret specifically:

```bash
supabase status -o json | grep JWT_SECRET
```

### Step 4: Create Environment File

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:

```bash
# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
APP_SUPABASE_JWT_SECRET=<JWT secret from supabase status>
BOOTSTRAP_SECRET_KEY=local-dev-secret-123

# LLM Provider API Keys
GEMINI_API_KEY=<your-gemini-api-key>
OPENROUTER_API_KEY=<your-openrouter-api-key>  # Optional

# Optional: Local Development
LM_STUDIO_BASE_URL=http://localhost:1234
```

**Environment Variable Mapping:**

| `supabase status` Output | `.env.local` Variable | Example Value |
|---|---|---|
| `service_role key` | `APP_SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` |
| JWT secret | `APP_SUPABASE_JWT_SECRET` | `super-secret-jwt-token...` |
| API URL | `SUPABASE_URL` | `http://127.0.0.1:54321` |

### Step 5: Bootstrap Test Users

Create 6 predefined test users for development:

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"
```

Expected response:

```json
{
  "success": true,
  "usersCreated": 6,
  "usersSkipped": 0,
  "users": [
    "admin@textenhancer.dev",
    "free@textenhancer.dev",
    "plus@textenhancer.dev",
    "premium@textenhancer.dev",
    "zero@textenhancer.dev",
    "blocked@textenhancer.dev"
  ]
}
```

These users have known passwords (see [Testing](./testing.md) for details).

### Step 6: Start Development Server

```bash
# In a new terminal (keep supabase start running)
npm run dev
```

This serves the Edge Function with hot reload at `http://localhost:54321/functions/v1/enhance`.

---

## First API Call

### Step 1: Login to Get JWT Token

Login as the free tier test user:

```bash
curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{
    "email": "free@textenhancer.dev",
    "password": "Free_User_2025"
  }'
```

Expected response includes:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "...",
    "email": "free@textenhancer.dev"
  }
}
```

Copy the `access_token` value.

### Step 2: Test Health Endpoint

```bash
curl http://localhost:54321/functions/v1/enhance/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "ai-text-enhancer"
}
```

### Step 3: Make Your First Enhancement Request

```bash
# Replace <YOUR_TOKEN> with the access_token from Step 1
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Hello world, this is a test message.",
      "options": {
        "improve": true,
        "fixMistakes": true
      }
    }]
  }'
```

Expected response:

```json
{
  "results": [{
    "id": "test-1",
    "status": "success",
    "enhancedText": "Hello world! This is a test message.",
    "total_tokens": 0
  }]
}
```

**Note:** Gemini's token counting is currently limited, so `total_tokens` may return 0 (see [Known Issues](./known-issues.md)).

### Step 4: Verify Token Deduction

Check your profile and quota:

```bash
curl -X GET http://localhost:54321/functions/v1/me \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

Expected response:

```json
{
  "profile": {
    "id": "...",
    "email": "free@textenhancer.dev",
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

**Congratulations!** You've successfully made your first API call.

---

## Project Overview

### What Makes This Project Different

This is **not a simple LLM wrapper**—it's an intelligent engine designed with **platform portability** as the core principle.

**Core Value Proposition:**
The entire business logic can migrate to AWS Lambda, Cloudflare Workers, or other platforms in **4-8 hours** by rewriting only the thin handler layer (~36 lines).

### Key Features

1. **Intelligent Batch Processing** - Process 1-10 enhancement requests in parallel
2. **Multi-LLM Support** - Gemini, OpenRouter, LM Studio with easy extensibility
3. **Tier-Based Access Control** - Free, Plus, and Premium tiers with different limits
4. **Token-Based Quotas** - Wallet/credits model instead of daily limits
5. **Anonymous User Support** - Start using without email/password signup
6. **Platform Portability** - Migrate to any serverless platform in hours
7. **Partial Success Pattern** - Individual task failures don't block batch
8. **Database-Backed Auth** - Supabase Auth with PostgreSQL profiles
9. **Admin API** - Complete user and quota management
10. **Comprehensive Testing** - Unit, integration, and E2E tests

### Architecture Overview

```
POST /enhance
    ↓
1. Handler (index.ts) - 36 lines, Deno-specific
    ↓
2. AuthMiddleware - Validates Bearer token, fetches user profile
    ↓
3. QuotaMiddleware - Pre-flight quota check
    ↓
4. BatchOrchestrator - Processes 1-10 assistants in parallel
    ↓
5. For each assistant:
   - AuthorizationService checks model access
   - PromptBuilder creates prompts
   - LLMConnectorFactory routes to provider
    ↓
6. QuotaService - Post-flight token deduction
    ↓
7. Return BatchResponse (HTTP 200 even if tasks fail)
```

### Two-Layer Design

**Layer 1: Handler** (`supabase/functions/enhance/index.ts`)
- Platform-specific (uses `Deno.*` APIs)
- Extracts request → Calls core logic → Formats response
- **Size:** <100 lines (currently 36 lines)
- **Migration Impact:** Rewrite this layer for new platforms

**Layer 2: Core Logic** (`src/`)
- Platform-agnostic (standard TypeScript/JavaScript)
- 100% of business logic
- **No platform APIs:** No `Deno.*`, only `fetch()` and npm packages
- **Migration Impact:** Zero changes required

---

## Key Concepts

### User Tiers

| Tier | Starting Tokens | Max User Text | Max Context | Batch Size |
|------|----------------|---------------|-------------|------------|
| **Free** | 50,000 | 500 chars | 800 chars | 5 tasks |
| **Plus** | 500,000 | 2,000 chars | 3,000 chars | 10 tasks |
| **Premium** | 5,000,000 | 10,000 chars | 15,000 chars | 10 tasks |

### Authentication Methods

1. **Email/Password** - Standard authentication with email verification
2. **OAuth Providers** - Google, GitHub, Apple, Facebook, Twitter, Azure
3. **Anonymous** - No email required, 50k welcome tokens, same free tier limits

### Token Quota System

- **Wallet/Credits Model** - Not daily limits, but a balance that depletes
- **Pre-flight Estimation** - Estimates tokens before processing
- **Post-flight Deduction** - Deducts actual tokens used after processing
- **Atomic Operations** - PostgreSQL functions with row-level locking
- **Welcome Bonus** - 50k tokens for new users (all auth methods)

### Available Models

- **gemini-flash** - Google Gemini 2.5 Flash (Free/Plus/Premium)
- **open-router-free** - OpenRouter free models (Free/Plus/Premium)
- **lm-studio-local** - Local LM Studio (Development only)

### Available AI Roles

12 predefined roles including:
- **editor** - Professional text editor
- **translator** - Multi-language translator
- **writer** - Creative content writer
- **businesswriter** - Business communication specialist
- **poet** - Poetry and creative writing
- And 7 more...

See [API Reference](./api-reference.md) for complete details.

---

## Next Steps

### For New Developers

1. **Understand the Codebase**
   - Read [Project Structure](./project-structure.md) to understand code organization
   - Browse through `src/services/` to see business logic
   - Check `src/config/` to see configuration modules

2. **Learn the Architecture**
   - Read [Architecture](./architecture.md) for system design
   - Understand the two-layer pattern
   - Review request flow (10 steps)

3. **Start Developing**
   - Read [Developer Guides](./developer-guides.md) for implementation patterns
   - Follow [Testing](./testing.md) guide to run tests
   - Check [Known Issues](./known-issues.md) for current limitations

### For Frontend Developers

1. **API Integration**
   - Read [API Reference](./api-reference.md) for complete API documentation
   - Test endpoints using the curl examples
   - Check authentication flow and error codes

2. **Testing**
   - Use bootstrap test users for development
   - Test different tier limits
   - Handle partial success responses

### For DevOps Engineers

1. **Deployment**
   - Read [Deployment](./deployment.md) for deployment guide
   - Set up GitHub Actions CI/CD
   - Configure production environment variables

2. **Platform Migration**
   - Review [Migration Guides](./migration/OVERVIEW.md)
   - Understand handler rewrite requirements
   - Plan migration timeline (4-8 hours)

---

## Common Commands Reference

```bash
# Development
npm run dev              # Start development server with hot reload
npm test                 # Run all tests
npm test -- --watch     # Run tests in watch mode
npm run type-check      # TypeScript type checking
npm run lint:portability # Check for platform-specific APIs in src/

# Supabase
supabase start          # Start local Supabase stack
supabase stop           # Stop local Supabase
supabase status         # Show connection info
supabase db reset       # Reset database (migrations + seed)

# Deployment
npm run setup:env       # Set environment variables in Supabase
npm run deploy          # Deploy to Supabase
npm run health          # Check deployment health
npm run logs            # View function logs
npm run logs:tail       # Tail logs in real-time
```

---

## Troubleshooting

### Supabase Won't Start

**Problem:** `supabase start` fails

**Solutions:**
```bash
# Check Docker is running
docker ps

# Restart Docker Desktop

# Try stopping and starting again
supabase stop
supabase start
```

### API Returns 401 Unauthorized

**Problem:** Authentication fails

**Solutions:**
1. Check your JWT token hasn't expired (expires in 1 hour)
2. Login again to get a fresh token
3. Verify the token is included in the `Authorization: Bearer <token>` header
4. Check the user hasn't been blocked

### Bootstrap Endpoint Returns Error

**Problem:** Can't create test users

**Solutions:**
1. Check `BOOTSTRAP_SECRET_KEY` in `.env.local` matches the Authorization header
2. Verify Supabase is running (`supabase status`)
3. Run `supabase db reset` to reset database
4. Check logs: `npm run logs:tail`

### Tests Failing

**Problem:** `npm test` shows failures

**Solutions:**
```bash
# Clear coverage and node_modules
rm -rf coverage node_modules

# Reinstall dependencies
npm install

# Run tests again
npm test

# Check specific test file
npm test -- path/to/test-file.test.ts
```

---

## Getting Help

- **Documentation:** See [docs/index.md](./index.md) for complete documentation map
- **Testing:** See [Testing Guide](./testing.md) for manual testing scenarios
- **API Reference:** See [API Reference](./api-reference.md) for complete API documentation
- **Known Issues:** See [Known Issues](./known-issues.md) for current limitations
- **GitHub Issues:** Report bugs or ask questions on GitHub

---

**Last Updated:** January 2025
**Next:** [Configuration](./configuration.md) - Learn about environment setup and config modules
