# API Reference

**Last Updated:** August 2026

Complete API specification for the AI Text Enhancer Backend, including authentication, endpoints, request/response schemas, error codes, and examples.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Main Enhancement Endpoint](#main-enhancement-endpoint)
4. [User Profile Endpoint](#user-profile-endpoint)
5. [Admin Endpoints](#admin-endpoints)
6. [Request Specification](#request-specification)
7. [Response Specification](#response-specification)
8. [Error Codes Reference](#error-codes-reference)
9. [Request Examples](#request-examples)
10. [Response Examples](#response-examples)
11. [Available Models](#available-models)
12. [Available AI Roles](#available-ai-roles)

---

## API Overview

The AI Text Enhancer Backend is a serverless API that processes batches of text enhancement requests. The API is designed for:

- **Batch Processing:** Handle 1-10 enhancement tasks in a single request
- **Parallel Execution:** All tasks processed concurrently for speed
- **Flexible Enhancement:** Rich set of transformation options
- **Multi-Model Support:** Production access through Gemini and OpenRouter
- **Tier-Based Access:** Three-tier system (Free, Plus, Premium) with different limits
- **Token-Based Billing:** Daily token quota per tier with atomic deduction

**Base URL:** `http://localhost:54321/functions/v1` (local) or your production URL

---

## Authentication

### Overview

The API uses **Supabase Auth** for authentication with JWT tokens and database-backed user profiles. Authentication supports multiple providers including email/password, OAuth (Google, GitHub, Apple, Facebook, Twitter, Azure), and **anonymous sign-ins**.

### Method

All requests (except health checks) must include a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <YOUR_JWT_TOKEN>
```

### Getting a JWT Token

#### Email/Password Login

```bash
curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

Response includes `access_token` field with JWT token.

#### Anonymous Sign-In

Anonymous users can access the service without providing email or credentials:

```bash
curl -X POST 'http://localhost:54321/auth/v1/signup' \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Anonymous User Features:**
- Same free tier benefits (50k welcome tokens)
- No email required - users identified by UUID only
- Automatic profile creation with tier and quota
- Rate limited: 30 anonymous sign-ins per hour per IP address
- **Important:** Lost access if browser storage is cleared (no account recovery)
- Account linking is NOT enabled - anonymous users cannot convert to permanent accounts

### Token Validation

- Token is validated using local JWT verification (jose library)
- Token payload must contain `sub` claim (user ID)
- User profile and quota are fetched from database
- User must be active (`is_active = true`) to access services
- Invalid token returns `401 Unauthorized`
- Expired token returns `401 Unauthorized`
- Blocked user returns `403 Forbidden`
- Insufficient quota returns `429 Too Many Requests`

### User Tiers

| Tier | Token Quota | User Text Limit | Context Text Limit | Batch Size | Model Access |
|------|-------------|-----------------|-------------------|------------|--------------|
| **Free** | 50,000 tokens (welcome) | 500 chars | 800 chars | 3 | Both production models |
| **Plus** | 500,000 tokens | 2,000 chars | 3,000 chars | 10 | Both production models |
| **Premium** | 5,000,000 tokens | 5,000 chars | 10,000 chars | 10 | Both production models |

**Note:** Token quotas are NOT daily limits - they are one-time balances that deplete with usage. Tokens can be purchased or granted by admins.

### Authentication Flow

```
1. Client sends request with Bearer token
2. AuthService validates JWT locally using jose library
3. Extract userId from JWT payload (sub claim)
4. Fetch user profile + quota from database (single JOIN query)
5. Check user.isActive (throw UserBlockedError if false)
6. Return UserProfile with tier, admin status, quota info
```

---

## Main Enhancement Endpoint

### `POST /functions/v1/enhance`

Process a batch of text enhancement tasks.

**Method:** `POST`
**Content-Type:** `application/json`
**Authentication:** Required (Bearer token)

**Rate Limits:**
- Batch size: 1-10 assistants per request (tier-based: Free=3, Plus/Premium=10)
- Request timeout: 30 seconds per LLM call
- Token quota enforced per tier

**Headers:**

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | string | **Yes** | Bearer token for authentication |
| `Content-Type` | string | **Yes** | Must be `application/json` |

---

## User Profile Endpoint

### `GET /functions/v1/me`

Fetch current user's profile and quota information.

**Method:** `GET`
**Authentication:** Required (Bearer token)
**No query parameters needed** - user is identified from JWT token

**Purpose:** Provides UI with user data without complex REST API queries.

**Use Cases:**
- After signup/login - display tier and token balance
- Page refresh - get updated token balance
- Account settings page - show complete user info

**Example Request:**

```bash
curl -X GET 'http://localhost:54321/functions/v1/me' \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

**Success Response (200 OK):**

```json
{
  "profile": {
    "id": "user-uuid-here",
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

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `AUTHENTICATION_FAILED` | Invalid or expired token |
| 401 | `AUTHENTICATION_FAILED` | User account is blocked |

---

## Admin Endpoints

All admin endpoints require:
1. Valid JWT token
2. User with `is_admin = true` in database

**Base Path:** `/functions/v1/admin`

### Bootstrap Test Users

#### `POST /admin/bootstrap`

Create 6 predefined test users (idempotent operation).

**Authentication:** Requires `BOOTSTRAP_SECRET_KEY` in Authorization header (not JWT)

**Request:**

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: your-bootstrap-secret"
```

**Response:**

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

**Predefined Users:**

| Email | Password | Tier | Admin | Tokens | Status | Purpose |
|-------|----------|------|-------|--------|--------|---------|
| admin@textenhancer.dev | Admin_2025_Secure! | premium | Yes | 10,000,000 | Active | Admin operations |
| free@textenhancer.dev | Free_User_2025 | free | No | 50,000 | Active | Free tier limits |
| plus@textenhancer.dev | Plus_User_2025 | plus | No | 500,000 | Active | Plus tier limits |
| premium@textenhancer.dev | Premium_User_2025 | premium | No | 5,000,000 | Active | Premium tier limits |
| zero@textenhancer.dev | Zero_Tokens_2025 | free | No | 0 | Active | Quota errors |
| blocked@textenhancer.dev | Blocked_User_2025 | free | No | 10,000 | Blocked | Access denial |

---

### List Users

#### `GET /admin/users`

Get paginated list of all users.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Items per page (max: 100) |

**Example:**

```bash
curl http://localhost:54321/functions/v1/admin/users?page=1&limit=20 \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Response:**

```json
{
  "users": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "tier": "free",
      "isAdmin": false,
      "isActive": true,
      "tokensAvailable": 50000,
      "tokensUsed": 0,
      "authProvider": "email"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6
  }
}
```

---

### Get User Details

#### `GET /admin/users/:userId`

Get complete user details including quota and purchase history.

**Example:**

```bash
curl http://localhost:54321/functions/v1/admin/users/<USER_ID> \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Response:**

```json
{
  "profile": {
    "userId": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "isAdmin": false,
    "isActive": true,
    "tokensAvailable": 50000,
    "tokensUsed": 1500,
    "authProvider": "email"
  },
  "recentPurchases": [
    {
      "id": "uuid",
      "userId": "uuid",
      "tokens": 50000,
      "purchaseType": "welcome_bonus",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### Adjust Tokens

#### `POST /admin/users/:userId/tokens`

Add or subtract tokens from user account.

**Request Body:**

```json
{
  "tokens": 100000,
  "description": "Bonus tokens for testing"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokens` | number | Yes | Number of tokens to add (positive) or subtract (negative) |
| `description` | string | No | Optional description of the adjustment |

**Example (Add Tokens):**

```bash
curl -X POST http://localhost:54321/functions/v1/admin/users/<USER_ID>/tokens \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": 100000,
    "description": "Bonus tokens"
  }'
```

**Example (Subtract Tokens):**

```bash
curl -X POST http://localhost:54321/functions/v1/admin/users/<USER_ID>/tokens \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": -50000
  }'
```

---

### Change User Tier

#### `PUT /admin/users/:userId/tier`

Change user's subscription tier.

**Request Body:**

```json
{
  "tier": "premium"
}
```

**Valid Tiers:** `free`, `plus`, `premium`

**Example:**

```bash
curl -X PUT http://localhost:54321/functions/v1/admin/users/<USER_ID>/tier \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "premium"
  }'
```

---

### Block/Unblock User

#### `PUT /admin/users/:userId/status`

Block or unblock a user account.

**Request Body:**

```json
{
  "isActive": false
}
```

**Example (Block User):**

```bash
curl -X PUT http://localhost:54321/functions/v1/admin/users/<USER_ID>/status \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

**Example (Unblock User):**

```bash
curl -X PUT http://localhost:54321/functions/v1/admin/users/<USER_ID>/status \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": true
  }'
```

---

## Request Specification

### Request Body Schema

```typescript
interface BatchRequest {
  assistants: AssistantConfiguration[];  // 1-10 items (tier-based max)
}
```

### AssistantConfiguration

```typescript
interface AssistantConfiguration {
  id: string;                   // Unique client-side identifier
  model: string;                // Model identifier (e.g., 'gemini-flash')
  aiRoleId: string;             // editor | summarizer | email_assistant | social_media_assistant
  userText: string;             // Text to enhance (tier-based max length)
  contextText?: string;         // Optional context (tier-based max length)
  options: TransformationOptions;
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique identifier for this task in the batch. Used to match results. |
| `model` | string | **Yes** | Model identifier from available models list. Must be accessible to user's tier. |
| `aiRoleId` | string | **Yes** | AI role identifier from available roles list. |
| `userText` | string | **Yes** | Nonblank text. Length limits by tier: Free=500, Plus=2000, Premium=5000 chars. |
| `contextText` | string | No | Reference-only context. Length limits by tier: Free=800, Plus=3000, Premium=10000 chars. |
| `options` | object | **Yes** | Transformation options (see below). |

---

### TransformationOptions

```typescript
interface TransformationOptions {
  // Core Transformations
  improve?: boolean;            // Improve clarity, flow, vocabulary
  fixMistakes?: boolean;        // Fix grammar, spelling, punctuation
  format?: boolean;             // Apply formatting (lists, paragraphs)

  // Length Adjustments (mutually exclusive)
  shorten?: boolean;            // Make more concise
  lengthen?: boolean;           // Add detail and depth

  // Style Controls
  formality?: 'Casual' | 'Neutral' | 'Formal';
  tone?: 'Confident' | 'Empathetic' | 'Cheerful' | 'Witty' | 'Direct' | 'Engaging' | 'Polite' | 'Sincere' | 'Disappointed' | 'Apologetic' | 'Pessimistic' | 'Worried';
  languageLevel?: 'default' | 'simple' | 'intermediate' | 'advanced' | 'fluent' | 'native';

  // Special Transformations
  translateTo?: 'ar' | 'zh' | 'en' | 'fr' | 'de' | 'hi' | 'it' | 'ja' | 'ko' | 'pt' | 'ru' | 'es' | 'uk' | 'vi';
  addEmojis?: boolean;          // Add relevant emojis
}
```

**Validation Rules:**
- Empty options are valid and perform the role's primary task without extra transformations
- `shorten` and `lengthen` cannot both be `true`
- IDs and user text must be nonblank; assistant IDs must be unique
- Unknown fields, models, roles, option types, and enum values are rejected
- Model/role compatibility and tier text/context limits are checked before provider calls

---

## Response Specification

### Success Response (200 OK)

**Important:** The API returns HTTP 200 even when individual tasks fail. Always check the `status` field of each result.

```typescript
interface BatchResponse {
  results: BatchResult[];
}

type BatchResult = SuccessResult | ErrorResult;
```

### SuccessResult

```typescript
interface SuccessResult {
  id: string;              // Matches request assistant.id
  status: 'success';
  enhancedText: string;    // AI-generated enhanced text
  total_tokens: number;    // Tokens consumed (for billing)
}
```

### ErrorResult

```typescript
interface ErrorResult {
  id: string;              // Matches request assistant.id
  status: 'error';
  error: ErrorDetails;
}

interface ErrorDetails {
  code: string;            // Machine-readable error code
  message: string;         // Human-readable error message
}
```

---

## Error Codes Reference

### Top-Level Request Errors (4xx/5xx HTTP Status)

These errors prevent the entire request from being processed.

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_REQUEST` | 400 | Invalid shape, ID/text, model/role, option, conflict, or tier text/context length |
| `INVALID_TOKEN` | 401 | Bearer token is missing, malformed, or invalid |
| `EXPIRED_TOKEN` | 401 | Bearer token has expired |
| `AUTHENTICATION_FAILED` | 401 | Authentication service unavailable or error |
| `USER_BLOCKED` | 403 | User account is blocked (is_active = false) |
| `ADMIN_REQUIRED` | 403 | Admin access required for this endpoint |
| `INSUFFICIENT_QUOTA` | 429 | Not enough remaining tokens for this request |
| `INTERNAL_ERROR` | 500 | Unexpected system error |
| `SERVICE_UNAVAILABLE` | 503 | System or external service temporarily unavailable |

---

### Per-Task Errors (HTTP 200, error in results array)

These errors affect individual tasks within a batch. Other tasks may succeed.

| Code | Description |
|------|-------------|
| `TIER_BATCH_SIZE_EXCEEDED` | Assistant position is beyond the tier batch limit |
| `TASK_TIMEOUT` | Connector aborted the provider request at the configured timeout |
| `LLM_ERROR` | Provider failure or malformed structured output |

---

## Request Examples

### Example 1: Basic Grammar Correction

```json
{
  "assistants": [
    {
      "id": "task-001",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "this sentance has a typo and is unprofessional.",
      "options": {
        "improve": true,
        "fixMistakes": true,
        "formality": "Formal"
      }
    }
  ]
}
```

### Example 2: Batch with Multiple Tasks

```json
{
  "assistants": [
    {
      "id": "edit-01",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Quick summary of the meeting",
      "options": {
        "improve": true,
        "formality": "Formal"
      }
    },
    {
      "id": "translate-01",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "Welcome to our platform",
      "options": {
        "translateTo": "es"
      }
    }
  ]
}
```

---

## Response Examples

### Example 1: Full Success

```json
{
  "results": [
    {
      "id": "task-001",
      "status": "success",
      "enhancedText": "This sentence is grammatically correct and maintains a professional tone.",
      "total_tokens": 52
    }
  ]
}
```

### Example 2: Partial Success

```json
{
  "results": [
    {
      "id": "edit-01",
      "status": "success",
      "enhancedText": "This is a comprehensive summary of the meeting discussions.",
      "total_tokens": 45
    },
    {
      "id": "translate-01",
      "status": "error",
      "error": {
        "code": "LLM_TIMEOUT",
        "message": "The LLM provider did not respond within the 30-second timeout period."
      }
    }
  ]
}
```

---

## Available Models

| Model ID | Display Name | Provider | Access Tiers | Context Window |
|----------|--------------|----------|--------------|----------------|
| `gemini-flash` | Gemini 2.5 Flash | Google Gemini | Free, Plus, Premium | 1,000,000 |
| `open-router-free` | Free Model (OpenRouter) | OpenRouter | Free, Plus, Premium | 163,840 |

**Note:** Models are configured in `src/config/models.config.ts`. The LM Studio connector remains available for direct local connector tests but is not an API model.

---

## Available AI Roles

| Role ID | Name | Description | Allowed Models |
|---------|------|-------------|----------------|
| `editor` | Editor | Edits clarity, correctness, readability, and flow | Both production models |
| `summarizer` | Summarizer | Condenses text while preserving key information | Both production models |
| `social_media_assistant` | Social Media Assistant | Creates engaging, shareable social media content | Both production models |
| `email_assistant` | Email Assistant | Writes complete, ready-to-send emails | Both production models |

**Note:** Roles are configured in `src/config/roles.config.ts`.

---

## Quick Reference

### HTTP Status Codes Summary

| Status | Meaning |
|--------|---------|
| 200 | Success (check individual task `status`) |
| 400 | Bad request (validation failed) |
| 401 | Authentication failed |
| 403 | Authorization denied |
| 429 | Insufficient quota |
| 500 | Internal server error |
| 503 | Service unavailable |

### Tier Limits Summary

| Tier | Tokens | User Text | Context Text | Batch Size |
|------|--------|-----------|--------------|------------|
| Free | 50,000 | 500 chars | 800 chars | 5 |
| Plus | 500,000 | 2,000 chars | 3,000 chars | 10 |
| Premium | 5,000,000 | 10,000 chars | 15,000 chars | 10 |

---

**Related Documentation:**
- [Architecture Guide](./architecture.md) - System design and two-layer architecture
- [Developer Guides](./developer-guides.md) - Implementation patterns and how-to guides
- [Configuration](./configuration.md) - Environment variables and settings
- [Testing Guide](./testing.md) - Complete testing scenarios
