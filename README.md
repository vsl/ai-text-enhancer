# AI Text Enhancer

Monorepo for the AI Text Enhancer web application and Supabase backend.

## Structure

- `ui/` — Next.js static application
- `backend/` — Supabase migrations and Edge Functions

Both applications use Node.js 22 and keep separate dependencies and lockfiles.

## Local development

```bash
npm --prefix ui ci
npm --prefix backend ci

npm --prefix ui run dev
npm --prefix backend run dev
```

Create `ui/.env.local` with:

```dotenv
NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

See `backend/.env.local.example` for backend development variables. Do not commit environment files or secrets.

## Cloudflare Pages

Connect this GitHub repository to Cloudflare Pages with:

- Production branch: `main`
- Root directory: `ui`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Node version: `22`

Add the three `NEXT_PUBLIC_*` variables above to both Production and Preview environments. Preview deployments intentionally use the production Supabase backend.

The previous GitHub Pages workflow is not included in this monorepo. Disable the old GitHub Pages project only after the Cloudflare `*.pages.dev` deployment is verified.

## Supabase deployment

`.github/workflows/deploy-backend.yml` deploys the backend when `backend/**` changes on `main`.

Before the first backend change, copy these GitHub Actions secrets to this repository:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `APP_SUPABASE_JWT_SECRET`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `BOOTSTRAP_SECRET_KEY`
- `LLM_TIMEOUT_MS`
- `MAX_BATCH_SIZE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
