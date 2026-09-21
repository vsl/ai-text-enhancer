# Testing Guide

Complete guide for testing the AI Text Enhancer backend, including unit tests, integration tests, and manual testing scenarios.

**Last Updated:** January 2025

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Setup](#setup)
3. [Unit Tests](#unit-tests)
4. [Test Users](#test-users)
5. [Manual Testing Scenarios](#manual-testing-scenarios)
6. [Writing Tests](#writing-tests)

---

## Quick Reference

### Common Test Commands

```bash
# Run all tests
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm run test:coverage

# Type checking
npm run type-check

# Platform portability check
npm run lint:portability

# Single test file
npm test -- src/services/batch-orchestrator.test.ts

# Specific test pattern
npm test -- --testNamePattern="should validate batch structure"
```

### Prompt/model evaluations

Run committed prompt cases against the configured production models:

```bash
npm run eval:prompts
```

Evaluate one or more candidate provider model IDs without exposing them in the UI:

```bash
npm run eval:prompts -- \
  --model=gemini:gemini-2.5-flash#json-schema \
  --model=openrouter:microsoft/mai-ds-r1:free#json-object
```

The command reads `GEMINI_API_KEY` and `OPENROUTER_API_KEY`, preflights catalog availability and supported parameters, and never substitutes another model. Missing keys and unavailable models are recorded as skipped. JSON reports are written to the gitignored `evaluation-results/` directory for deterministic checks and human review; live evaluations are not run in CI.

### Quick Manual Test

```bash
# 1. Bootstrap test users
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"

# 2. Login as free user
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# 3. Test enhancement
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Hello world",
      "options": {"improve": true}
    }]
  }'
```

---

## Setup

### Prerequisites

- Supabase running locally (`supabase start`)
- Environment variables configured (`.env.local`)
- Node.js and npm installed

### 1. Start Local Supabase

```bash
supabase start
```

This starts:
- PostgreSQL database on `localhost:54322`
- Supabase Studio on `http://localhost:54323`
- Edge Functions on `http://localhost:54321`

### 2. Get Supabase Credentials

```bash
# Get all credentials
supabase status

# Get JWT secret
supabase status -o json | grep JWT_SECRET
```

Map to `.env.local`:
| `supabase status` | `.env.local` variable |
|---|---|
| `Secret key` (service_role) | `APP_SUPABASE_SERVICE_ROLE_KEY` |
| `JWT_SECRET` | `APP_SUPABASE_JWT_SECRET` |

### 3. Set Bootstrap Secret

Add to `.env.local`:
```bash
BOOTSTRAP_SECRET_KEY=local-dev-secret-123
```

### 4. Reset Database (Optional)

```bash
# Reset with migrations and seed data
supabase db reset
```

---

## Unit Tests

### Overview

All tests are written in Jest and run in Node.js environment to validate platform portability.

**Test Structure:**
```
tests/
├── unit/                           # Unit tests (mirrors src/)
│   ├── config/                     # Config tests
│   ├── connectors/                 # LLM connector tests
│   ├── errors/                     # Error class tests
│   ├── repositories/               # Repository tests
│   ├── services/                   # Service tests
│   └── utils/                      # Utility tests
├── integration/                    # Integration tests
├── mocks/                          # Shared mocks
└── fixtures/                       # Test data
```

### Run All Tests

```bash
npm test
```

Expected output:
```
Test Suites: 25 passed, 25 total
Tests:       150 passed, 150 total
Snapshots:   0 total
Time:        12.5 s
```

### Watch Mode

```bash
npm test -- --watch
```

Runs tests on file changes. Press `p` to filter by filename, `t` to filter by test name.

### Coverage Report

```bash
npm run test:coverage
```

Generates coverage report in `coverage/` directory. Open `coverage/lcov-report/index.html` in browser.

**Coverage Thresholds:**
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

### Specific Test Files

```bash
# Auth tests
npm test -- src/services/auth-middleware.test.ts

# Quota tests
npm test -- src/services/quota-service.test.ts

# Repository tests
npm test -- tests/unit/repositories/user.repository.test.ts
npm test -- tests/unit/repositories/quota.repository.test.ts

# Admin tests
npm test -- tests/unit/services/admin.service.test.ts

# Batch orchestrator tests
npm test -- src/services/batch-orchestrator.test.ts
```

### Type Checking

```bash
npm run type-check
```

Runs TypeScript compiler in check mode. No output = success.

### Portability Validation

```bash
npm run lint:portability
```

Checks that `src/` directory doesn't use `Deno.*` APIs. Critical for platform portability.

---

## Test Users

Bootstrap creates 6 predefined test users for development and testing.

| Email | Password | Tier | Admin | Tokens | Status | Purpose |
|-------|----------|------|-------|--------|--------|---------|
| admin@textenhancer.dev | Admin_2025_Secure! | premium | Yes | 10,000,000 | Active | Admin operations |
| free@textenhancer.dev | Free_User_2025 | free | No | 50,000 | Active | Free tier testing |
| plus@textenhancer.dev | Plus_User_2025 | plus | No | 500,000 | Active | Plus tier testing |
| premium@textenhancer.dev | Premium_User_2025 | premium | No | 5,000,000 | Active | Premium tier testing |
| zero@textenhancer.dev | Zero_Tokens_2025 | free | No | 0 | Active | Quota error testing |
| blocked@textenhancer.dev | Blocked_User_2025 | free | No | 10,000 | **Blocked** | Access denial testing |

### Create Test Users

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"
```

**Idempotent:** Safe to run multiple times. Returns:
```json
{
  "success": true,
  "usersCreated": 6,
  "usersSkipped": 0,
  "users": ["admin@textenhancer.dev", ...]
}
```

Second run returns `"usersCreated": 0, "usersSkipped": 6`.

---

## Manual Testing Scenarios

### 1. Authentication Flow

#### Test Valid JWT

```bash
# Login as free user
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# Test enhancement
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Test message",
      "options": {"improve": true}
    }]
  }'
```

**Expected:** HTTP 200 with enhanced text

#### Test Invalid JWT

```bash
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer invalid-token-123" \
  -H "Content-Type: application/json" \
  -d '{"assistants":[{"id":"test-1","model":"gemini-flash","aiRoleId":"editor","userText":"test","options":{}}]}'
```

**Expected:** HTTP 401 Unauthorized

#### Test Missing Authorization Header

```bash
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{"assistants":[{"id":"test-1","model":"gemini-flash","aiRoleId":"editor","userText":"test","options":{}}]}'
```

**Expected:** HTTP 401 Unauthorized

#### Test Blocked User

```bash
# Login as blocked user
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"blocked@textenhancer.dev","password":"Blocked_User_2025"}' \
  | jq -r '.access_token')

# Attempt to use service
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assistants":[{"id":"test-1","model":"gemini-flash","aiRoleId":"editor","userText":"test","options":{}}]}'
```

**Expected:** HTTP 403 Forbidden with "User account is blocked"

#### Test Anonymous Sign-In

```bash
# Create anonymous session
ANON_RESPONSE=$(curl -s -X POST 'http://localhost:54321/auth/v1/signup' \
  -H "Content-Type: application/json" \
  -d '{}')

ANON_TOKEN=$(echo $ANON_RESPONSE | jq -r '.access_token')

# Use anonymous token
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $ANON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "anon-test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Hello from anonymous user!",
      "options": {"improve": true}
    }]
  }'
```

**Expected:** HTTP 200 with enhanced text. Anonymous user has free tier limits with 50k welcome tokens.

### 2. User Profile and Quota

Test the `/me` endpoint to fetch user profile and quota.

#### Test Profile Fetch

```bash
# Login as free user
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# Fetch profile
curl -X GET 'http://localhost:54321/functions/v1/me' \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
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

#### Test Different Tiers

```bash
# Plus tier
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"plus@textenhancer.dev","password":"Plus_User_2025"}' \
  | jq -r '.access_token')

curl -X GET 'http://localhost:54321/functions/v1/me' \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `"tier": "plus"`, `"tokens_available": 500000`

### 3. Quota Management

#### Test Sufficient Quota

```bash
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "This is a test message that needs enhancement",
      "options": {"improve": true}
    }]
  }'
```

**Expected:** HTTP 200 with enhanced text

Verify in Supabase Studio (`http://localhost:54323`):
- Open `user_quotas` table
- Find the user's row
- Check `tokens_available` decreased and `tokens_used` increased

#### Test Insufficient Quota

```bash
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"zero@textenhancer.dev","password":"Zero_Tokens_2025"}' \
  | jq -r '.access_token')

curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assistants":[{"id":"test-1","model":"gemini-flash","aiRoleId":"editor","userText":"test","options":{}}]}'
```

**Expected:** HTTP 429 Too Many Requests with "Insufficient quota"

### 4. Tier-Based Validation

#### Test Free Tier Limits

Free tier limits:
- `maxUserTextLength`: 500 characters
- `maxContextTextLength`: 800 characters
- `maxBatchSize`: 5 assistants

```bash
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# Test oversized userText (should fail)
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"assistants\":[{\"id\":\"test-1\",\"model\":\"gemini-flash\",\"aiRoleId\":\"editor\",\"userText\":\"$(printf 'a%.0s' {1..501})\",\"options\":{}}]}"
```

**Expected:** HTTP 400 Bad Request with "exceeds maximum length for tier 'free'"

#### Test Plus Tier Limits

```bash
TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"plus@textenhancer.dev","password":"Plus_User_2025"}' \
  | jq -r '.access_token')

# Test with 1500 characters (should succeed)
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"assistants\":[{\"id\":\"test-1\",\"model\":\"gemini-flash\",\"aiRoleId\":\"editor\",\"userText\":\"$(printf 'a%.0s' {1..1500})\",\"options\":{}}]}"
```

**Expected:** HTTP 200 OK

### 5. Admin Endpoints

All admin endpoints require valid JWT token with `is_admin = true`.

#### Get Admin JWT

```bash
ADMIN_TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@textenhancer.dev","password":"Admin_2025_Secure!"}' \
  | jq -r '.access_token')
```

#### List Users

```bash
curl http://localhost:54321/functions/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:** HTTP 200 with paginated user list

#### Get User Details

```bash
USER_ID="<user-id-from-list>"

curl http://localhost:54321/functions/v1/admin/users/$USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:** HTTP 200 with user profile, quota, and purchase history

#### Adjust Tokens

```bash
# Add tokens
curl -X POST http://localhost:54321/functions/v1/admin/users/$USER_ID/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokens": 100000, "description": "Bonus tokens"}'

# Subtract tokens
curl -X POST http://localhost:54321/functions/v1/admin/users/$USER_ID/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokens": -50000}'
```

**Expected:** HTTP 200 with updated user details

#### Change Tier

```bash
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/tier \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium"}'
```

**Expected:** HTTP 200 with updated tier

#### Block/Unblock User

```bash
# Block
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Unblock
curl -X PUT http://localhost:54321/functions/v1/admin/users/$USER_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

**Expected:** HTTP 200 with updated status

#### Test Non-Admin Access

```bash
# Login as regular user
FREE_TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# Attempt admin operation
curl http://localhost:54321/functions/v1/admin/users \
  -H "Authorization: Bearer $FREE_TOKEN"
```

**Expected:** HTTP 403 Forbidden with "Admin access required"

---

## Writing Tests

### Test Structure

All tests follow Jest conventions:

```typescript
describe('ServiceName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterAll(() => {
    // Cleanup after all tests
  });

  it('should perform expected behavior', () => {
    // Arrange
    const input = { ... };

    // Act
    const result = service.method(input);

    // Assert
    expect(result).toEqual(expectedOutput);
  });
});
```

### Mocking External Services

**Mock Supabase Client:**
```typescript
const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      })
    })
  })
};
```

**Mock LLM Connectors:**
```typescript
const mockConnector = {
  enhance: jest.fn().mockResolvedValue({
    enhancedText: 'Enhanced text',
    total_tokens: 100
  })
};
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod(input);
  expect(result).toBeDefined();
});
```

### Testing Error Handling

```typescript
it('should throw error on invalid input', () => {
  expect(() => service.validate(invalidInput)).toThrow(ValidationError);
});

it('should handle async errors', async () => {
  await expect(service.asyncMethod(badInput)).rejects.toThrow(CustomError);
});
```

---

## Troubleshooting

### Supabase Not Starting

```bash
# Check Docker is running
docker ps

# Restart Supabase
supabase stop
supabase start
```

### Database Out of Sync

```bash
# Reset database with migrations and seed data
supabase db reset
```

### Test Users Not Found

```bash
# Run bootstrap again
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"
```

### Check Logs

```bash
# View Edge Function logs
npm run logs:tail

# Or use Supabase CLI
supabase functions logs enhance --tail
```

---

## Next Steps

- **API Reference:** See [API Reference](./api-reference.md) for complete API documentation
- **Architecture:** See [Architecture](./architecture.md) for system design
- **Developer Guides:** See [Developer Guides](./developer-guides.md) for implementation patterns

---

**Last Updated:** January 2025
**Maintained By:** Development Team
