# Platform Migration Overview

The AI Text Enhancer Backend is designed for **platform portability**. The two-layer architecture enables migration between serverless platforms with minimal effort.

## Architecture Review

```
┌─────────────────────────────────────┐
│  HANDLER LAYER (50-100 lines)       │  ← Platform-specific
│  - Supabase: index.ts               │     REWRITE for new platform
│  - AWS Lambda: lambda.ts            │
│  - Cloudflare: worker.ts            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  CORE LOGIC (src/ directory)        │  ← Platform-agnostic
│  - Services                          │     NO CHANGES NEEDED
│  - Configuration                     │
│  - Connectors                        │
│  - Utilities                         │
└─────────────────────────────────────┘
```

## Migration Time Estimates

| Platform | Estimated Time | Confidence |
|----------|---------------|------------|
| AWS Lambda | 4-8 hours | High |
| Cloudflare Workers | 6-10 hours | High |
| Vercel Edge | 4-6 hours | Medium |
| Netlify Functions | 6-8 hours | Medium |
| Google Cloud Run | 8-12 hours | Medium |

**Factors affecting time:**
- Developer experience with target platform
- Deployment automation setup
- Testing requirements
- CI/CD configuration

## What Changes During Migration

### ✅ NO CHANGES (Platform-Agnostic)

These stay **exactly the same**:

- **All of `src/` directory**
  - Services (auth, orchestration, quota, etc.)
  - Configuration (models, roles, loader)
  - LLM connectors (Gemini, OpenRouter)
  - Error handling
  - Utilities
  - Type definitions

- **Tests**
  - All Jest tests continue to work
  - Test coverage remains valid

- **Business Logic**
  - Prompt engineering
  - Batch processing
  - Token management
  - Authorization

### ⚠️ REWRITE (Platform-Specific)

Only the **thin handler** changes:

- **Current:** `supabase/functions/enhance/index.ts` + `handler.ts` (~150 lines)
- **New:** `<platform>/handler.ts` (~50-100 lines)

What the new handler does:
1. Extract request data from platform's event format
2. Call core logic services (unchanged)
3. Format response in platform's expected format

### 🔧 UPDATE (Configuration)

Deployment configuration needs updating:

- **Environment variables:** Set in new platform's dashboard/CLI
- **Build config:** Platform-specific deployment files
- **CI/CD:** Update deployment pipeline

## Migration Checklist

Use this for any platform migration:

### Pre-Migration
- [ ] Review target platform documentation
- [ ] Understand platform's request/response format
- [ ] Verify platform supports TypeScript/JavaScript
- [ ] Check environment variable management
- [ ] Confirm timeout limits (≥30 seconds recommended)
- [ ] Review cold start characteristics

### Implementation
- [ ] Create new handler file (~50-100 lines)
- [ ] Extract request data (body, headers, auth token)
- [ ] Call core services (no modifications needed)
- [ ] Format response for platform
- [ ] Handle platform-specific CORS
- [ ] Add health check endpoint

### Configuration
- [ ] Set up deployment configuration
- [ ] Configure environment variables
- [ ] Set up secrets management
- [ ] Configure timeout settings
- [ ] Set up logging/monitoring

### Testing
- [ ] Unit tests still pass (no changes needed)
- [ ] Integration tests work with new handler
- [ ] Manual E2E testing on new platform
- [ ] Load testing
- [ ] Error handling verification

### Deployment
- [ ] Set up CI/CD pipeline
- [ ] Deploy to staging environment
- [ ] Verify health endpoint
- [ ] Test enhancement endpoint
- [ ] Monitor logs for errors
- [ ] Performance testing

### Documentation
- [ ] Update deployment guide
- [ ] Document environment setup
- [ ] Update README with new platform info
- [ ] Document any platform-specific quirks

## Platform-Specific Guides

Detailed migration guides for specific platforms:

1. **[AWS Lambda](./AWS_LAMBDA.md)** - Migrate to AWS Lambda + API Gateway
2. **[Cloudflare Workers](./CLOUDFLARE_WORKERS.md)** - Migrate to Cloudflare Workers
3. **[Vercel Edge](./VERCEL_EDGE.md)** - Migrate to Vercel Edge Functions *(coming soon)*

## Why This Architecture?

### Traditional Approach (Tightly Coupled)
```typescript
// ❌ Platform-specific code throughout
import { serve } from "https://deno.land/std/http/server.ts";

export async function handler(req: Request) {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  // Business logic mixed with Deno APIs
  // Hundreds of lines of platform-specific code
}
```

**Migration impact:** Rewrite 100% of code

### Our Approach (Two-Layer)
```typescript
// ✅ Handler: ~50 lines, platform-specific
import { handleRequest } from './core/service.js';

Deno.serve(async (req) => {
  const body = await req.json();
  const token = req.headers.get('Authorization');
  const result = await handleRequest(body, token);
  return new Response(JSON.stringify(result));
});

// ✅ Core: 100% platform-agnostic
export async function handleRequest(body, token) {
  const geminiKey = process.env.GEMINI_API_KEY;
  // All business logic
  // Zero platform-specific code
}
```

**Migration impact:** Rewrite ~50 lines (handler only)

## Validation

### How We Ensure Portability

1. **No Deno APIs in Core:**
   ```bash
   npm run lint:portability
   # Fails if Deno.* found in src/
   ```

2. **Jest Tests in Node.js:**
   - All core logic tested in Node.js environment
   - Proves code runs outside Deno
   - Validates platform independence

3. **Standard APIs Only:**
   - `fetch()` - Universal HTTP client
   - `process.env` - Standard environment access
   - Standard TypeScript/JavaScript
   - npm packages (no Deno-specific imports)

## Common Migration Pitfalls

### ❌ Avoid These Mistakes

1. **Using platform APIs in core logic:**
   ```typescript
   // ❌ DON'T
   const key = Deno.env.get("API_KEY");
   
   // ✅ DO
   const key = process.env.API_KEY;
   ```

2. **Framework lock-in:**
   ```typescript
   // ❌ DON'T
   import { Router } from "express";
   
   // ✅ DO
   // Use minimal routing in handler, keep logic in core
   ```

3. **Skipping tests:**
   - Always run full test suite after migration
   - Jest tests validate core logic portability

4. **Forgetting timeout configuration:**
   - Ensure new platform supports 30+ second timeouts
   - LLM requests can take time

## Performance Considerations

### Cold Starts

Different platforms have different cold start characteristics:

| Platform | Cold Start | Warm Start |
|----------|-----------|------------|
| Supabase Edge | ~100-300ms | ~10-50ms |
| AWS Lambda | ~500-1000ms | ~5-20ms |
| Cloudflare Workers | ~0-10ms | ~0-5ms |
| Vercel Edge | ~50-150ms | ~5-20ms |

**Optimization strategies:**
- Minimize dependencies in handler
- Use lazy loading for heavy modules
- Keep handlers thin (we do this!)
- Consider platform-specific optimizations

### Resource Limits

Check target platform limits:

| Resource | Requirement | Check In |
|----------|-------------|----------|
| Execution time | ≥30s | Platform docs |
| Memory | ≥256MB | Platform docs |
| Request size | ≥1MB | API contract |
| Response size | ≥1MB | API contract |
| Concurrent requests | ~100+ | Load testing |

## Cost Comparison

Rough cost estimates (may vary):

| Platform | Free Tier | Cost per 1M requests | Notes |
|----------|-----------|---------------------|-------|
| Supabase Edge | 500K/month | ~$2 | Generous free tier |
| AWS Lambda | 1M/month | ~$0.20 | + API Gateway costs |
| Cloudflare Workers | 100K/day | ~$0.50 | Ultra-low latency |
| Vercel Edge | Varies | ~$40 | Per-team pricing |

## Decision Matrix

When to migrate to each platform:

### AWS Lambda
**Choose if:**
- Already using AWS ecosystem
- Need deep AWS integration
- Enterprise compliance requirements

**Avoid if:**
- Need ultra-low cold starts
- Global edge distribution critical

### Cloudflare Workers
**Choose if:**
- Need global edge distribution
- Ultra-low latency critical
- High request volume

**Avoid if:**
- Need long execution times (>30s)
- Require large memory (>128MB)

### Vercel Edge
**Choose if:**
- Already using Vercel
- Next.js integration
- Rapid deployment needs

**Avoid if:**
- Cost-sensitive (free tier limits)
- Need precise control

## Support & Questions

For migration help:

1. **Review architecture:** [CORE_ARCHITECTURE.md](../../spec/CORE_ARCHITECTURE.md)
2. **Check API contract:** [CORE_API_CONTRACT.md](../../spec/CORE_API_CONTRACT.md)
3. **Platform guides:** See individual migration guides in this directory
4. **Open an issue:** GitHub Issues

## Contributing

Migrated to a new platform? Consider contributing a guide!

1. Follow the checklist above
2. Document platform-specific quirks
3. Share handler implementation example
4. Create PR with migration guide

---

**Ready to migrate?** Choose your target platform and follow the detailed guide! 🚀
