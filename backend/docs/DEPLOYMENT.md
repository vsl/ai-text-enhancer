# Deployment Guide

## Prerequisites

Before deploying, ensure you have:

- [ ] **Supabase CLI installed**
  ```bash
  brew install supabase/tap/supabase
  ```

- [ ] **Supabase project created**
  - Visit: https://supabase.com/dashboard
  - Create a new project or use existing one
  - Note your project reference ID

- [ ] **Project linked to Supabase**
  ```bash
  supabase link --project-ref YOUR_PROJECT_REF
  ```

- [ ] **Environment variables ready**
  - Copy `.env.local.example` to `.env.local`
  - Fill in all required values

---

## Quick Start Deployment

### 1. Link Supabase Project

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase status
```

### 2. Apply Database Migrations

```bash
# Apply database schema (creates tables, triggers, RLS policies)
supabase db push
```

This creates:
- **Tables:** `user_profiles`, `user_quotas`, `token_purchases`
- **Triggers:** Auto-create profile + quota on user signup
- **RLS Policies:** Row-level security for user data
- **Functions:** `check_user_quota()`, `deduct_tokens()`, `add_tokens()`

Verify migration:
```bash
supabase db diff  # Should show no pending changes
```

### 3. Set Environment Variables

Create `.env.local` with your secrets:

```bash
# Required - Supabase (get from: supabase status or Dashboard)
SUPABASE_URL=http://127.0.0.1:54321                   # Local: from supabase status
                                                       # Production: Auto-provided by Edge Functions
APP_SUPABASE_JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
APP_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Required - LLM Providers
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional - Admin Bootstrap (for creating test users)
BOOTSTRAP_SECRET_KEY=your-bootstrap-secret-key-change-in-production

# Optional - Configuration
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LLM_TIMEOUT_MS=30000
MAX_BATCH_SIZE=10
```

Then set secrets in Supabase:

```bash
npm run setup:env
```

Verify secrets were set:

```bash
supabase secrets list
```

### 4. Run Pre-Deployment Checks

```bash
# Type check
npm run type-check

# Run tests
npm test

# Check platform portability
npm run lint:portability
```

All checks should pass ✅

### 5. Deploy Functions

```bash
npm run deploy
```

This will:
- ✅ Run type checks
- ✅ Run tests
- ✅ Check portability
- ✅ Deploy both Edge Functions (`enhance` and `admin`)
- ✅ Display function URLs

Or deploy manually:
```bash
supabase functions deploy enhance
supabase functions deploy admin
```

### 6. Bootstrap Test Users (Development Only)

Create 6 test users for development and testing:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin/bootstrap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BOOTSTRAP_SECRET_KEY"
```

**Created users:**
| Email | Tier | Tokens | Special |
|-------|------|--------|---------|
| `admin@textenhancer.dev` | Premium | 10,000,000 | Admin privileges |
| `free@textenhancer.dev` | Free | 50,000 | Regular user |
| `plus@textenhancer.dev` | Plus | 500,000 | Regular user |
| `premium@textenhancer.dev` | Premium | 5,000,000 | Regular user |
| `zero@textenhancer.dev` | Free | 0 | For quota testing |
| `blocked@textenhancer.dev` | Free | 10,000 | Blocked status |

**Notes:**
- Bootstrap is **idempotent** - safe to run multiple times
- Requires `BOOTSTRAP_SECRET_KEY` environment variable
- **Production:** Remove or change `BOOTSTRAP_SECRET_KEY`

### 7. Verify Deployment

```bash
# Test enhance function
npm run health

# Test admin function
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin/health
```

Expected response from both:
```json
{"status":"ok","service":"ai-text-enhancer"}
```

---

## Detailed Deployment Steps

### Environment Variable Management

#### Required Variables

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Supabase project URL | Local: `supabase status` → API URL. Production: Auto-provided by Edge Functions (no manual setup needed) |
| `APP_SUPABASE_JWT_SECRET` | JWT signing/verification secret | `supabase status` (local) or Supabase Dashboard → Settings → API → JWT Settings |
| `APP_SUPABASE_SERVICE_ROLE_KEY` | Service role key for server operations | `supabase status` (local) or Supabase Dashboard → Settings → API → `service_role` key |
| `GEMINI_API_KEY` | Google Gemini API key | https://aistudio.google.com/app/apikey |
| `OPENROUTER_API_KEY` | OpenRouter API key | https://openrouter.ai/keys |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOOTSTRAP_SECRET_KEY` | Secret for admin bootstrap endpoint (dev only) | None (bootstrap disabled if not set) |
| `LM_STUDIO_BASE_URL` | LM Studio base URL (local dev) | `http://localhost:1234/v1` |
| `LLM_TIMEOUT_MS` | LLM request timeout in milliseconds | `30000` |
| `MAX_BATCH_SIZE` | Maximum assistants per batch request | `10` |

#### Setting Secrets

**Method 1: Using setup script (Recommended)**
```bash
npm run setup:env
```

**Method 2: Manual**
```bash
supabase secrets set GEMINI_API_KEY="your_key"
supabase secrets set OPENROUTER_API_KEY="your_key"
supabase secrets set APP_SUPABASE_JWT_SECRET="your_jwt_secret"
supabase secrets set APP_SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
supabase secrets set BOOTSTRAP_SECRET_KEY="your_bootstrap_secret"  # Optional
```

**Method 3: Bulk set from file**
```bash
supabase secrets set --env-file .env.local
```

#### Viewing Secrets

```bash
# List all secrets (values are masked)
supabase secrets list

# Unset a secret
supabase secrets unset VARIABLE_NAME
```

---

### Database Setup

#### Schema Overview

The authentication system uses 3 tables with Row Level Security (RLS):

**`user_profiles`** - User information
- `id` (UUID, references `auth.users`)
- `email`, `tier` (free/plus/premium), `is_admin`, `is_active`
- Indexed on: email, tier, is_admin, is_active

**`user_quotas`** - Token balance tracking
- `user_id`, `tokens_available`, `tokens_used`, `last_used_at`
- Wallet/credits model (not daily limits)
- Indexed on: user_id, tokens_available

**`token_purchases`** - Transaction history
- `user_id`, `tokens_added`, `purchase_type`, `amount_paid`, `currency`, `description`
- Types: registration, purchase, admin_grant, bonus
- Indexed on: user_id, purchase_type, created_at

#### Applying Migrations

```bash
# Apply all pending migrations
supabase db push

# View migration status
supabase migration list

# Check for schema drift
supabase db diff
```

#### Database Functions

The migration creates helper functions:

- **`handle_new_user()`** - Trigger on `auth.users` INSERT
  - Auto-creates user profile (free tier)
  - Creates quota record with 50k welcome bonus
  - Records welcome transaction

- **`check_user_quota(user_id, tokens_required)`** - Check quota
  - Returns boolean: sufficient tokens available

- **`deduct_tokens(user_id, tokens_used)`** - Deduct tokens
  - Atomic operation with row locking
  - Updates `tokens_available` and `tokens_used`
  - Returns false if insufficient balance

- **`add_tokens(user_id, tokens, type, description, amount, currency)`**
  - Adds tokens to user balance
  - Records transaction in `token_purchases`

#### Row Level Security (RLS)

**Users can:**
- View their own profile and quota
- View their own purchase history
- Update their own profile (limited fields)

**Admins can:**
- View all profiles, quotas, and purchases
- Update all profiles and quotas

**Service Role:**
- Bypasses all RLS (used for backend operations)
- Required for quota deductions during enhancement requests

---

## Testing Deployment

### Health Check

```bash
# Using script
npm run health

# Or manually
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/enhance/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "ai-text-enhancer"
}
```

### Test Enhancement Endpoint

**Note:** Requires a valid Supabase Auth JWT token. Use one of the bootstrap users or create a user via Supabase Auth.

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "assistants": [{
      "id": "test-1",
      "model": "gemini-flash",
      "aiRoleId": "editor",
      "userText": "This are wrong",
      "options": {
        "fixMistakes": true
      }
    }]
  }'
```

Expected response:
```json
{
  "results": [{
    "id": "test-1",
    "status": "success",
    "enhancedText": "This is wrong",
    "total_tokens": 45
  }]
}
```

### Test Admin Endpoints

**Bootstrap endpoint (development only):**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin/bootstrap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BOOTSTRAP_SECRET_KEY"
```

Expected response:
```json
{
  "message": "Bootstrap completed successfully",
  "usersCreated": 6,
  "users": [...]
}
```

**Admin health check:**
```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin/health
```

Expected response:
```json
{"status":"ok","service":"ai-text-enhancer-admin"}
```

**Get user details (requires admin JWT):**
```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin/users/USER_ID \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

## Monitoring & Logs

### View Recent Logs

```bash
npm run logs
```

### Tail Logs (Live)

```bash
npm run logs:tail
```

### View in Dashboard

Visit: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions`

---

## Local Development

### Start Local Supabase Stack

```bash
# Start all Supabase services locally
supabase start

# This starts:
# - PostgreSQL database
# - PostgREST API
# - Auth server
# - Edge Functions runtime
```

### Serve Function Locally

```bash
npm run dev
```

This will:
- Start Edge Functions runtime
- Load environment from `.env.local`
- Enable hot-reload
- Serve at `http://localhost:54321/functions/v1/enhance`

### Test Local Function

```bash
# Health check
curl http://localhost:54321/functions/v1/enhance/health

# Enhancement request
curl -X POST http://localhost:54321/functions/v1/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token" \
  -d '{"assistants":[...]}'
```

### Stop Local Stack

```bash
supabase stop
```

---

## Troubleshooting

### Deployment Fails

**Issue:** `supabase: command not found`
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Or update if already installed
brew upgrade supabase
```

**Issue:** `Project not linked`
```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Verify link
supabase status
```

**Issue:** `Function deployment failed`
```bash
# Check Supabase CLI version (should be latest)
supabase --version

# Check if you're logged in
supabase login

# Try re-deploying
npm run deploy
```

### Type Check Fails

```bash
# Run type check to see errors
npm run type-check

# Common issues:
# - Missing .js extensions in imports
# - TypeScript configuration issues
# - Missing type definitions
```

### Tests Fail

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- path/to/test.test.ts

# Update snapshots if needed
npm test -- -u
```

### Portability Check Fails

```bash
# Check what failed
npm run lint:portability

# If Deno imports found in src/:
# - Remove Deno.* usage from src/
# - Use process.env instead of Deno.env
# - Use fetch instead of Deno-specific APIs
```

### Function Returns 500

**Check logs:**
```bash
npm run logs
```

**Common issues:**
- Missing environment variables
- Invalid API keys
- User service unavailable
- LLM provider errors

**Verify environment:**
```bash
supabase secrets list
```

### CORS Issues

**Issue:** `Access-Control-Allow-Origin` error

The handler includes CORS headers for all responses. If you still see CORS errors:

1. Check browser console for specific error
2. Verify the origin is allowed in handler
3. Check if preflight OPTIONS request succeeds:
   ```bash
   curl -X OPTIONS https://YOUR_PROJECT_REF.supabase.co/functions/v1/enhance \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST"
   ```

### Connection Timeout

**Issue:** Request times out

Check:
1. Function timeout setting (default 30s)
2. LLM provider timeout (set in config)
3. Network connectivity
4. Supabase service status: https://status.supabase.com

---

## Rollback Procedure

### Method 1: Git-Based Rollback

```bash
# Find previous working commit
git log --oneline

# Checkout previous version
git checkout <commit-hash>

# Redeploy
npm run deploy

# Return to main branch
git checkout main
```

### Method 2: Revert Code Changes

```bash
# Revert to previous commit
git revert HEAD

# Redeploy
npm run deploy
```

### Method 3: Function Version Management

Supabase doesn't have built-in version management, but you can:

1. Keep multiple function directories:
   ```
   functions/
     enhance-v1/
     enhance-v2/
     enhance/  <- current version
   ```

2. Deploy specific version:
   ```bash
   supabase functions deploy enhance-v1
   ```

---

## Production Checklist

Before going to production:

### Security
- [ ] Environment variables set (not hardcoded)
- [ ] JWT verification enabled (if using Supabase Auth)
- [ ] CORS origins restricted (not `*`)
- [ ] API keys rotated and secure
- [ ] Rate limiting configured
- [ ] Input validation enabled

### Performance
- [ ] Timeout values optimized
- [ ] Batch size limits set
- [ ] Caching strategy implemented
- [ ] Monitoring alerts configured

### Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Error handling tested

### Deployment
- [ ] Deployment script works
- [ ] Health check passes
- [ ] Logs accessible
- [ ] Rollback procedure documented
- [ ] Monitoring dashboard set up

### Documentation
- [ ] API documentation updated
- [ ] Environment variables documented
- [ ] Deployment guide reviewed
- [ ] Troubleshooting section complete
- [ ] Team trained on deployment process

---

## Automated Deployment with GitHub Actions

### Overview

The monorepo includes a CI/CD pipeline (`../../.github/workflows/backend.yml`) that:
- ✅ Runs tests and quality checks
- ✅ Syncs environment secrets to Supabase
- ✅ Deploys to Supabase on pushes to `main`
- ✅ Verifies deployment with health check

### How It Works

**Trigger:** Runs only for non-documentation changes under `backend/`. Pull
requests run checks only; pushes to `main` run checks and deploy to production.

**Pipeline Steps:**
1. **Checkout code** - Gets your latest code
2. **Setup Node.js** - Installs Node.js 22 with npm caching
3. **Install dependencies** - Runs `npm ci`
4. **TypeScript type check** - Runs `npm run type-check`
5. **Run tests** - Runs the complete Jest suite
6. **Platform portability check** - Ensures no `Deno.*` in `src/`
7. **Setup Supabase CLI** - Installs the pinned Supabase CLI version
8. **Link project** - Links to your Supabase project
9. **Sync secrets** - Syncs environment variables from GitHub Secrets to Supabase
10. **Apply migrations** - Pushes pending database migrations
11. **Deploy functions** - Deploys all five Edge Functions
12. **Health check** - Verifies the public health endpoints

### Setting Up GitHub Actions

#### Step 1: Navigate to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. You'll see "Repository secrets" section

#### Step 2: Add Required Secrets

Click **"New repository secret"** for each of the following:

| Secret Name | Description | Where to Get It |
|------------|-------------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | Your Supabase personal access token | Go to https://supabase.com/dashboard/account/tokens → "Generate new token" |
| `SUPABASE_PROJECT_ID` | Your Supabase project reference ID | Found in project URL: `https://supabase.com/dashboard/project/[PROJECT_ID]` |
| `APP_SUPABASE_JWT_SECRET` | JWT signing/verification secret | Supabase Dashboard → Settings → API → JWT Settings (or `supabase status`) |
| `APP_SUPABASE_SERVICE_ROLE_KEY` | Service role key for server operations | Supabase Dashboard → Settings → API → `service_role` key |
| `BOOTSTRAP_SECRET_KEY` | Secret protecting the admin bootstrap endpoint | Generate a long random value |
| `GEMINI_API_KEY` | Google Gemini API key | Get from https://aistudio.google.com/app/apikey |
| `OPENROUTER_API_KEY` | OpenRouter API key | Get from https://openrouter.ai/keys |
| `STRIPE_SECRET_KEY` | Stripe server API key | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe Dashboard → Developers → Webhooks |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Stripe Dashboard → Developers → API keys |

#### Step 3: Add Optional Secrets (if needed)

| Secret Name | Description | Default Value |
|------------|-------------|---------------|
| `LLM_TIMEOUT_MS` | LLM request timeout in milliseconds | `30000` |
| `MAX_BATCH_SIZE` | Maximum assistants per batch | `10` |

#### Step 4: Verify Setup

After adding all secrets:
1. Go to **Actions** tab in your repository
2. You should see the **Backend** workflow
3. If no runs yet, make a commit and push to `main`:
   ```bash
   git add .
   git commit -m "Setup CI/CD"
   git push origin main
   ```
4. Watch the workflow run in real-time

### How to Get Supabase Access Token

1. Visit https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Give it a name (e.g., "GitHub Actions CI/CD")
4. Set expiration (optional, "Never" for persistent CI/CD)
5. Click **"Generate token"**
6. **Copy the token immediately** (you can't see it again!)
7. Add it as `SUPABASE_ACCESS_TOKEN` secret in GitHub

### Triggering a Deployment

The workflow has no manual trigger. Commit a backend change to a branch for
checks, then merge it to `main` to deploy.

### Viewing Workflow Results

**While Running:**
- Go to Actions tab → Click on the running workflow
- Watch each step execute in real-time
- See colored output with ✅ or ❌ for each step

**After Completion:**
- ✅ Green checkmark = Success
- ❌ Red X = Failed
- Click on the workflow to see detailed logs
- Failed steps show error messages

### What Happens on Each Push

```
You push to main
     ↓
GitHub Actions triggers
     ↓
Runs all tests (must pass 100%)
     ↓
Syncs your secrets to Supabase
     ↓
Deploys new version
     ↓
Tests health endpoint
     ↓
✅ Live in production!
```

**Total time:** ~2-4 minutes per deployment

### Troubleshooting GitHub Actions

#### ❌ "Authentication failed"
**Problem:** Invalid or expired `SUPABASE_ACCESS_TOKEN`

**Solution:**
1. Generate new token at https://supabase.com/dashboard/account/tokens
2. Update `SUPABASE_ACCESS_TOKEN` secret in GitHub
3. Re-run workflow

#### ❌ "Project not found"
**Problem:** Incorrect `SUPABASE_PROJECT_ID`

**Solution:**
1. Check your project URL: `https://supabase.com/dashboard/project/[THIS_IS_YOUR_ID]`
2. Update `SUPABASE_PROJECT_ID` secret in GitHub
3. Re-run workflow

#### ❌ "Tests failed"
**Problem:** Code has failing tests

**Solution:**
1. Run tests locally: `npm test`
2. Fix failing tests
3. Commit and push again

#### ❌ "Type check failed"
**Problem:** TypeScript errors in code

**Solution:**
1. Run type check locally: `npm run type-check`
2. Fix type errors
3. Commit and push again

#### ❌ "Portability check failed"
**Problem:** Used `Deno.*` in `src/` directory

**Solution:**
1. Run locally: `npm run lint:portability`
2. Remove Deno-specific code from `src/`
3. Use `process.env` instead of `Deno.env`
4. Commit and push again

#### ❌ "Health check failed"
**Problem:** Function deployed but not responding

**Solution:**
1. Check deployment logs: `npm run logs`
2. Verify all secrets are set correctly
3. Check Supabase dashboard for function status
4. May need to redeploy manually: `npm run deploy`

### Disabling Auto-Deployment

If automatic production deployment is no longer wanted, remove the `deploy`
job from `../../.github/workflows/backend.yml`. Keep the pull-request checks.

### Deployment Notifications

**Set up notifications:**
1. Go to GitHub repository → Settings → Notifications
2. Enable notifications for Actions
3. Choose: Email, Slack, or Discord webhooks

**Example: Slack notifications**
Add to your workflow:
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### CI/CD Best Practices

✅ **DO:**
- Keep secrets in GitHub Secrets (never in code)
- Test locally before pushing to `main`
- Use meaningful commit messages
- Monitor workflow runs
- Set up deployment notifications

❌ **DON'T:**
- Commit `.env` files with real credentials
- Push directly to `main` without testing
- Ignore failed workflow runs
- Deploy with failing tests
- Skip the health check step

### Environment-Specific Secrets

For multiple environments (staging/production):

1. Create separate workflows:
   - `.github/workflows/deploy-staging.yml`
   - `.github/workflows/deploy-production.yml`

2. Use environment-specific secrets:
   - `STAGING_SUPABASE_PROJECT_ID`
   - `PROD_SUPABASE_PROJECT_ID`
   - etc.

3. Deploy to different branches:
   - `develop` → staging
   - `main` → production

---

## Support & Resources

### Documentation
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy/docs)
- [Project Architecture](./architecture.md)
- [API Contract](./api-reference.md)

### Common Commands
```bash
# Deployment
npm run deploy              # Deploy to Supabase
npm run setup:env          # Set environment variables
npm run health             # Check function health

# Development
npm run dev                # Start local development server
npm test                   # Run tests
npm run type-check         # Type check

# Monitoring
npm run logs               # View recent logs
npm run logs:tail          # Tail logs (live)

# Supabase
supabase status            # Check Supabase status
supabase functions list    # List all functions
supabase secrets list      # List secrets (masked)
```

### Getting Help

1. **Check logs first:** `npm run logs`
2. **Verify configuration:** `supabase status`
3. **Review documentation:** This guide and project specs
4. **Check Supabase status:** https://status.supabase.com
5. **Open an issue:** GitHub Issues

---

## Next Steps

After successful deployment:

1. **Set up monitoring:** Configure alerts for errors and performance
2. **Load testing:** Test with expected production load
3. **Documentation:** Update team documentation with deployment details
4. **Backup:** Document rollback procedures and test them
5. **Optimization:** Monitor performance and optimize as needed

---

**Deployment complete?** Your AI Text Enhancer Backend is now live! 🎉
