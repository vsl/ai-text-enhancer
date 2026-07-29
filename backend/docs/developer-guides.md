# Developer Guides

**Last Updated:** January 2025

Practical how-to guides for common development tasks, coding conventions, and implementation patterns.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Adding New Models](#adding-new-models)
3. [Adding New AI Roles](#adding-new-ai-roles)
4. [Adding New LLM Providers](#adding-new-llm-providers)
5. [Coding Conventions](#coding-conventions)
6. [Testing Strategies](#testing-strategies)
7. [Best Practices Checklist](#best-practices-checklist)
8. [Common Pitfalls](#common-pitfalls)

---

## Getting Started

### Prerequisites

- Node.js 18+ (for Jest tests)
- Deno (for Edge Functions)
- Docker (for Supabase local development)
- Supabase CLI

### Initial Setup

1. **Install Dependencies:**

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Install npm dependencies (for testing)
npm install
```

2. **Start Local Supabase:**

```bash
supabase start
```

3. **Get Supabase Credentials:**

```bash
# Get basic credentials
supabase status

# Get JWT secret
supabase status -o json | grep JWT_SECRET
```

4. **Create `.env.local`:**

```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys and Supabase credentials
```

5. **Bootstrap Test Users:**

```bash
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: local-dev-secret-123"
```

6. **Start Development Server:**

```bash
npm run dev
# Function available at http://localhost:54321/functions/v1/enhance
```

---

## Adding New Models

### Step 1: Add Model Configuration

Edit `src/config/models.config.ts`:

```typescript
export const MODELS: readonly ModelConfig[] = [
  // Existing models...

  // Add new model
  {
    id: 'gpt-4-turbo',                      // Internal ID used in API
    provider: 'openrouter',                 // Maps to connector
    providerModelId: 'openai/gpt-4-turbo', // Actual model name for API
    allowedTiers: ['plus', 'premium'],      // Array of tiers with access
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    costPer1kTokens: {
      input: 0.01,
      output: 0.03
    }
  }
];
```

**Key Fields:**
- `id` - Unique identifier for API requests
- `provider` - Must match existing provider ('gemini', 'openrouter', 'lmstudio')
- `providerModelId` - Model ID used in LLM provider's API
- `allowedTiers` - Array of tiers that can access this model ('free', 'plus', 'premium')
- `displayName` - Human-readable name for UI
- `contextWindow` - Maximum context length
- `costPer1kTokens` - Pricing (for reference, not enforced)

### Step 2: Verify Type Safety

```bash
npm run type-check
```

### Step 3: Test the Model

```bash
# Login as user with appropriate tier
TOKEN=$(curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"plus@textenhancer.dev","password":"Plus_User_2025"}' \
  | jq -r '.access_token')

# Test enhancement with new model
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gpt-4-turbo",
      "aiRoleId": "editor",
      "userText": "Test message",
      "options": { "improve": true }
    }]
  }'
```

### Step 4: Add Tests

Create test in `tests/unit/config/models.config.test.ts`:

```typescript
describe('Model: gpt-4-turbo', () => {
  it('should be accessible to plus tier', () => {
    const model = getModelById('gpt-4-turbo');
    expect(model?.allowedTiers).toContain('plus');
  });

  it('should not be accessible to free tier', () => {
    const model = getModelById('gpt-4-turbo');
    expect(model?.allowedTiers).not.toContain('free');
  });
});
```

---

## Adding New AI Roles

### Step 1: Add Role Configuration

Edit `src/config/roles.config.ts`:

```typescript
export const ROLES: readonly RoleConfig[] = [
  // Existing roles...

  // Add new role
  {
    id: 'legal_assistant',
    name: 'Legal Assistant',
    systemPrompt: `You are a legal writing assistant specializing in clear, precise, and formal legal text.

Your expertise includes:
- Drafting contracts and legal documents
- Ensuring precise legal terminology
- Maintaining formal legal tone
- Structuring documents with proper legal formatting
- Avoiding ambiguity in language

Always maintain professional legal standards and clarity.`,
    allowedModels: [
      'gemini-flash',
      'open-router-free',
      'gpt-4-turbo'  // Model restrictions per role
    ]
  }
];
```

**Key Fields:**
- `id` - Unique identifier for API requests
- `name` - Human-readable name for UI
- `systemPrompt` - System prompt sent to LLM (defines role behavior)
- `allowedModels` - Array of model IDs that can be used with this role

**System Prompt Best Practices:**
- Be specific about role expertise
- Define expected behavior
- Include relevant constraints
- Mention output format requirements
- Keep it concise but comprehensive

### Step 2: Verify Type Safety

```bash
npm run type-check
```

### Step 3: Test the Role

```bash
# Test with legal assistant role
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "legal_assistant",
      "userText": "The parties agree to the following terms",
      "options": { "improve": true, "formality": "Formal" }
    }]
  }'
```

### Step 4: Add Tests

Create test in `tests/unit/config/roles.config.test.ts`:

```typescript
describe('Role: legal_assistant', () => {
  it('should exist', () => {
    const role = getRoleById('legal_assistant');
    expect(role).toBeDefined();
  });

  it('should have appropriate system prompt', () => {
    const role = getRoleById('legal_assistant');
    expect(role?.systemPrompt).toContain('legal');
  });

  it('should allow specific models', () => {
    const role = getRoleById('legal_assistant');
    expect(role?.allowedModels).toContain('gemini-flash');
  });
});
```

---

## Adding New LLM Providers

### Step 1: Create Connector

Create `src/connectors/llm-connectors/anthropic-connector.ts`:

```typescript
import type { LLMConnector } from './types.ts';

export class AnthropicConnector implements LLMConnector {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateEnhancement(
    prompt: string,
    modelId: string,
    timeoutMs: number
  ): Promise<{ enhancedText: string; total_tokens: number }> {
    // Implementation with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        enhancedText: data.content[0].text,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

**Key Requirements:**
- Implement `LLMConnector` interface
- Use `fetch` API (not provider-specific SDK if possible)
- Implement timeout with `AbortController`
- Return `{ enhancedText, total_tokens }`
- Handle errors appropriately
- **NO Deno-specific code** (must work in Node.js)

---

### Step 2: Update Factory

Edit `src/connectors/llm-connectors/factory.ts`:

```typescript
import { AnthropicConnector } from './anthropic-connector.ts';

export class LLMConnectorFactory {
  static createAll(config: LLMProvidersConfig): Map<string, LLMConnector> {
    const connectors = new Map<string, LLMConnector>();

    // Existing connectors...

    // Add Anthropic connector
    if (config.anthropic) {
      const connector = new AnthropicConnector(
        config.anthropic.apiKey,
        config.anthropic.baseUrl
      );
      connectors.set('anthropic', connector);
    }

    return connectors;
  }
}
```

---

### Step 3: Update Configuration

Edit `src/config/loader.ts`:

```typescript
export interface LLMProvidersConfig {
  gemini?: GeminiConfig;
  openrouter?: OpenRouterConfig;
  lmstudio?: LMStudioConfig;
  anthropic?: AnthropicConfig;  // Add new provider config
}

export interface AnthropicConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadConfig(): SystemConfig {
  // Existing config loading...

  // Add Anthropic config
  const anthropicConfig: AnthropicConfig | undefined = process.env.ANTHROPIC_API_KEY
    ? {
        apiKey: getEnvVar('ANTHROPIC_API_KEY'),
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
      }
    : undefined;

  return {
    // ...
    llmProviders: {
      gemini: geminiConfig,
      openrouter: openRouterConfig,
      lmstudio: lmStudioConfig,
      anthropic: anthropicConfig
    }
  };
}
```

---

### Step 4: Add Environment Variables

Add to `.env.local.example` and `.env.local`:

```bash
# Anthropic Configuration (Optional)
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1  # Optional
```

---

### Step 5: Add Models

Edit `src/config/models.config.ts`:

```typescript
{
  id: 'claude-3-sonnet',
  provider: 'anthropic',  // Maps to connector
  providerModelId: 'claude-3-sonnet-20240229',
  allowedTiers: ['plus', 'premium'],
  displayName: 'Claude 3 Sonnet',
  contextWindow: 200000,
  costPer1kTokens: { input: 0.003, output: 0.015 }
}
```

---

### Step 6: Add Tests

Create `tests/unit/connectors/anthropic-connector.test.ts`:

```typescript
describe('AnthropicConnector', () => {
  let connector: AnthropicConnector;

  beforeEach(() => {
    connector = new AnthropicConnector('test-key');
  });

  it('should generate enhancement', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Enhanced text' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      })
    });

    const result = await connector.generateEnhancement(
      'Test prompt',
      'claude-3-sonnet-20240229',
      30000
    );

    expect(result.enhancedText).toBe('Enhanced text');
    expect(result.total_tokens).toBe(30);
  });

  it('should handle timeout', async () => {
    // Test timeout implementation
    // ...
  });
});
```

---

## Coding Conventions

### Import Style

**Always use `.js` extension** for local imports (TypeScript quirk):

```typescript
// ✅ CORRECT
import { foo } from './bar.js'
import { baz } from '../utils/helper.js'

// ❌ WRONG
import { foo } from './bar'
```

**Use `npm:` prefix for Deno imports:**

```typescript
// In Deno environment
import { GoogleGenerativeAI } from 'npm:@google/genai';
import { jwtVerify } from 'npm:jose@5';
```

---

### Environment Variables

**Always use `process.env`** (not `Deno.env.get()`):

```typescript
// ✅ CORRECT - works in both Deno and Node.js
const apiKey = process.env.GOOGLE_API_KEY;

// ❌ WRONG - Deno-specific
const apiKey = Deno.env.get('GOOGLE_API_KEY');
```

---

### Error Handling

**Use custom error classes** with codes:

```typescript
// src/errors/custom-error.ts
export class CustomError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 500
  ) {
    super(message);
    this.name = 'CustomError';
  }
}

// Usage
throw new CustomError(
  'INVALID_INPUT',
  'The input provided is invalid',
  400
);
```

---

### Async/Await

**Always use async/await** (not callbacks or `.then()`):

```typescript
// ✅ CORRECT
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}

// ❌ WRONG
function fetchData() {
  return fetch(url)
    .then(response => response.json())
    .catch(error => console.error(error));
}
```

---

### Timeout Pattern

**Always use AbortController** for fetch timeouts:

```typescript
async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### Configuration Pattern

**Use TypeScript modules** (not JSON files):

```typescript
// ✅ CORRECT - src/config/example.config.ts
export const CONFIG = {
  maxRetries: 3,
  timeout: 30000
} as const;

// Type-safe, autocomplete, compile-time checks

// ❌ WRONG - config.json
// {
//   "maxRetries": 3,
//   "timeout": 30000
// }
// No type safety, no autocomplete, runtime parsing
```

---

## Testing Strategies

### Unit Tests (Jest)

**Test individual services and validators:**

```bash
npm test
npm test -- --watch
npm test -- src/services/prompt-builder.test.ts
```

**Example Test:**

```typescript
// tests/unit/services/prompt-builder.test.ts
import { PromptBuilder } from '../../../src/services/prompt-builder';

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  it('should build prompt with improve option', () => {
    const request = {
      aiRoleId: 'editor',
      userText: 'test text',
      options: { improve: true }
    };

    const prompt = builder.buildPrompt(request);

    expect(prompt.systemPrompt).toContain('editor');
    expect(prompt.userPrompt).toContain('improve');
    expect(prompt.userPrompt).toContain('test text');
  });

  it('should throw error for unknown role', () => {
    const request = {
      aiRoleId: 'unknown',
      userText: 'test',
      options: {}
    };

    expect(() => builder.buildPrompt(request)).toThrow();
  });
});
```

---

### Integration Tests

**Test full flow with mocked dependencies:**

```typescript
describe('BatchOrchestrator Integration', () => {
  let orchestrator: BatchOrchestrator;
  let mockLLMConnector: jest.Mock;

  beforeEach(() => {
    mockLLMConnector = jest.fn().mockResolvedValue({
      enhancedText: 'Enhanced text',
      total_tokens: 50
    });

    orchestrator = new BatchOrchestrator(
      /* config with mocked connector */
    );
  });

  it('should process batch successfully', async () => {
    const user = { userId: '123', tier: 'free', tokensAvailable: 10000 };
    const request = {
      assistants: [{
        id: 'test-1',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'test',
        options: { improve: true }
      }]
    };

    const result = await orchestrator.processBatch(user, request);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('success');
  });
});
```

---

### Manual Testing

**Use curl commands for E2E testing:**

```bash
# Test health endpoint
curl http://localhost:54321/functions/v1/enhance/health

# Test authentication
TOKEN=$(curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "Content-Type: application/json" \
  -d '{"email":"free@textenhancer.dev","password":"Free_User_2025"}' \
  | jq -r '.access_token')

# Test enhancement
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

See [Testing Guide](../TESTING_GUIDE.md) for comprehensive testing scenarios.

---

## Best Practices Checklist

Before committing code, verify:

- [ ] No Deno-specific imports in `src/` directory
- [ ] Handler file is under 100 lines
- [ ] All HTTP calls use timeout wrapper
- [ ] Environment variables use `process.env`, not `Deno.env.get()`
- [ ] New features have Jest tests
- [ ] Error classes extend `AppError` with codes
- [ ] Configuration uses TypeScript modules, not JSON files
- [ ] No business logic in handler layer
- [ ] All imports use `.js` extension
- [ ] Type checking passes: `npm run type-check`
- [ ] Tests pass: `npm test`
- [ ] Portability check passes: `npm run lint:portability`

---

## Common Pitfalls

### ❌ Adding Business Logic to Handler

**Wrong:**

```typescript
// supabase/functions/enhance/index.ts
Deno.serve(async (req) => {
  const body = await req.json();

  // ❌ Business logic in handler
  if (body.assistants.length > 10) {
    return new Response('Too many assistants', { status: 400 });
  }

  // ❌ Direct LLM call in handler
  const result = await callGeminiAPI(body);
  return new Response(JSON.stringify(result));
});
```

**Right:**

```typescript
// supabase/functions/enhance/index.ts
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const body = await req.json();

  // ✅ Call core logic
  const result = await orchestrator.processBatch(authHeader, body);
  return new Response(JSON.stringify(result));
});
```

---

### ❌ Using Deno APIs in Core

**Wrong:**

```typescript
// src/config/loader.ts
// ❌ Deno-specific API
const apiKey = Deno.env.get('API_KEY');
```

**Right:**

```typescript
// src/config/loader.ts
// ✅ Platform-agnostic
const apiKey = process.env.API_KEY;
```

---

### ❌ Forgetting Import Extensions

**Wrong:**

```typescript
// ❌ Missing .js extension
import { foo } from './bar';
```

**Right:**

```typescript
// ✅ With .js extension
import { foo } from './bar.js';
```

---

### ❌ Not Implementing Timeouts

**Wrong:**

```typescript
// ❌ No timeout
const response = await fetch(url);
```

**Right:**

```typescript
// ✅ With timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}
```

---

### ❌ Mutating process.env in Tests

**Wrong:**

```typescript
// ❌ No cleanup
test('config test', () => {
  process.env.API_KEY = 'test-key';
  // test code
});
```

**Right:**

```typescript
// ✅ With cleanup
describe('config tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('config test', () => {
    // test code
  });
});
```

---

## Useful Commands

```bash
# Development
supabase start                    # Start local Supabase
npm run dev                       # Serve function with hot reload

# Testing
npm test                          # Run Jest unit tests
npm test -- --watch               # Watch mode
npm test -- --coverage            # Coverage report
npm run type-check                # TypeScript check

# Portability
npm run lint:portability          # Check for Deno code in src/
grep -r "Deno\." src/            # Manual check

# Deployment
npm run setup:env                 # Set environment variables
npm run deploy                    # Deploy to Supabase
npm run health                    # Check deployment health
npm run logs:tail                 # Tail logs in real-time

# Database
supabase db reset                 # Reset database with migrations
```

---

**Related Documentation:**
- [API Reference](./api-reference.md) - Complete API specification
- [Architecture](./architecture.md) - System design and two-layer architecture
- [Configuration](./configuration.md) - Environment variables and settings
- [Testing Guide](../TESTING_GUIDE.md) - Complete testing scenarios
