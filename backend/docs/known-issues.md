# Known Issues & Technical Debt

**Last Updated:** January 2025

Current limitations, technical debt, and planned improvements for the AI Text Enhancer Backend.

---

## Table of Contents

1. [Overview](#overview)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Low Priority Issues](#low-priority-issues)
5. [Known Workarounds](#known-workarounds)
6. [Future Improvements](#future-improvements)

---

## Overview

This document tracks known limitations and technical debt in the codebase. All items are documented with:
- **Impact:** How it affects users or development
- **Workaround:** Temporary solutions (if available)
- **Action Required:** Steps to resolve the issue
- **Estimated Effort:** Time required to fix

---

## High Priority Issues

### 1. Gemini Token Counting

**Location:** `src/connectors/llm-connectors/gemini-connector.ts`

**Issue:** Token counting is hardcoded to 0 for Gemini API calls.

**Impact:**
- Inaccurate quota deduction for Gemini users
- Users may consume more/less tokens than tracked
- Billing discrepancies

**Root Cause:** The Gemini API may not provide token usage details in the standard response, or the SDK doesn't expose it.

**Workaround:** Current estimation uses character count (4 chars ≈ 1 token) for pre-flight checks.

**Action Required:**

```typescript
// TODO in gemini-connector.ts
// 1. Investigate @google/genai SDK for token usage APIs
// 2. Check if Gemini API response includes usageMetadata
// 3. If not available, implement client-side token estimation
//    - Use tiktoken-compatible library
//    - Apply to prompt + response for accurate counting
// 4. Update connector to return actual token count
```

**Estimated Effort:** 4-6 hours

---

### 2. Pre-Flight Token Estimation Accuracy

**Location:** `src/services/quota-service.ts`

**Issue:** Token estimation is rough approximation (4 chars ≈ 1 token + 500 overhead).

**Impact:**
- Pre-flight checks may reject valid requests
- May allow requests that exceed quota
- User experience inconsistency

**Formula:**
```typescript
const estimated = Math.ceil(text.length / 4) + 500;
```

**Workaround:** Conservative overhead (500 tokens) minimizes false negatives.

**Action Required:**

```typescript
// 1. Implement proper tokenizer (tiktoken or equivalent)
// 2. Account for:
//    - System prompts (role-based)
//    - User prompts (options-based)
//    - Context text
//    - Expected response length
// 3. Make estimation provider-specific:
//    - Gemini uses different tokenization than GPT
// 4. Add buffer (10-20%) for safety
```

**Estimated Effort:** 8-12 hours

---

### 3. No Retry Logic for Quota Deduction

**Location:** `src/services/batch-orchestrator.ts`

**Issue:** Post-flight token deduction uses fire-and-forget pattern with no retry on failure.

**Impact:**
- Failed deductions = users get free tokens
- No automatic reconciliation
- Billing inaccuracies

**Current Code:**

```typescript
try {
  await this.quotaService.deductTokens(user.userId, totalTokensUsed);
} catch (error) {
  // Log but don't fail - user already got results
  console.error('Failed to deduct tokens:', error);
}
```

**Workaround:** Manual reconciliation via database queries and admin tools.

**Action Required:**

```typescript
// Option 1: Retry with exponential backoff
// 1. Implement retry wrapper (3 attempts, exponential backoff)
// 2. On all failures, log to dead-letter queue
// 3. Background job processes dead-letter queue
// 4. Alert admins on repeated failures

// Option 2: Queue-based approach
// 1. Write deduction to queue (guaranteed delivery)
// 2. Background worker processes queue
// 3. Retry on failure with exponential backoff
// 4. Dead-letter queue for permanent failures
```

**Estimated Effort:** 16-24 hours (including queue infrastructure)

---

### 4. Platform Portability Validation

**Location:** CI/CD pipeline

**Issue:** No automated check to prevent Deno-specific code in `src/` directory.

**Impact:**
- Risk of breaking platform portability
- Manual code review required
- Migration difficulties

**Current Check:** Manual grep command

```bash
grep -r "Deno\." src/ && echo "ERROR: Deno code in src/"
```

**Workaround:** Developers run `npm run lint:portability` before commits.

**Action Required:**

```json
// 1. Add to package.json scripts
{
  "scripts": {
    "lint:portability": "node scripts/check-portability.js",
    "pretest": "npm run lint:portability"
  }
}

// 2. Create scripts/check-portability.js
// - Check for Deno.* in src/
// - Check for https://deno.land imports
// - Check handler size (<100 lines)
// - Exit with error code if violations found

// 3. Add to CI/CD pipeline (.github/workflows/deploy.yml)
// - Run before tests
// - Fail build on violations
```

**Estimated Effort:** 2-4 hours

---

## Medium Priority Issues

### 5. Missing E2E Tests

**Location:** `tests/e2e/` (doesn't exist)

**Issue:** No automated end-to-end tests for full Edge Function flow.

**Impact:**
- Regressions may go undetected
- Manual testing required for deployments
- Slower development cycle

**Workaround:** Manual testing with curl commands (see TESTING_GUIDE.md).

**Action Required:**

```typescript
// 1. Create tests/e2e/ directory
// 2. Set up test environment:
//    - Start local Supabase
//    - Bootstrap test users
//    - Get JWT tokens
// 3. Write E2E test suite:
//    - Authentication flow
//    - Enhancement requests
//    - Quota management
//    - Error scenarios
//    - Admin operations
// 4. Add npm script: "test:e2e"
// 5. Integrate into CI/CD (optional for local tests)
```

**Example Test:**

```typescript
// tests/e2e/enhance.test.ts
describe('Enhancement Endpoint E2E', () => {
  let authToken: string;

  beforeAll(async () => {
    // Login and get token
    authToken = await loginTestUser('free@textenhancer.dev');
  });

  it('should enhance text successfully', async () => {
    const response = await fetch('http://localhost:54321/functions/v1/enhance', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistants: [{
          id: 'test-1',
          model: 'gemini-flash',
          aiRoleId: 'editor',
          userText: 'test message',
          options: { improve: true }
        }]
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results[0].status).toBe('success');
  });
});
```

**Estimated Effort:** 12-16 hours

---

### 6. Structured Logging

**Location:** Throughout codebase

**Issue:** Current logging uses `console.log` without structure.

**Impact:**
- Difficult to parse logs in production
- No context or correlation IDs
- Limited observability

**Current Logging:**

```typescript
console.log('Processing batch for user:', userId);
console.error('Failed to deduct tokens:', error);
```

**Workaround:** Grep logs manually in Supabase dashboard.

**Action Required:**

```typescript
// 1. Create src/utils/logger.ts
interface LogContext {
  requestId?: string;
  userId?: string;
  taskId?: string;
  [key: string]: any;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...context
    }));
  },

  error: (message: string, error?: Error, context?: LogContext) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error?.message,
      stack: error?.stack,
      ...context
    }));
  }
};

// 2. Replace all console.log/error calls with logger
// 3. Add requestId to all logs (generate UUID per request)
// 4. Include userId, taskId where applicable
```

**Estimated Effort:** 6-8 hours

---

### 7. Environment Variable Validation

**Location:** `src/config/loader.ts`

**Issue:** Minimal validation for environment variables at startup.

**Impact:**
- Runtime errors if variables are missing
- Difficult to diagnose configuration issues
- Poor developer experience

**Current Validation:** Basic checks for presence

```typescript
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY not found');
```

**Workaround:** Manual verification with `.env.local.example`.

**Action Required:**

```typescript
// 1. Create src/utils/env-validator.ts
export function validateRequiredEnvVars() {
  const required = [
    'APP_SUPABASE_SERVICE_ROLE_KEY',
    'APP_SUPABASE_JWT_SECRET',
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'BOOTSTRAP_SECRET_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}`
    );
  }
}

// 2. Add validation types
export function validateEnvFormat() {
  // Check JWT_SECRET length (min 32 chars)
  // Check API keys format
  // Check URLs are valid
  // Check numeric values are numbers
}

// 3. Call at startup (before loading config)
validateRequiredEnvVars();
validateEnvFormat();
```

**Estimated Effort:** 4-6 hours

---

### 8. Rate Limiting

**Location:** Not implemented

**Issue:** No rate limiting on API endpoints.

**Impact:**
- Abuse potential (unlimited requests)
- Cost concerns for LLM API calls
- No protection against DDoS

**Workaround:** Token quotas provide some protection (limits total usage, not request rate).

**Action Required:**

```typescript
// Option 1: Platform-level (Supabase)
// - Configure rate limits in config.toml
// - Tier-based limits

// Option 2: Application-level
// 1. Create src/middleware/rate-limiter.ts
// 2. Use Upstash Redis for distributed rate limiting
// 3. Implement sliding window algorithm
// 4. Limits per tier:
//    - Free: 100 requests/minute
//    - Plus: 500 requests/minute
//    - Premium: 2000 requests/minute
// 5. Return 429 with Retry-After header

// 3. Add to handler
import { RateLimiter } from './middleware/rate-limiter.ts';

const rateLimiter = new RateLimiter(redisClient);
await rateLimiter.checkLimit(user.userId, user.tier);
```

**Estimated Effort:** 8-12 hours (with Redis infrastructure)

---

## Low Priority Issues

### 9. Response Caching

**Issue:** No caching for frequently requested enhancements.

**Impact:**
- Repeated API calls for identical requests
- Increased LLM costs
- Slower response times

**Workaround:** None (all requests hit LLM providers).

**Action Required:**

```typescript
// 1. Create cache key from request hash
// 2. Cache successful responses in Redis
// 3. TTL-based expiration (1-24 hours)
// 4. Cache invalidation strategy:
//    - Manual invalidation endpoint
//    - Version-based cache keys
// 5. Monitor cache hit rate

// Example
const cacheKey = generateCacheKey(assistantConfig);
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await llmConnector.generateEnhancement(/* ... */);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

**Estimated Effort:** 12-16 hours (including cache infrastructure)

---

### 10. Error Tracking Integration

**Issue:** No error tracking/monitoring integration (Sentry, etc.).

**Impact:**
- Errors only visible in logs
- No alerting for critical failures
- Difficult to track error trends

**Workaround:** Manual log review in Supabase dashboard.

**Action Required:**

```typescript
// 1. Add optional Sentry integration
// 2. Create src/utils/error-tracking.ts
export function initErrorTracking() {
  if (process.env.SENTRY_DSN) {
    // Initialize Sentry
    // Must work in both Deno and Node.js
  }
}

// 3. Capture errors in handlers
try {
  // ...
} catch (error) {
  captureError(error, { userId, requestId });
  throw error;
}

// 4. Respect privacy - don't log sensitive data
// 5. Environment variable: SENTRY_DSN (optional)
```

**Estimated Effort:** 6-8 hours

---

### 11. Input Sanitization

**Issue:** No explicit input sanitization for prompt injection attacks.

**Impact:**
- Potential prompt injection vulnerabilities
- Malicious prompts could bypass role constraints
- Security risk

**Workaround:** LLM providers have some built-in protections.

**Action Required:**

```typescript
// 1. Create src/utils/sanitizer.ts
export function sanitizeUserInput(text: string): string {
  // Remove/escape special characters
  // Detect and block prompt injection patterns
  // Limit specific patterns (e.g., excessive newlines)
  // Validate against malicious patterns
}

// 2. Apply to all user inputs
const sanitizedText = sanitizeUserInput(assistantConfig.userText);
const sanitizedContext = sanitizeUserInput(assistantConfig.contextText);

// 3. Log suspicious input attempts
if (isSuspicious(text)) {
  logger.warn('Suspicious input detected', { userId, text: text.slice(0, 100) });
}

// 4. Consider adding rate limiting for users with suspicious patterns
```

**Estimated Effort:** 8-12 hours

---

### 12. Performance Optimization

**Issue:** No performance monitoring or optimization.

**Impact:**
- Unknown bottlenecks
- Potential cold start issues
- Suboptimal resource usage

**Workaround:** None.

**Action Required:**

```typescript
// 1. Add performance instrumentation
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
logger.info('Operation completed', { duration, operation: 'processBatch' });

// 2. Monitor key metrics:
//    - Request latency (p50, p95, p99)
//    - LLM call duration
//    - Database query times
//    - Cold start frequency/duration

// 3. Optimize based on metrics:
//    - Reduce cold starts (keep-alive pings)
//    - Optimize database queries (indexes, joins)
//    - Parallel processing improvements
//    - Memory usage optimization

// 4. Set up dashboards (Supabase analytics, Grafana, etc.)
```

**Estimated Effort:** 16-24 hours

---

## Known Workarounds

### Workaround 1: Manual Token Reconciliation

**Issue:** Quota deduction failures

**Temporary Solution:**

```sql
-- Find users with discrepancies
SELECT
  u.email,
  uq.tokens_available,
  uq.tokens_used,
  SUM(tp.tokens) as purchased_tokens
FROM users u
JOIN user_quotas uq ON u.id = uq.user_id
LEFT JOIN token_purchases tp ON u.id = tp.user_id
GROUP BY u.id, u.email, uq.tokens_available, uq.tokens_used
HAVING (uq.tokens_available + uq.tokens_used) != SUM(tp.tokens);

-- Manually adjust quota
SELECT add_tokens(
  'user-id-here',
  adjustment_amount,
  'manual_reconciliation',
  'Reconciliation for deduction failure on 2025-01-15'
);
```

---

### Workaround 2: Portability Check

**Issue:** No automated portability validation

**Temporary Solution:**

```bash
# Run before every commit
npm run lint:portability

# Or add to git pre-commit hook
# .git/hooks/pre-commit
#!/bin/bash
npm run lint:portability || exit 1
```

---

### Workaround 3: E2E Testing

**Issue:** No automated E2E tests

**Temporary Solution:** Use comprehensive manual test script:

```bash
#!/bin/bash
# test-e2e.sh

# 1. Bootstrap users
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"

# 2. Test free user
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assistants":[{"id":"test-1","model":"gemini-flash","aiRoleId":"editor","userText":"test","options":{"improve":true}}]}'

# ... more test scenarios
```

---

## Future Improvements

### Enhancement 1: Multi-Language Support

**Description:** Add support for multiple UI languages.

**Requirements:**
- Internationalization (i18n) for error messages
- Localized response format
- Support for language-specific models

**Estimated Effort:** 24-32 hours

---

### Enhancement 2: Batch Processing Queue

**Description:** Implement asynchronous batch processing for large requests.

**Requirements:**
- Job queue (Redis, BullMQ, etc.)
- Background workers
- Webhook callbacks for completion
- Job status tracking

**Estimated Effort:** 40-60 hours

---

### Enhancement 3: Analytics Dashboard

**Description:** Real-time analytics for usage, costs, and performance.

**Requirements:**
- Data collection pipeline
- Time-series database
- Dashboard UI (Grafana, custom)
- Metrics: requests/day, tokens/user, costs, latency

**Estimated Effort:** 60-80 hours

---

### Enhancement 4: Custom Model Fine-Tuning

**Description:** Allow users to upload custom fine-tuned models.

**Requirements:**
- Model upload/storage
- Validation and testing
- Integration with existing connectors
- Security considerations

**Estimated Effort:** 80-120 hours

---

## Priority Matrix

| Priority | Items | Estimated Total Effort |
|----------|-------|------------------------|
| **High** | Gemini token counting, Pre-flight estimation, Quota retry logic, Portability validation | 30-46 hours |
| **Medium** | E2E tests, Structured logging, Environment validation, Rate limiting | 30-42 hours |
| **Low** | Response caching, Error tracking, Input sanitization, Performance optimization | 50-72 hours |

**Total Technical Debt:** ~110-160 hours

---

## Migration Impact

When migrating to a new platform (e.g., AWS Lambda), none of these issues affect the migration process directly because:

1. **All issues are in core logic (`src/`)** - which doesn't change during migration
2. **Handler layer (<100 lines)** - remains minimal regardless of platform
3. **Platform-agnostic design** - ensures issues are isolated and fixable without impacting portability

**Migration remains 4-8 hours regardless of technical debt.** ✅

---

**Related Documentation:**
- [Architecture](./architecture.md) - System design and two-layer architecture
- [Developer Guides](./developer-guides.md) - Implementation patterns and how-to guides
- [API Reference](./api-reference.md) - Complete API specification
- [Configuration](./configuration.md) - Environment variables and settings
