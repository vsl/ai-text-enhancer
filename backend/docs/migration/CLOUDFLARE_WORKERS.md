# Cloudflare Workers Migration Guide

This guide shows how to migrate the AI Text Enhancer Backend from Supabase Edge Functions to Cloudflare Workers.

**Estimated Time:** 6-10 hours

---

## Overview

### What Changes

- **Handler:** New `worker/index.ts` (~60 lines)
- **Deployment:** Wrangler CLI
- **Environment:** Cloudflare Dashboard or `wrangler secret`
- **Core Logic:** **NO CHANGES** ✅

### What Stays the Same

- All of `src/` directory (business logic)
- All tests
- Configuration files
- API contract

### Why Cloudflare Workers?

- **Ultra-low latency:** 0-10ms cold starts
- **Global edge network:** 200+ locations
- **Cost-effective:** Generous free tier
- **Simple deployment:** Single command

---

## Prerequisites

- Node.js 22 installed
- Cloudflare account (free tier OK)
- Project tests passing locally
- Wrangler CLI installed

---

## Step-by-Step Migration

### 1. Install Wrangler CLI

```bash
# Install globally
npm install -g wrangler

# Or use npx
npx wrangler --version

# Login to Cloudflare
wrangler login
```

### 2. Create Worker Configuration

Create `wrangler.toml`:

```toml
name = "ai-text-enhancer"
main = "worker/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build:worker"

[build.upload]
format = "modules"

# Environment variables (non-secret)
[vars]
LLM_TIMEOUT_MS = "30000"
MAX_BATCH_SIZE = "10"

# Secrets are set via CLI: wrangler secret put VARIABLE_NAME
```

---

### 3. Create Worker Handler

Create `worker/index.ts`:

```typescript
/**
 * Cloudflare Workers Handler for AI Text Enhancer Backend
 * 
 * Platform-specific adapter that:
 * 1. Handles fetch events
 * 2. Calls platform-agnostic core logic
 * 3. Returns Response
 */

import { loadConfig, validateConfig } from '../src/config/index.js';
import { BatchOrchestrator } from '../src/services/batch-orchestrator.js';
import { AuthMiddleware } from '../src/services/auth-middleware.js';
import { QuotaService } from '../src/services/quota-service.js';
import { AuthorizationService } from '../src/services/authorization-service.js';
import { 
  AuthenticationError, 
  AuthorizationError 
} from '../src/errors/auth-errors.js';
import { QuotaError } from '../src/errors/quota-errors.js';
import { LLMError } from '../src/errors/llm-errors.js';
import { OrchestrationError } from '../src/errors/orchestration-errors.js';

export interface Env {
  // Secrets (set via wrangler secret)
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  USER_SERVICE_URL: string;
  USER_SERVICE_API_KEY: string;
  
  // Environment variables (set in wrangler.toml)
  LM_STUDIO_BASE_URL?: string;
  LLM_TIMEOUT_MS?: string;
  MAX_BATCH_SIZE?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      // Set environment variables for core logic
      // (Cloudflare Workers use env object, core uses process.env)
      setupEnvironment(env);

      // Initialize services
      const config = loadConfig();
      validateConfig(config);

      const quotaService = new QuotaService(config.userService);
      const authzService = new AuthorizationService();
      const orchestrator = new BatchOrchestrator(
        config.llmProviders,
        quotaService,
        authzService,
        config.timeout
      );
      const authMiddleware = new AuthMiddleware(config);

      const url = new URL(request.url);

      // Route: GET /health
      if (request.method === 'GET' && url.pathname.endsWith('/health')) {
        return jsonResponse(
          { status: 'ok', service: 'ai-text-enhancer' },
          200,
          corsHeaders
        );
      }

      // Route: POST /
      if (request.method === 'POST') {
        // Parse request
        const body = await request.json();
        const headers = Object.fromEntries(request.headers.entries());

        // Authenticate
        const user = await authMiddleware.authenticate(headers);

        // Process batch
        const result = await orchestrator.processBatch(user, body);

        return jsonResponse(result, 200, corsHeaders);
      }

      // 404 Not Found
      return jsonResponse(
        { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
        404,
        corsHeaders
      );

    } catch (error) {
      return handleError(error, corsHeaders);
    }
  },
};

function setupEnvironment(env: Env): void {
  // Map Cloudflare env to process.env for core logic compatibility
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  process.env.USER_SERVICE_URL = env.USER_SERVICE_URL;
  process.env.USER_SERVICE_API_KEY = env.USER_SERVICE_API_KEY;
  process.env.LM_STUDIO_BASE_URL = env.LM_STUDIO_BASE_URL || '';
  process.env.LLM_TIMEOUT_MS = env.LLM_TIMEOUT_MS || '30000';
  process.env.MAX_BATCH_SIZE = env.MAX_BATCH_SIZE || '10';
}

function handleError(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error('[ERROR]', error);

  if (error instanceof AuthenticationError) {
    return jsonResponse(
      { error: { code: 'AUTHENTICATION_FAILED', message: error.message } },
      401,
      corsHeaders
    );
  }

  if (error instanceof AuthorizationError) {
    return jsonResponse(
      { error: { code: 'AUTHORIZATION_FAILED', message: error.message } },
      403,
      corsHeaders
    );
  }

  if (error instanceof QuotaError) {
    return jsonResponse(
      { error: { code: 'QUOTA_EXCEEDED', message: error.message } },
      429,
      corsHeaders
    );
  }

  if (error instanceof LLMError) {
    return jsonResponse(
      { error: { code: 'LLM_ERROR', message: error.message } },
      502,
      corsHeaders
    );
  }

  if (error instanceof OrchestrationError) {
    const status = error.code.includes('EXCEEDED') || error.code.includes('EMPTY') ? 400 : 500;
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      status,
      corsHeaders
    );
  }

  if (error instanceof SyntaxError) {
    return jsonResponse(
      { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } },
      400,
      corsHeaders
    );
  }

  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
    corsHeaders
  );
}

function jsonResponse(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
```

**Key differences from Supabase:**
- Uses Cloudflare Workers' `fetch` event handler
- `Env` interface for typed environment variables
- Maps `env` object to `process.env` for core compatibility
- No cold start initialization (Workers are stateless)

---

### 4. Update Build Configuration

Update `package.json`:

```json
{
  "scripts": {
    "build:worker": "esbuild worker/index.ts --bundle --format=esm --outfile=dist/index.js --external:node:*",
    "dev:worker": "wrangler dev",
    "deploy:worker": "wrangler deploy",
    "tail:worker": "wrangler tail"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "esbuild": "^0.19.11"
  }
}
```

Create `tsconfig.worker.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "module": "ES2022",
    "target": "ES2022",
    "lib": ["ES2022"]
  },
  "include": [
    "worker/**/*",
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "tests",
    "supabase",
    "lambda"
  ]
}
```

---

### 5. Set Up Secrets

```bash
# Set secrets via Wrangler CLI
wrangler secret put GEMINI_API_KEY
# Paste your key when prompted

wrangler secret put OPENROUTER_API_KEY
wrangler secret put USER_SERVICE_URL
wrangler secret put USER_SERVICE_API_KEY

# List secrets (values are masked)
wrangler secret list
```

---

### 6. Test Locally

```bash
# Start local development server
npm run dev:worker

# Worker available at: http://localhost:8787

# Test health endpoint
curl http://localhost:8787/health

# Test enhancement
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token" \
  -d '{"assistants":[...]}'
```

---

### 7. Deploy to Cloudflare

```bash
# Build and deploy
npm run deploy:worker

# Output will show worker URL:
# https://ai-text-enhancer.YOUR_SUBDOMAIN.workers.dev
```

---

### 8. Verify Deployment

```bash
# Get worker URL from deployment output
WORKER_URL="https://ai-text-enhancer.YOUR_SUBDOMAIN.workers.dev"

# Test health
curl "$WORKER_URL/health"

# Test enhancement
curl -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"assistants":[...]}'
```

---

## Environment Variables

| Variable | Type | Set Via | Notes |
|----------|------|---------|-------|
| `GEMINI_API_KEY` | Secret | `wrangler secret` | Required |
| `OPENROUTER_API_KEY` | Secret | `wrangler secret` | Required |
| `USER_SERVICE_URL` | Secret | `wrangler secret` | Required |
| `USER_SERVICE_API_KEY` | Secret | `wrangler secret` | Required |
| `LM_STUDIO_BASE_URL` | Variable | `wrangler.toml` | Optional |
| `LLM_TIMEOUT_MS` | Variable | `wrangler.toml` | Default: 30000 |
| `MAX_BATCH_SIZE` | Variable | `wrangler.toml` | Default: 10 |

---

## Monitoring

### View Logs (Live)

```bash
# Tail logs in real-time
npm run tail:worker
```

### Cloudflare Dashboard

Visit: `https://dash.cloudflare.com/workers`

Metrics available:
- Requests per second
- Success rate
- CPU time
- Errors

### Analytics API

```bash
# Get analytics via GraphQL API
wrangler analytics
```

---

## Custom Domain

### Add Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. Click "Add Custom Domain"
5. Enter your domain (must be on Cloudflare)

Or via CLI:

```bash
wrangler route add "api.yourdomain.com/*" ai-text-enhancer
```

---

## Cost Estimate

### Free Tier
- **Requests:** 100,000/day
- **Duration:** 10ms CPU time per request
- **Bundled:** Unlimited bandwidth

### Paid Plan ($5/month)
- **Requests:** 10 million included, then $0.50 per additional million
- **Duration:** 50ms CPU time per request
- **No bandwidth charges**

**Example:** 10M requests/month = $5/month (vs $35 on AWS Lambda)

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Cold start | 0-10ms |
| Warm response | 0-5ms |
| Global latency | ~50ms (P95) |
| CPU limit | 10ms (free), 50ms (paid) |
| Memory limit | 128MB |
| Request timeout | 30 seconds (paid only) |

**Note:** Free tier has 10ms CPU limit. Upgrade to Workers Paid ($5/month) for 50ms CPU time and 30s timeout.

---

## Limitations & Considerations

### CPU Time Limit

Workers measure **CPU time**, not wall time:
- Network requests don't count toward CPU time
- LLM API calls are mostly I/O (good!)
- JSON parsing/serialization counts (minimal)

**Recommendation:** Paid plan for 50ms CPU time

### Memory Limit

128MB memory limit:
- Core logic uses ~20-30MB
- Should be fine for most use cases
- Monitor with `performance.memory` if needed

### No File System

Workers don't have file system access:
- All config must be in code or environment
- No local caching
- Use KV or D1 for persistence if needed

---

## Troubleshooting

### CPU Time Exceeded

**Error:** Script exceeded CPU limit

**Solution:**
- Upgrade to Workers Paid ($5/month)
- Optimize CPU-heavy operations
- Use async/await properly (network I/O doesn't count)

### Module Import Errors

**Error:** Cannot find module

**Solution:**
- Check esbuild bundling
- Verify import paths use `.js` extensions
- Update `wrangler.toml` build command

### Environment Variables Not Working

**Error:** `undefined` environment variable

**Solution:**
- Secrets: Use `wrangler secret put`
- Variables: Add to `wrangler.toml` `[vars]` section
- Verify `setupEnvironment()` maps correctly

---

## Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rollback due to issues"
```

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - "!backend/**/*.md"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          
      - run: npm ci
      - run: npm test
      - run: npm run type-check
      - run: npm run lint:portability
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Required GitHub Secret:**
- `CLOUDFLARE_API_TOKEN`: Create at https://dash.cloudflare.com/profile/api-tokens

---

## Cleanup

```bash
# Delete worker
wrangler delete

# Or in dashboard:
# https://dash.cloudflare.com/workers → Select worker → Delete
```

---

## Next Steps

1. **Custom domain:** Add `api.yourdomain.com`
2. **Monitoring:** Set up alerts in Cloudflare Dashboard
3. **Load testing:** Test with production traffic
4. **Caching:** Consider Cloudflare Cache API for repeated requests

---

**Migration complete!** Your backend now runs on Cloudflare Workers with ultra-low latency. 🚀
