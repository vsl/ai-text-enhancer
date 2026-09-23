# Configuration Guide

Complete guide to environment setup, configuration modules, and system configuration.

**Last Updated:** January 2025

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Environment Variables](#environment-variables)
3. [Configuration Modules](#configuration-modules)
4. [Getting Supabase Credentials](#getting-supabase-credentials)
5. [Configuration Examples](#configuration-examples)

---

## Quick Reference

### Environment Variables Table

| Variable | Required | Purpose | Example Value |
|----------|----------|---------|---------------|
| `SUPABASE_URL` | Yes | Supabase API URL | `http://127.0.0.1:54321` |
| `APP_SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (secret) | `eyJhbGc...` |
| `APP_SUPABASE_JWT_SECRET` | Yes | JWT signing secret | `super-secret-jwt-token...` |
| `BOOTSTRAP_SECRET_KEY` | Yes | Bootstrap endpoint protection | `local-dev-secret-123` |
| `GEMINI_API_KEY` | Yes | Google Gemini API key | `AIzaSy...` |
| `OPENROUTER_API_KEY` | No | OpenRouter API key | `sk-or-v1-...` |
| `LM_STUDIO_BASE_URL` | No | Local LM Studio URL | `http://localhost:1234` |
| `LLM_TIMEOUT_MS` | No | LLM request timeout | `30000` (default) |
| `MAX_BATCH_SIZE` | No | Max assistants per batch | `10` (default) |
| `LANGSMITH_TRACING` | No | Enable LangSmith tracing | `true` |
| `LANGSMITH_API_KEY` | With tracing | LangSmith API key | `lsv2_...` |
| `LANGSMITH_PROJECT` | With tracing | Trace project | `ai-text-enhancer-staging` |
| `LANGSMITH_ENDPOINT` | No | LangSmith US endpoint | `https://api.smith.langchain.com` |
| `APP_ENV` | No | Deployment environment | `staging` |
| `APP_RELEASE` | No | Git release SHA | `abc123...` |

### Quick Setup Commands

```bash
# 1. Copy example environment file
cp .env.local.example .env.local

# 2. Get Supabase credentials
supabase status

# 3. Get JWT secret
supabase status -o json | grep JWT_SECRET

# 4. Edit .env.local with your values
nano .env.local  # or use your preferred editor

# 5. Start Supabase
supabase start

# 6. Start development server
npm run dev
```

---

## Environment Variables

### Deep Dive

#### Supabase Configuration

**SUPABASE_URL**
- **Purpose:** Base URL for Supabase API
- **Local:** `http://127.0.0.1:54321` (from `supabase status`)
- **Production:** Auto-provided by Supabase Edge Functions environment
- **Required:** Yes
- **Where used:** `src/config/loader.ts`, Supabase client initialization

**APP_SUPABASE_SERVICE_ROLE_KEY**
- **Purpose:** Service role key for admin database operations
- **Security:** NEVER expose to clients, server-side only
- **Capabilities:** Bypasses Row Level Security (RLS), full database access
- **Local:** Get from `supabase status` (labeled as "service_role key")
- **Production:** Get from Supabase Dashboard → Settings → API
- **Required:** Yes
- **Where used:** `src/config/supabase.config.ts`, database repositories

**APP_SUPABASE_JWT_SECRET**
- **Purpose:** Secret used to sign and verify JWT tokens
- **Security:** NEVER expose to clients
- **Local:** Get from `supabase status -o json | grep JWT_SECRET`
- **Production:** Get from Supabase Dashboard → Settings → API
- **Required:** Yes
- **Where used:** `src/services/auth-service.ts` for JWT verification with `jose` library

**BOOTSTRAP_SECRET_KEY**
- **Purpose:** Protects `/admin/bootstrap` endpoint
- **Security:** Change in production to a secure random string
- **Used for:** Creating initial test users in development
- **Local:** Can be simple like `local-dev-secret-123`
- **Production:** Use a strong random string, store securely
- **Required:** Yes
- **Where used:** `supabase/functions/admin/handler.ts`

#### LLM Provider API Keys

**GEMINI_API_KEY**
- **Purpose:** Google Gemini API authentication
- **Get key:** [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Free tier:** Yes, with generous limits
- **Required:** Yes
- **Where used:** `src/connectors/llm-connectors/gemini-connector.ts`

**OPENROUTER_API_KEY**
- **Purpose:** OpenRouter API authentication (access to multiple models)
- **Get key:** [OpenRouter Keys](https://openrouter.ai/keys)
- **Free tier:** Some models are free
- **Required:** No (only if using OpenRouter models)
- **Where used:** `src/connectors/llm-connectors/openrouter-connector.ts`

#### Optional Configuration

**LM_STUDIO_BASE_URL**
- **Purpose:** Local LM Studio API endpoint for development
- **Default:** `http://localhost:1234`
- **Required:** No (only for local LLM testing)
- **Setup:** Download [LM Studio](https://lmstudio.ai/), start local server
- **Where used:** `src/connectors/llm-connectors/lmstudio-connector.ts`

**LLM_TIMEOUT_MS**
- **Purpose:** Timeout for LLM API requests in milliseconds
- **Default:** `30000` (30 seconds)
- **Range:** `5000` - `60000` recommended
- **Required:** No
- **Where used:** All LLM connectors use `AbortController` with this timeout

**MAX_BATCH_SIZE**
- **Purpose:** Maximum number of assistants per batch request
- **Default:** `10`
- **Range:** `1` - `20` (higher values increase processing time)
- **Required:** No
- **Where used:** `src/services/batch-orchestrator.ts` for validation

**LOG_LEVEL**
- **Purpose:** Set to `debug` to log complete OpenRouter request and response payloads with a correlation ID
- **Default:** Unset (payload logging disabled)
- **Required:** No
- **Security:** Debug logs contain user prompts, context, and generated text. Enable only while diagnosing an issue and never log the authorization header or API key.
- **Local:** Add `LOG_LEVEL=debug` to `.env.local`
- **Supabase Edge Functions:** Run `supabase secrets set LOG_LEVEL=debug`; set it to another value when finished

#### LangSmith tracing

Tracing is disabled locally unless `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are both set. CI enables 100% tracing for deployed Edge Functions and selects `ai-text-enhancer-staging` or `ai-text-enhancer-production`; `APP_RELEASE` is the deployed Git SHA. Keep `LANGSMITH_ENDPOINT=https://api.smith.langchain.com` for the US workspace.

Traces contain complete user source/context, assembled prompts, raw provider responses, and final output. Restrict workspace access accordingly, use the shortest operationally useful retention period, and never enable raw `LOG_LEVEL=debug` payload logging in normal staging or production operation.

Role prompt text remains versioned in Git. Increment that role's `systemPromptVersion` for a role prompt change. Increment the shared `PROMPT_VERSION` for shared policy or transformation instruction changes. LangSmith stores the resulting composite revision and SHA-256 prompt fingerprint; it is not a prompt registry.

---

## Configuration Modules

All configuration is defined in TypeScript modules under `src/config/` for type safety and validation.

### Overview

- **models.config.ts** - Available LLM models
- **roles.config.ts** - AI assistant roles (12 roles)
- **quota.config.ts** - Token quota limits per tier
- **tier-limits.config.ts** - Input validation limits per tier
- **loader.ts** - Loads and validates environment variables
- **validator.ts** - Validates configuration consistency
- **supabase.config.ts** - Supabase client initialization

### models.config.ts

Defines available LLM models with their properties.

**Structure:**
```typescript
export const MODELS: ModelConfig[] = [
  {
    id: 'gemini-flash',              // Internal model ID
    provider: 'gemini',              // Maps to connector
    providerModelId: 'gemini-2.5-flash', // Actual API model name
    allowedTiers: ['free', 'plus', 'premium'], // Array of tiers
    displayName: 'Gemini 2.5 Flash',
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.00, output: 0.00 }
  }
  // ... more models
];
```

**Current Models:**
1. **gemini-flash** - Google Gemini 2.5 Flash (free/plus/premium)
2. **open-router-free** - OpenRouter free models (free/plus/premium)
3. **lm-studio-local** - Local LM Studio (development only)

**Adding a New Model:**
```typescript
// 1. Add to models.config.ts
{
  id: 'gpt-4-turbo',
  provider: 'openai',
  providerModelId: 'gpt-4-turbo-preview',
  allowedTiers: ['premium'],
  displayName: 'GPT-4 Turbo',
  contextWindow: 128000,
  costPer1kTokens: { input: 0.01, output: 0.03 }
}

// 2. Create connector in src/connectors/llm-connectors/openai-connector.ts
// 3. Update LLMConnectorFactory to include new connector
// 4. Run: npm run type-check
```

### roles.config.ts

Defines AI assistant roles with system prompts.

**Structure:**
```typescript
export const ROLES: RoleConfig[] = [
  {
    id: 'editor',
    name: 'Editor',
    systemPrompt: 'You are a professional text editor...',
    allowedModels: ['gemini-flash', 'open-router-free']
  }
  // ... more roles
];
```

**Current Roles (12 total):**
1. **editor** - Professional text editor
2. **translator** - Multi-language translator
3. **writer** - Creative content writer
4. **businesswriter** - Business communication
5. **poet** - Poetry and creative writing
6. **academicwriter** - Academic writing
7. **technicalwriter** - Technical documentation
8. **copywriter** - Marketing copy
9. **scriptwriter** - Screenplays and scripts
10. **journalist** - News and journalism
11. **blogger** - Blog post writing
12. **socialmedia** - Social media content

**Adding a New Role:**
```typescript
// Add to roles.config.ts
{
  id: 'legal-writer',
  name: 'Legal Writer',
  systemPrompt: 'You are an expert legal writer specialized in drafting legal documents...',
  allowedModels: ['gemini-flash', 'open-router-free']
}

// Run: npm run type-check
```

### quota.config.ts

Token quota limits per user tier.

**Structure:**
```typescript
export const QUOTA_LIMITS: Record<UserTier, number> = {
  free: 100_000,      // 100k tokens
  plus: 1_000_000,    // 1M tokens
  premium: 10_000_000 // 10M tokens
};
```

**Usage:**
- Pre-flight estimation before processing
- Displayed to users in UI
- Enforced by QuotaMiddleware

**Changing Limits:**
```typescript
// Edit quota.config.ts
export const QUOTA_LIMITS: Record<UserTier, number> = {
  free: 50_000,       // Reduced to 50k
  plus: 500_000,      // Reduced to 500k
  premium: 5_000_000  // Reduced to 5M
};

// No deployment required - config loaded at startup
```

### tier-limits.config.ts

Input validation limits per tier.

**Structure:**
```typescript
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    maxUserTextLength: 500,
    maxContextTextLength: 800,
    maxBatchSize: 5
  },
  plus: {
    maxUserTextLength: 2000,
    maxContextTextLength: 3000,
    maxBatchSize: 10
  },
  premium: {
    maxUserTextLength: 10000,
    maxContextTextLength: 15000,
    maxBatchSize: 10
  }
};
```

**Usage:**
- Validated in BatchOrchestrator before processing
- Enforces tier-based input restrictions
- Throws `TierLimitExceededError` if exceeded

### loader.ts

Loads and validates environment variables at startup.

**Key Functions:**

**`getEnvVar(name: string, required: boolean = true): string | undefined`**
- Helper to read environment variables
- Throws error if required variable is missing
- Returns undefined for optional variables

**`loadConfig(): AppConfig`**
- Main function that loads all configuration
- Combines environment variables with config modules
- Validates configuration using validator.ts
- Throws errors on invalid configuration

**Usage:**
```typescript
import { loadConfig } from '../config/loader.js';

// In handler or service initialization
const config = loadConfig();
console.log(config.system.llmTimeoutMs); // 30000
console.log(config.models[0].displayName); // "Gemini 2.5 Flash"
```

---

## Getting Supabase Credentials

### Local Development

**Step 1: Start Supabase**
```bash
supabase start
```

**Step 2: Get All Credentials**
```bash
supabase status
```

Example output:
```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGc... (this is the publishable key)
service_role key: eyJhbGc... (this is the secret key)
```

**Step 3: Extract JWT Secret**
```bash
supabase status -o json | jq -r '.JWT_SECRET'
```

**Step 4: Map to Environment Variables**

| `supabase status` | `.env.local` Variable | Notes |
|---|---|---|
| API URL | `SUPABASE_URL` | Use as-is |
| service_role key | `APP_SUPABASE_SERVICE_ROLE_KEY` | Secret key |
| JWT secret | `APP_SUPABASE_JWT_SECRET` | From JSON output |

### Production (Supabase Cloud)

**Step 1: Open Supabase Dashboard**
- Go to the [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project

**Step 2: Navigate to API Settings**
- Settings → API

**Step 3: Copy Credentials**
- **Project URL** → Copy to `SUPABASE_URL`
- **Project API keys** → `service_role` (secret) → Copy to `APP_SUPABASE_SERVICE_ROLE_KEY`
- **JWT Secret** → Reveal → Copy to `APP_SUPABASE_JWT_SECRET`

**Step 4: Set in Supabase Edge Functions**

Use Supabase CLI:
```bash
supabase secrets set APP_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set APP_SUPABASE_JWT_SECRET="your-jwt-secret"
supabase secrets set BOOTSTRAP_SECRET_KEY="your-bootstrap-secret"
supabase secrets set GEMINI_API_KEY="your-gemini-key"
supabase secrets set OPENROUTER_API_KEY="your-openrouter-key"
```

Or use `npm run setup:env` script which reads from `.env.local`.

---

## Configuration Examples

### Minimal Configuration (.env.local)

```bash
# Required only
SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
APP_SUPABASE_JWT_SECRET=super-secret-jwt-token...
BOOTSTRAP_SECRET_KEY=local-dev-secret-123
GEMINI_API_KEY=AIzaSy...
```

### Full Configuration (.env.local)

```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
APP_SUPABASE_JWT_SECRET=super-secret-jwt-token...
BOOTSTRAP_SECRET_KEY=local-dev-secret-123

# LLM Providers
GEMINI_API_KEY=AIzaSy...
OPENROUTER_API_KEY=sk-or-v1-...
LM_STUDIO_BASE_URL=http://localhost:1234

# Optional Overrides
LLM_TIMEOUT_MS=30000
MAX_BATCH_SIZE=10
```

### Production Configuration

```bash
# Supabase (from dashboard)
SUPABASE_URL=https://your-project.supabase.co
APP_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
APP_SUPABASE_JWT_SECRET=your-production-jwt-secret
BOOTSTRAP_SECRET_KEY=your-strong-random-secret-here

# LLM Providers
GEMINI_API_KEY=your-production-gemini-key
OPENROUTER_API_KEY=your-production-openrouter-key

# Production Overrides
LLM_TIMEOUT_MS=45000
MAX_BATCH_SIZE=15
```

---

## Next Steps

- **Testing:** See [Testing Guide](./testing.md) for test user setup
- **Deployment:** See [Deployment Guide](./deployment.md) for production setup
- **Adding Features:** See [Developer Guides](./developer-guides.md) for how to add models/roles
- **Architecture:** See [Architecture](./architecture.md) for system design

---

**Last Updated:** January 2025
**Maintained By:** Development Team
