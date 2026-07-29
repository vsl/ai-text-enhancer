# API Integration Guide

Complete guide for integrating with the AI Text Enhancer backend API. Covers authentication, text enhancement, user profiles, tier limits, and error handling.

## Overview

The AI Text Enhancer backend is built on Supabase with Edge Functions providing:

- **JWT-based authentication** - Email/password, OAuth providers (Google, GitHub), and anonymous users
- **Batch text enhancement** - Process up to 10 texts in parallel
- **Tier-based access control** - Free, Plus, and Premium tiers with different limits
- **Token quota management** - Track usage and prevent overage

**Base URLs:**
- Local development: `http://localhost:54321`
- Production: `https://your-project.supabase.co`

**Key Endpoints:**
- `POST /auth/v1/signup` - Create account (email/password or anonymous)
- `POST /auth/v1/token?grant_type=password` - Login with credentials
- `GET /functions/v1/me` - Get user profile and quota
- `POST /functions/v1/enhance` - Enhance text with AI

## Authentication

All enhancement requests require a valid JWT token in the `Authorization: Bearer <token>` header.

### Anonymous Users

Perfect for onboarding and demos without requiring signup.

**Create anonymous session:**
```typescript
const { data, error } = await supabase.auth.signUp({});
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "anonymous-550e8400@supabase.io",
    "is_anonymous": true
  }
}
```

**Characteristics:**
- Tier: Free (500 char limit)
- Welcome tokens: 50,000
- No recovery if browser storage cleared

### Email/Password Authentication

**Sign up:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'SecurePassword123!'
});
```

**Sign in:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'SecurePassword123!'
});

// Access JWT token
const jwtToken = data.session?.access_token;
```

**Password requirements:**
- Minimum: 6 characters (default)
- Recommended for production: 8+ characters with uppercase, lowercase, numbers, symbols

**What happens automatically on signup:**
- User created in `auth.users`
- Database trigger creates profile (tier: 'free')
- Database trigger creates quota entry (50,000 welcome tokens)

### OAuth Providers

Supports Google, GitHub, Apple, and more. Enable providers in Supabase Dashboard → Authentication → Providers.

**Login:**
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // or 'github', 'apple', etc.
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});
```

**OAuth callback route** (`app/auth/callback/route.ts`):
```typescript
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect('/dashboard');
}
```

### Password Reset

**Request password reset:**
```typescript
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: `${window.location.origin}/auth/reset-password`
  }
);
```

**Reset password page:**
```typescript
// Token automatically extracted from URL by Supabase
const { error } = await supabase.auth.updateUser({
  password: newPassword
});
// User is now logged in automatically
```

### Session Management

**Get current session:**
```typescript
const { data: { session } } = await supabase.auth.getSession();

if (session) {
  const jwtToken = session.access_token;
  const userId = session.user.id;
}
```

**Listen to auth state changes:**
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User logged in
  } else if (event === 'SIGNED_OUT') {
    // User logged out
  } else if (event === 'TOKEN_REFRESHED') {
    // JWT refreshed automatically
  }
});
```

**Logout:**
```typescript
await supabase.auth.signOut();
```

## Enhancement API

### Endpoint

```
POST /functions/v1/enhance
```

**Authentication:** Required - Bearer token
**Content-Type:** `application/json`

### Request Format

```typescript
{
  "assistants": [
    {
      "id": "task-1",                    // Unique client-side identifier
      "model": "gemini-flash",           // AI model to use
      "aiRoleId": "editor",              // Role: 'editor' | 'summarizer' | 'email_assistant' | 'social_media_assistant'
      "userText": "text to enhance",     // Required: text to process
      "contextText": "optional context", // Optional: additional context
      "options": {                       // Transformation options
        "improve": true,
        "fixMistakes": true,
        "formality": "Neutral"
      }
    }
  ]
}
```

### AI Roles

| Role ID | Display Name | Purpose |
|---------|-------------|---------|
| `editor` | General Assistant | Grammar, clarity, general improvements |
| `summarizer` | Summarizer Assistant | Condensing and summarizing text |
| `email_assistant` | Professional Email Assistant | Email composition and formatting |
| `social_media_assistant` | Social Media Assistant | Social media posts and marketing copy |

**Role mapping** (from display name to ID in `WorkflowContext.tsx:271-276`):
```typescript
'General Assistant' → 'editor'
'Summarizer Assistant' → 'summarizer'
'Professional Email Assistant' → 'email_assistant'
'Social Media Assistant' → 'social_media_assistant'
```

### Enhancement Options

All options are optional. If none provided, AI uses role's default behavior.

**Core transformations:**
```typescript
{
  improve: boolean;        // Improve clarity, flow, vocabulary
  fixMistakes: boolean;    // Fix grammar, spelling, punctuation
  format: boolean;         // Apply formatting (lists, paragraphs)
}
```

**Length adjustments (mutually exclusive):**
```typescript
{
  shorten: boolean;        // Make more concise
  lengthen: boolean;       // Add detail and depth (cannot use with shorten)
}
```

**Style controls:**
```typescript
{
  formality: string;       // 'Casual' | 'Neutral' | 'Formal'
  tone: string;            // Custom tone (e.g., 'professional', 'witty', 'urgent')
  languageLevel: string;   // '' | 'simple' | 'intermediate' | 'advanced' | 'fluent' | 'native'
}
```

**Special transformations:**
```typescript
{
  translateTo: string;     // ISO language code (e.g., 'es', 'fr', 'de', 'ja')
  addEmojis: boolean;      // Add relevant emojis to text
}
```

### Available Models

| Model ID | Name | Tiers | Speed | Quality |
|----------|------|-------|-------|---------|
| `gemini-flash` | Gemini 2.5 Flash | Free, Plus, Premium | Very Fast | Good |
| `gemini-pro` | Gemini 1.5 Pro | Plus, Premium | Moderate | Excellent |
| `open-router-free` | Open Router Free | Free | Fast | Good |
| `gpt-4` | GPT-4 | Premium | Slower | Best |

### Tier Limits

| Tier | Max User Text | Max Context | Batch Size | Models |
|------|---------------|-------------|------------|---------|
| **Free** | 500 chars | 800 chars | 3 | gemini-flash, open-router-free |
| **Plus** | 2000 chars | 3000 chars | 10 | + gemini-pro |
| **Premium** | 5000 chars | 10000 chars | 10 | + gpt-4 |

**Note:** Unauthenticated users are treated as free tier.

### Response Format

**Always returns HTTP 200** even with partial failures. Check each result's `status` field.

**Success response:**
```json
{
  "results": [
    {
      "id": "task-1",
      "status": "success",
      "enhancedText": "Your improved text appears here.",
      "total_tokens": 42
    }
  ]
}
```

**Partial failure response:**
```json
{
  "results": [
    {
      "id": "task-1",
      "status": "success",
      "enhancedText": "This one worked.",
      "total_tokens": 35
    },
    {
      "id": "task-2",
      "status": "error",
      "error": {
        "code": "MODEL_ACCESS_DENIED",
        "message": "User tier 'free' does not have access to model 'gemini-pro'"
      }
    }
  ]
}
```

### Example Request

```typescript
const response = await fetch(`${apiBaseUrl}/functions/v1/enhance`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    assistants: [{
      id: 'task-1',
      model: 'gemini-flash',
      aiRoleId: 'editor',
      userText: 'i has a great day today',
      options: {
        improve: true,
        fixMistakes: true
      }
    }]
  })
});

const { results } = await response.json();
// results[0].enhancedText: "I had a great day today."
```

## User Profile API

### Endpoint

```
GET /functions/v1/me
```

**Authentication:** Required - Bearer token
**Purpose:** Fetch current user's profile and quota

### Request Example

```typescript
const response = await fetch(`${apiBaseUrl}/functions/v1/me`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { profile, quota } = await response.json();
```

### Response Structure

```json
{
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "tier": "free",
    "is_admin": false,
    "is_active": true,
    "auth_provider": "email"
  },
  "quota": {
    "tokens_available": 45230,
    "tokens_used": 4770
  }
}
```

### When to Call `/me`

**✅ Call when:**
- After signup/login - Get user's tier and token balance
- On page refresh - Fetch fresh data
- After enhancement requests - Show updated balance (optional)
- Account/settings page - Display user information

**❌ Don't call for:**
- Every enhancement request - API handles deduction automatically
- Real-time balance tracking - Only refresh when needed
- Authentication check - JWT token alone is sufficient

## Error Handling

### Authentication Errors (HTTP 401)

```json
{
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid or expired token"
  }
}
```

**Solution:** Refresh token or redirect to login

### Authorization Errors (HTTP 403)

```json
{
  "error": {
    "code": "USER_BLOCKED",
    "message": "User account is blocked"
  }
}
```

**Solution:** Show "Account suspended" message

### Validation Errors (HTTP 400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "userText exceeds maximum length for tier 'free' (500 characters)"
  }
}
```

**Solution:** Check tier limits, shorten text or upgrade tier

### Quota Errors (HTTP 429)

```json
{
  "error": {
    "code": "INSUFFICIENT_QUOTA",
    "message": "Insufficient token quota for this request"
  }
}
```

**Solution:** Purchase more tokens or upgrade tier

### Common Error Codes

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| `AUTHENTICATION_FAILED` | 401 | Invalid/expired JWT | Refresh token or re-login |
| `USER_BLOCKED` | 403 | Account blocked | Contact support |
| `MODEL_ACCESS_DENIED` | 403 | Model not available on tier | Upgrade tier |
| `VALIDATION_ERROR` | 400 | Invalid request | Check request format |
| `TEXT_TOO_LONG` | 400 | Text exceeds tier limit | Shorten text or upgrade |
| `INSUFFICIENT_QUOTA` | 429 | Not enough tokens | Buy tokens or upgrade |
| `LLM_TIMEOUT` | 200* | LLM provider timeout | Retry request |
| `LLM_ERROR` | 200* | LLM provider error | Retry later |

**\*Note:** LLM errors appear in results array with HTTP 200

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

**Get values from:** Supabase Dashboard → Project Settings → API

## Quick Start Examples

### Example 1: Anonymous User Flow

```typescript
// 1. Create anonymous session
const { data } = await supabase.auth.signUp({});
const token = data.session?.access_token;

// 2. Get profile
const profile = await fetch(`${apiUrl}/me`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 3. Enhance text
const result = await fetch(`${apiUrl}/enhance`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assistants: [{
      id: '1',
      model: 'gemini-flash',
      aiRoleId: 'editor',
      userText: 'i want to improve my writing',
      options: { improve: true, fixMistakes: true }
    }]
  })
}).then(r => r.json());

console.log(result.results[0].enhancedText);
// "I want to improve my writing."
```

### Example 2: Batch Processing

```typescript
const response = await fetch(`${apiUrl}/enhance`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assistants: [
      {
        id: 'casual',
        model: 'gemini-flash',
        aiRoleId: 'social_media_assistant',
        userText: 'We are launching a new product next month.',
        options: { shorten: true, formality: 'Casual', addEmojis: true }
      },
      {
        id: 'formal',
        model: 'gemini-flash',
        aiRoleId: 'email_assistant',
        userText: 'We are launching a new product next month.',
        options: { formality: 'Formal', tone: 'professional' }
      },
      {
        id: 'spanish',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'We are launching a new product next month.',
        options: { translateTo: 'es' }
      }
    ]
  })
});

const { results } = await response.json();
results.forEach(r => {
  if (r.status === 'success') {
    console.log(`${r.id}: ${r.enhancedText}`);
  }
});
```

### Example 3: Professional Email

```typescript
const response = await fetch(`${apiUrl}/enhance`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assistants: [{
      id: 'email',
      model: 'gemini-pro',
      aiRoleId: 'email_assistant',
      userText: 'cant make it sorry',
      contextText: 'Meeting invitation from John about Q4 budget review on Friday at 2pm',
      options: {
        improve: true,
        lengthen: true,
        formality: 'Formal',
        tone: 'polite and professional'
      }
    }]
  })
});
```

## Testing

### Test Users (Development)

Pre-created users for local development:

| Email | Password | Tier | Tokens |
|-------|----------|------|--------|
| `free@textenhancer.dev` | `Free_User_2025` | free | 50,000 |
| `plus@textenhancer.dev` | `Plus_User_2025` | plus | 500,000 |
| `premium@textenhancer.dev` | `Premium_User_2025` | premium | 5,000,000 |
| `zero@textenhancer.dev` | `Zero_Tokens_2025` | free | 0 |
| `blocked@textenhancer.dev` | `Blocked_User_2025` | free | 10,000 |
| `admin@textenhancer.dev` | `Admin_2025_Secure!` | premium | 10,000,000 |

### Bootstrap Test Users

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"
```

## Production Deployment

### Security Best Practices

1. **Never expose service_role key** - Only use anon key in frontend
2. **Store tokens securely** - Use httpOnly cookies or secure storage
3. **Implement token refresh** - Don't wait for 401 errors
4. **Validate client-side** - Check tier limits before sending request
5. **Handle errors gracefully** - User-friendly error messages
6. **Monitor quota** - Show remaining tokens to users

### Email Configuration

**Development:** Emails captured by Inbucket at http://localhost:54324

**Production:** Configure custom SMTP (SendGrid, Amazon SES, Mailgun, etc.) in Supabase config

## Additional Resources

- [Architecture Documentation](./architecture.md) - System design and patterns
- [Testing Guide](./testing.md) - Test strategies and best practices
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth) - Official documentation
