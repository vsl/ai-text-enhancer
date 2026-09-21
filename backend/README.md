# AI Text Enhancer Backend

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/--typescript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/--supabase-3ECF8E?logo=supabase&logoColor=ffffff)](https://supabase.com/)

> **📚 Complete Documentation:** For comprehensive project documentation, setup guides, API reference, and architecture details, see **[docs/index.md](./docs/index.md)**.

A sophisticated **serverless backend** for AI-powered text enhancement, designed as a **Supabase Edge Function** with complete **platform portability**. This is not a simple LLM proxy—it's an intelligent engine that abstracts prompt engineering complexity, routes requests to multiple LLM providers, and returns enhanced text variations.

**Core Philosophy:** Platform-agnostic architecture enables easy migration to AWS Lambda, Cloudflare Workers, or other serverless platforms (estimated 4-8 hours for experienced developers).

---

## 🎯 What Makes This Different

- **Intelligent Prompt Engineering:** Translates simple user goals ("fix typos", "make professional") into effective, structured prompts
- **Multi-Provider Support:** Production models on Google Gemini and OpenRouter; LM Studio connector retained for direct local tests
- **Batch Processing:** Single API endpoint processes up to 10 enhancement tasks in parallel
- **Tiered Access:** Model access controlled by user subscription tier (Free/Plus/Premium)
- **Quota Management:** Pre-flight quota checks and post-flight token deduction via external user service
- **Platform Portable:** Core business logic works on any serverless platform—only the handler needs rewriting
- **Type-Safe:** Strict TypeScript with dependency-free runtime validation
- **Production Ready:** Comprehensive error handling, timeouts, structured responses

---

## 🏗️ Architecture Overview

### Two-Layer Design

```
┌─────────────────────────────────────────────────┐
│         HANDLER LAYER (~50-100 lines)           │
│      Platform-Specific (Deno/Lambda/etc)        │
│  - Extract request data                         │
│  - Call core logic                              │
│  - Format response                              │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         CORE LOGIC LAYER (Platform-Free)        │
│     All Business Logic in Standard TypeScript   │
│  - Authentication & Authorization               │
│  - Runtime Request Validation                   │
│  - Batch Orchestration                          │
│  - Prompt Engineering                           │
│  - LLM Provider Routing                         │
│  - Token Management                             │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   User Service  LLM APIs  External APIs
```

**Key Benefit:** Only the thin handler needs rewriting when migrating platforms. Core logic (`src/`) remains unchanged.

---

## ✨ Core Features

- **🎨 Dynamic Prompt Engineering** - Intelligent prompt construction from high-level goals
- **🔌 Multi-Provider LLM Integration** - Abstracted connectors for flexibility
- **⚡ Parallel Batch Processing** - Up to 10 tasks processed concurrently
- **🔐 Supabase Authentication** - JWT token validation with database-backed user profiles
- **💰 Token Quota Management** - Pre-flight quota checks and atomic database-backed token deduction
- **📊 Structured Validation** - Dependency-free request validation and enforced `{ "text": string }` output
- **⏱️ Timeout Control** - 30-second timeout per LLM call with AbortController
- **🎯 Tier-Based Access** - Three-tier system (Free, Plus, Premium) with model access control
- **🧪 Dual Testing Strategy** - Jest (core logic) + E2E (full function)
- **🚀 Zero Build Step** - Deno runs TypeScript natively

---

## 🛠️ Technology Stack

| Category | Technology | Why |
|----------|-----------|-----|
| **Runtime** | Deno (current), Node.js 22 compatible | Platform portability |
| **Platform** | Supabase Edge Functions | Serverless, global edge network |
| **Language** | TypeScript (strict mode) | Type safety, better DX |
| **HTTP Client** | Native `fetch` + timeout wrapper | Universal compatibility |
| **Validation** | TypeScript + standard JavaScript | Dependency-free trust-boundary validation |
| **LLM APIs** | Native `fetch` REST connectors | Portable multi-provider support |
| **Testing** | Jest (core), Supabase CLI (E2E) | Validates portability |
| **Config** | TypeScript modules + env vars | Type-safe, portable |

**No Web Framework** - Direct Request/Response handling for maximum portability

---

## 🔐 Authentication & Authorization

### Overview

The backend uses **Supabase Auth** for authentication with database-backed user profiles and quota management:

- **JWT Authentication** - Supabase-issued JWT tokens validated on each request
- **User Profiles** - Database-backed user profiles with tier information (Free, Plus, Premium)
- **Token Quotas** - Per-user token balances tracked in database with atomic operations
- **Admin API** - Dedicated admin endpoints for user/quota management
- **Bootstrap System** - Automated creation of test users for development

### User Tiers

| Tier | Max Text Length | Max Context | Max Batch Size | Token Balance |
|------|----------------|-------------|----------------|---------------|
| **Free** | 500 chars | 800 chars | 5 assistants | Varies |
| **Plus** | 2000 chars | 3000 chars | 10 assistants | Varies |
| **Premium** | 10000 chars | 15000 chars | 10 assistants | Varies |

### Test Users (Development)

The bootstrap system creates 6 predefined users for development and testing:

| Email | Password | Tier | Admin | Tokens | Status |
|-------|----------|------|-------|--------|--------|
| admin@textenhancer.dev | Admin_2025_Secure! | Premium | Yes | 10M | Active |
| free@textenhancer.dev | Free_User_2025 | Free | No | 50K | Active |
| plus@textenhancer.dev | Plus_User_2025 | Plus | No | 500K | Active |
| premium@textenhancer.dev | Premium_User_2025 | Premium | No | 5M | Active |
| zero@textenhancer.dev | Zero_Tokens_2025 | Free | No | 0 | Active |
| blocked@textenhancer.dev | Blocked_User_2025 | Free | No | 10K | Blocked |

### Bootstrap Endpoint

Create test users with:

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: your-bootstrap-secret"
```

See [Testing](./docs/testing.md) for detailed testing instructions.

### Admin API

Dedicated admin endpoints for user management:

- `GET /admin/users` - List all users (paginated)
- `GET /admin/users/:userId` - Get user details with purchase history
- `POST /admin/users/:userId/tokens` - Add/subtract tokens from user account
- `PUT /admin/users/:userId/tier` - Change user tier (free/plus/premium)
- `PUT /admin/users/:userId/status` - Block/unblock user account

All admin endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User with `is_admin = true` in database

See the [Deployment Guide](./docs/DEPLOYMENT.md) for production setup.

---

## 📚 Documentation

### Quick Start
- **[Getting Started](./docs/getting-started.md)** - Developer commands and setup
- **[Documentation Index](./docs/index.md)** - Documentation overview

### Core Documentation
- **[Architecture](./docs/architecture.md)** - System architecture and design
- **[API Reference](./docs/api-reference.md)** - API schemas and examples

### Implementation & Maintenance
- **[Developer Guides](./docs/developer-guides.md)** - Coding patterns and best practices
- **[Known Issues](./docs/known-issues.md)** - Known limitations and TODOs

### Complete Documentation Index
- **[docs/index.md](./docs/index.md)** - Full documentation structure and navigation guide

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v22
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- API keys for LLM providers (Gemini, OpenRouter)
- Supabase account and project (for deployment)

### Installation

```bash
# Clone the repository
git clone git@github-personal:vsl/ai-text-enhancer.git
cd ai-text-enhancer/backend

# Install dependencies (for tests and development)
npm install

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Set up local environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

### Required Environment Variables

```bash
# Supabase Configuration (Required)
SUPABASE_URL=http://127.0.0.1:54321              # Local dev (from: supabase status)
                                                  # Production: Auto-provided by Edge Functions

APP_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# Where: Dashboard → Settings → API → service_role key
# Purpose: Runtime database operations (bypasses RLS)

APP_SUPABASE_JWT_SECRET=your_jwt_secret
# Where: Dashboard → Settings → API → JWT Settings
# Or: supabase status -o json | grep JWT_SECRET
# Purpose: JWT token verification and signing

SUPABASE_ACCESS_TOKEN=your_personal_access_token
# Where: https://supabase.com/dashboard/account/tokens → Generate new token
# Purpose: CLI authentication for CI/CD deployments (GitHub Actions)
# Note: Only needed for automated deployments, not for local development

BOOTSTRAP_SECRET_KEY=your_bootstrap_secret
# Purpose: Protects /admin/bootstrap endpoint for creating test users

# LLM Providers
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional: Local Development
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Configuration (Optional)
LLM_TIMEOUT_MS=30000  # Default: 30 seconds
MAX_BATCH_SIZE=10     # Default: 10
```

### Getting Supabase Credentials

**Local Development:**
```bash
supabase status  # Get URL, JWT_SECRET, and SERVICE_ROLE_KEY
```

**Production/CI/CD:**
- **Service Role Key & JWT Secret:** Dashboard → Settings → API
- **Access Token (for CI/CD):** Visit https://supabase.com/dashboard/account/tokens and generate a new token

See `.env.local.example` for detailed variable descriptions.

### Local Development

```bash
# Start Supabase local stack (includes database, auth, Edge Functions)
supabase start

# Bootstrap test users (one-time setup)
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: your-bootstrap-secret"

# Serve the Edge Function with hot reload
npm run dev

# Function available at: http://localhost:54321/functions/v1/enhance

# Test health endpoint
curl http://localhost:54321/functions/v1/enhance/health
```

### Login and Get JWT Token

```bash
# Login as a test user
curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}'

# Use the returned access_token in subsequent requests
```

### Testing

```bash
# Run all tests
npm test

# Watch mode for development
npm test:watch

# Generate coverage report
npm run test:coverage

# Type checking
npm run type-check

# Platform portability check
npm run lint:portability
```

### Deployment to Supabase

```bash
# Set environment variables in Supabase
npm run setup:env

# Deploy to Supabase
npm run deploy

# Check health
npm run health

# View logs
npm run logs
```

See **[Deployment Guide](./docs/DEPLOYMENT.md)** for detailed deployment instructions.

**Automated Deployment**: For CI/CD setup with GitHub Actions, see [GitHub Actions CI/CD](./docs/DEPLOYMENT.md#automated-deployment-with-github-actions) in the Deployment Guide.

---

## 📡 API Example

### Request

```bash
# First, get a JWT token by logging in (see Local Development section above)

curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "assistants": [
      {
        "id": "task-1",
        "model": "gemini-flash",
        "aiRoleId": "editor",
        "userText": "this is a test with some mistake",
        "contextText": "Professional email",
        "options": {
          "improve": true,
          "fixMistakes": true,
          "formality": "Formal"
        }
      }
    ]
  }'
```

### Response

```json
{
  "results": [
    {
      "id": "task-1",
      "status": "success",
      "enhancedText": "This is a well-crafted test without any errors.",
      "total_tokens": 45
    }
  ]
}
```

### Get User Profile and Quota

```bash
# Fetch current user's profile and token balance
curl -X GET http://localhost:54321/functions/v1/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "profile": {
    "tier": "free",
    "email": "user@example.com",
    "is_admin": false
  },
  "quota": {
    "tokens_available": 45000,
    "tokens_used": 5000
  }
}
```

See the **[API Reference](./docs/api-reference.md)** for complete API documentation.

---

## 🔄 Platform Migration

The two-layer architecture enables easy migration between serverless platforms.

### Supported Platforms

| Platform | Status | Migration Time | Guide |
|----------|--------|---------------|-------|
| **Supabase Edge Functions** | ✅ Current | - | [Deployment Guide](./docs/DEPLOYMENT.md) |
| **AWS Lambda** | 📋 Ready | 4-8 hours | [AWS Lambda Guide](./docs/migration/AWS_LAMBDA.md) |
| **Cloudflare Workers** | 📋 Ready | 6-10 hours | [Cloudflare Guide](./docs/migration/CLOUDFLARE_WORKERS.md) |
| **Vercel Edge** | 🔜 Planned | 4-6 hours | Coming soon |

### Why Migration is Easy

**What Changes:**
- Handler file (~50-100 lines) - Platform-specific request/response handling

**What Stays the Same:**
- All core business logic in `src/` (100% unchanged)
- All tests continue to work
- Configuration and types
- LLM connectors and services

**Example Migration Steps:**
1. Create new handler for target platform (~1-2 hours)
2. Update deployment configuration (~1 hour)
3. Test and deploy (~2-4 hours)
4. **Core logic changes:** ZERO ✅

See **[Migration Overview](./docs/migration/OVERVIEW.md)** for detailed migration guides.

---

---

## 🏗️ Project Structure

```
ai-text-enhancer-backend/
├── README.md                    # This file
├── spec/                        # All documentation
│   ├── README.md               # Documentation navigation guide
│   ├── CORE_GUIDE.md           # Complete system architecture (600+ lines)
│   ├── API_REFERENCE.md        # Full API specification (900+ lines)
│   ├── QUICK_CONTEXT.md        # Ultra-compact overview (350 lines)
│   ├── quick_reference.md      # Developer quick start
│   ├── implementation_guide.md # Coding patterns
│   ├── prompt_construction.md  # Prompt engineering
│   ├── technical_debt.md       # Known issues
│   ├── DOCUMENTATION_SYNC_SUMMARY.md
│   ├── DOCUMENTATION_SYNC_CHECKLIST.md
│   ├── CONSOLIDATION_PLAN.md
│   └── archive/                # Old documentation (historical)
├── supabase/
│   └── functions/
│       └── enhance/
│           ├── index.ts        # Handler entry (15 lines)
│           ├── handler.ts      # Handler logic (18 lines)
│           └── import_map.json # Deno dependencies
├── src/                        # Core logic (platform-agnostic)
│   ├── services/               # Business logic
│   ├── services/request-validator.ts # Runtime API validation
│   ├── config/                 # TypeScript config
│   ├── utils/                  # Utilities
│   └── types/                  # TypeScript types
└── tests/                      # Jest tests
    ├── unit/
    └── integration/
```

---

## 🎯 Design Principles

1. **Separation of Concerns** - Handler (thin, platform-specific) vs Core (thick, platform-agnostic)
2. **Standard APIs Only** - Use `fetch`, `process.env`, avoid platform-specific code
3. **No Framework Lock-in** - Direct Request/Response handling
4. **Type Safety** - Strict TypeScript with comprehensive types
5. **Test Independence** - Core logic fully testable without platform runtime
6. **Clear Boundaries** - Configuration, business logic, and platform adapter are separate

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

### Code Guidelines

- **Handler Layer:** Must stay under 100 lines, zero business logic
- **Core Logic:** No `Deno.*` APIs, no platform-specific imports
- **All HTTP Calls:** Use `fetchWithTimeout` utility
- **Configuration:** TypeScript files for app config, env vars for secrets
- **Testing:** Jest tests required for all new features

### Pre-Commit Checklist

```bash
# Check portability
grep -r "Deno\." src/ && echo "❌ FAIL" || echo "✅ OK"

# Check handler size
wc -l supabase/functions/enhance/index.ts  # Should be <100

# Run tests
npm test
```

---

## 📝 License

ISC License - See `package.json` for details.

---

## 🔗 Links

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
- [Google Gemini API](https://ai.google.dev/)
- [OpenRouter API](https://openrouter.ai/)

---

**Built with ❤️ for platform portability and developer experience.**

### 3. Running the Edge Function Locally

**No build step required!** Deno runs TypeScript natively.

1.  **Start the Supabase Stack:**
    In your terminal, start the local Supabase emulator. This runs the database, authentication, and other services.
    ```bash
    supabase start
    ```
    This will output local URLs and keys. Keep this running.

2.  **Serve the Function:**
    In a **separate terminal window**, serve your function with hot reload enabled:
    ```bash
    supabase functions serve enhance --env-file .env.local
    ```

    Your function will be available at `http://localhost:54321/functions/v1/enhance`. 
    
    You can find your local `anon` key (for the Bearer token) in the output of the `supabase start` command.

### Running Tests

This project uses a **dual testing approach** for maximum flexibility:

#### 1. Unit & Integration Tests (Jest)
Tests the core business logic independently of the Deno runtime. These tests will remain valid after migrating to other platforms.

```bash
npm test
```

#### 2. End-to-End Tests (Supabase Local)
Tests the full Edge Function with the Deno handler:

```bash
# Ensure supabase functions serve is running first
npm run test:e2e
```

### Local Development of Core Logic

For faster iteration on core business logic without the Supabase stack, you can test services directly:

```bash
# Run Jest in watch mode
npm test -- --watch

# Or test a specific file
npm test -- src/services/TextEnhancementService.test.ts
```

## API Documentation

The backend exposes a single primary endpoint for all operations.

### `POST /functions/v1/enhance`

This endpoint processes a batch of text enhancement requests.

-   **Authentication:** Requires a Bearer token in the `Authorization` header.
    -   `Authorization: Bearer <YOUR_SUPABASE_JWT_OR_MOCK_TOKEN>`

-   **Request Body:** A JSON object conforming to the `BatchRequest` schema. See `API_SPEC_FOR_UI.md` for details.

-   **cURL Example (Local Supabase)**

    Replace `<YOUR_LOCAL_ANON_KEY>` with the `anon key` from the `supabase start` output.

    ```bash
    curl -X POST http://localhost:54321/functions/v1/enhance \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer valid-token-12345" \
    -d @- <<'EOF'
    {
      "assistants": [
        {
          "id": "task_supabase_01",
          "model": "open-router-free",
          "aiRoleId": "editor",
          "userText": "this is a test for supabase.",
          "options": { "fixMistakes": true }
        }
      ]
    }
EOF
    ```
    
    Supabase Edge Functions:
    ```bash
    curl -L -X POST 'https://mupadxckjgpekkqyhohg.supabase.co/functions/v1/enhance' \
  -H 'Authorization: Bearer valid-token-12345' \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
    {
      "assistants": [
        {
          "id": "task_supabase_01",
          "model": "gemini-flash",
          "aiRoleId": "editor",
          "userText": "this is a test for supabase.",
          "options": { "fixMistakes": true }
        }
      ]
    }
EOF
```

-   **cURL Example (Local Express Debugging)**

    When testing core logic with Jest, use mock tokens:

    ```bash
    # Example test scenario with mock user service
    # See tests/api.test.ts for implementation details
    ```

> For a complete definition of schemas and error codes, see the
> **[API Reference](./docs/api-reference.md)**.

## Deployment to Supabase

For detailed instructions on deploying to a production Supabase project, see the **[Deployment Guide](./docs/DEPLOYMENT.md)**.

## License

This project is licensed under the ISC License. See the `package.json` file for details.
