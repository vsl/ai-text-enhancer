# AI Text Enhancer Backend - Copilot Instructions

## Project Architecture: Two-Layer Design for Platform Portability

This is **NOT a typical serverless API**—it's architecturally split into two layers to enable migration between serverless platforms (Supabase → AWS Lambda → Cloudflare Workers) in 4-8 hours.

### Layer 1: Handler (Platform-Specific) - `supabase/functions/enhance/index.ts`
- **Must be <100 lines** with ZERO business logic
- **Can use**: `Deno.*`, `Request`, `Response` objects
- **Only handles**: Extract request → Call core → Format response
- **Migration impact**: This file gets rewritten; everything else stays

### Layer 2: Core Logic (Platform-Agnostic) - `src/` directory
- **Contains**: 100% of business logic in standard TypeScript
- **Cannot use**: `Deno.*` or any platform-specific APIs
- **Must use**: `fetch`, `process.env`, npm packages via `npm:` prefix
- **Validation**: Testable with Jest in Node.js (validates portability)

**Critical**: If adding code, ask "Does this belong in the thin handler or core logic?" Business logic always goes in `src/`.

---

## Configuration System Pattern

All config is **TypeScript modules** (not JSON) in `src/config/`:

- **`loader.ts`**: Loads environment variables with `getEnvVar()` helper—throws on missing required vars
- **`models.config.ts`**: Single source of truth for LLM models (provider, tier, context window, pricing)
- **`roles.config.ts`**: AI personas with system prompts and allowed models
- **`validator.ts`**: Validates complete config object structure

**Key insight**: Models define `allowedTiers` array (`['free', 'plus', 'premium']`) which gates user access. A model can be accessible to multiple tiers. Roles define `allowedModels` array to restrict which models a role can use.

Example model definition pattern:
```typescript
{
  id: 'gemini-1.5-flash',
  provider: 'gemini',
  providerModelId: 'gemini-1.5-flash',  // What the actual API expects
  allowedTiers: ['free', 'plus', 'premium'],  // Array of tiers that can use this model
  displayName: 'Gemini 1.5 Flash',
  contextWindow: 1000000,
  costPer1kTokens: { input: 0.00, output: 0.00 },
}
```

Access via: `getModelById('gemini-1.5-flash')` or `getModelsByTier('plus')`

---

## Build, Test, and Deployment Commands

```bash
# Core logic testing (Node.js via Jest)
npm test                    # Run all unit tests
npm test -- --watch         # Watch mode
npm run test:coverage       # Generate coverage report

# Type checking
npm run type-check          # TypeScript compiler check

# Portability validation
npm run lint:portability    # Ensures no Deno.* in src/

# Local development (Supabase)
supabase start              # Start local Supabase stack
supabase functions serve enhance --env-file .env.local

# Deployment
supabase functions deploy enhance
supabase secrets set KEY=value
```

**Testing strategy**: Jest tests the platform-agnostic `src/` code in Node.js—this validates the portability claim. E2E tests (future) validate the full Deno handler.

---

## API Request Flow & Data Models

Single endpoint: `POST /functions/v1/enhance` with Bearer token auth.

**Request structure**:
```typescript
{
  assistants: [{
    id: string,              // Client-side unique ID
    model: string,           // From models.config.ts (e.g., 'gemini-1.5-flash')
    aiRoleId: string,        // From roles.config.ts (e.g., 'grammar-corrector')
    userText: string,        // Max 500 chars
    contextText?: string,    // Max 800 chars
    options: {
      improve?: boolean,
      fixMistakes?: boolean,
      shorten?: boolean,     // Mutually exclusive with lengthen
      lengthen?: boolean,
      formality?: 'Casual' | 'Neutral' | 'Formal',
      tone?: string,
      languageLevel?: 'default' | 'simple' | 'intermediate' | 'advanced' | 'fluent' | 'native',
      translateTo?: string,  // ISO language code
      addEmojis?: boolean,
    }
  }]  // 1-10 items max
}
```

**Response structure**:
```typescript
{
  results: [{
    id: string,              // Matches request assistant.id
    status: 'success' | 'error',
    enhancedText?: string,
    total_tokens?: number,
    error?: { code: string, message: string }
  }]
}
```

**Processing flow**:
1. Validate Bearer token with external User Service → get user tier
2. Validate request schema (Ajv)
3. Check token balance (pre-flight)
4. Process all assistants in parallel with `Promise.allSettled`
5. For each assistant: Build prompt → Route to LLM provider → Parse response
6. Deduct tokens from user balance (post-flight)
7. Return aggregated results (partial failures OK)

---

## Key Patterns & Conventions

### Import Style
- Use `.js` extensions in imports: `import { foo } from './bar.js'`
- Path alias: `@/` maps to `src/`
- For Deno: npm packages use `npm:` prefix (e.g., `import Ajv from 'npm:ajv'`)

### Error Handling
- Custom error classes in `src/errors/`
- All errors have `code` and `message` properties
- Timeout enforcement: 30 seconds per LLM call using `AbortController`
- Partial batch failures: Individual task errors don't block other tasks

### Validation
- **Request/Response**: Ajv JSON schemas in `src/schemas/`
- **Configuration**: Dedicated validator in `src/config/validator.ts`
- Validation happens early in request pipeline

### Testing Patterns
- Unit tests in `tests/unit/` mirror `src/` structure
- Mock external services (User Service, LLM APIs)
- Use `process.env` manipulation for config tests (see `loader.test.ts`)
- Setup/teardown with `beforeEach`/`afterAll` to restore env

---

## Critical Implementation Details

### LLM Connector Interface
All connectors in `src/connectors/llm-connectors/` must implement:
```typescript
generateEnhancement(
  prompt: string,
  modelId: string,
  timeoutMs: number
): Promise<{ enhancedText: string; total_tokens: number }>
```

Current providers: Google Gemini (SDK), OpenRouter (REST), LM Studio (local dev)

### Token Management TODOs
See `spec/technical_debt.md` for known limitations:
- **UserServiceClient** methods (`validateUser`, `deductTokens`) are currently mocked
- **Gemini token counting** hardcoded to 0 (API doesn't expose counts reliably)
- Both need real implementations before production

### Prompt Engineering Strategy
Prompts are two-part:
1. **System prompt**: From role config (e.g., "You are a grammar correction expert...")
2. **User prompt**: Generated from options + userText + contextText

Key requirement: Always enforce JSON-only response format for structured parsing.

---

## Documentation Hierarchy

For understanding features:
1. **Quick start**: `spec/quick_reference.md` (developer commands)
2. **Big picture**: `spec/CORE_ARCHITECTURE.md` (system design)
3. **API details**: `spec/CORE_API_CONTRACT.md` (request/response formats)
4. **Compact context**: `spec/small/CORE_CONTEXT.md` (for LLM prompts)
5. **Known issues**: `spec/technical_debt.md` (TODOs and limitations)

For implementing features:
- Numbered prompts in `prompts/` (00-10) guide sequential implementation
- Task breakdowns in `spec/small/tasks/`

---

## When Adding New Features

1. **Determine layer**: Handler logic or core logic?
2. **Check portability**: No `Deno.*` in `src/`—run `npm run lint:portability`
3. **Update config**: New models → `models.config.ts`, new roles → `roles.config.ts`
4. **Add tests**: Jest unit tests in `tests/unit/` matching `src/` structure
5. **Validate types**: Run `npm run type-check`
6. **Update docs**: Reflect changes in relevant spec files

---

## Common Pitfalls

- ❌ Adding business logic to `supabase/functions/enhance/index.ts`
- ❌ Using `Deno.*` APIs anywhere in `src/`
- ❌ Forgetting `.js` extensions in imports
- ❌ Mutating `process.env` without cleanup in tests
- ❌ Assuming all batch tasks succeed (use `Promise.allSettled`)
- ❌ Not enforcing timeouts on external API calls
