# Deployment Scripts

This directory contains automation scripts for deploying and managing the AI Text Enhancer Backend on Supabase Edge Functions.

## Available Scripts

### 🔧 `setup-env.sh`
**Purpose:** Set environment variables in Supabase

**Usage:**
```bash
./scripts/setup-env.sh
# or
npm run setup:env
```

**What it does:**
- Checks if Supabase CLI is installed
- Checks if project is linked
- Loads variables from `.env.local`
- Sets each variable as a secret in Supabase
- Displays confirmation for each variable

**Requirements:**
- Supabase CLI installed
- Project linked (`supabase link`)
- `.env.local` file with your secrets

---

### 🚀 `deploy.sh`
**Purpose:** Deploy the Edge Function to Supabase

**Usage:**
```bash
./scripts/deploy.sh
# or
npm run deploy
```

**What it does:**
1. Checks Supabase CLI installation
2. Verifies project is linked
3. Runs type check (`tsc --noEmit`)
4. Runs tests (`npm test`)
5. Checks platform portability (no Deno in `src/`)
6. Deploys function to Supabase
7. Displays function URL

**Exit codes:**
- `0`: Success
- `1`: CLI not installed, project not linked, or checks failed

---

### 📊 `logs.sh`
**Purpose:** View Edge Function logs

**Usage:**
```bash
# View recent logs
./scripts/logs.sh
# or
npm run logs

# Tail logs (live streaming)
./scripts/logs.sh --tail
# or
npm run logs:tail
```

**What it does:**
- Shows recent function invocation logs
- Can stream logs in real-time with `--tail`
- Displays timestamps, log levels, and messages

---

### 🏥 `health-check.sh`
**Purpose:** Verify function deployment and health

**Usage:**
```bash
# Auto-detect URL
./scripts/health-check.sh
# or
npm run health

# Specify URL
./scripts/health-check.sh https://YOUR_PROJECT_REF.supabase.co
```

**What it does:**
- Makes request to `/health` endpoint
- Checks HTTP status code
- Displays response body
- Returns exit code 0 (success) or 1 (failure)

**Expected response:**
```json
{
  "status": "ok",
  "service": "ai-text-enhancer"
}
```

---

## Prerequisites

All scripts require:

1. **Supabase CLI installed:**
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Project linked:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Environment file (for setup-env.sh):**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your values
   ```

---

## Workflow Example

### Initial Setup

```bash
# 1. Link to Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# 2. Create .env.local
cp .env.local.example .env.local
# Edit .env.local with actual values

# 3. Set environment variables
npm run setup:env

# 4. Verify secrets
supabase secrets list
```

### Deploy

```bash
# Deploy function
npm run deploy

# Verify deployment
npm run health

# Check logs
npm run logs
```

### Monitor

```bash
# View recent logs
npm run logs

# Stream logs live
npm run logs:tail

# Check health periodically
npm run health
```

---

## Local Development

For local development, use the Supabase CLI directly:

```bash
# Start local Supabase stack
supabase start

# Serve function locally
npm run dev

# Function available at:
# http://localhost:54321/functions/v1/enhance
```

---

## Troubleshooting

### Script won't execute
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

### "Command not found: supabase"
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Or update existing installation
brew upgrade supabase
```

### "Project not linked"
```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Verify
supabase status
```

### Environment variables not set
```bash
# Check if .env.local exists
ls -la .env.local

# Run setup again
npm run setup:env

# Verify
supabase secrets list
```

### Deployment fails
```bash
# Check TypeScript errors
npm run type-check

# Check test failures
npm test

# Check portability
npm run lint:portability

# Check logs for errors
npm run logs
```

---

## CI/CD Integration

These scripts can be used in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Deploy to Supabase
  run: ./scripts/deploy.sh
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

For automated deployments, ensure:
- `SUPABASE_ACCESS_TOKEN` is set as environment variable
- Project reference is configured
- All tests pass before deployment

---

## Script Maintenance

When modifying scripts:

1. **Test locally first:** Run on your machine before committing
2. **Handle errors:** Use `set -e` to exit on errors
3. **Add validation:** Check prerequisites before running
4. **Document changes:** Update this README
5. **Keep it simple:** Shell scripts should be straightforward

---

## Additional Resources

- [Deployment Guide](../docs/DEPLOYMENT.md) - Full deployment documentation
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli) - Official CLI docs
- [Edge Functions Guide](https://supabase.com/docs/guides/functions) - Edge Functions documentation

---

**Questions?** Check the [Deployment Guide](../docs/DEPLOYMENT.md) or open an issue.
