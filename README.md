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

See [Repository and deployment setup](docs/getting-started.md) for the initial
Supabase, GitHub, and Cloudflare configuration.

## Cloudflare Pages

Connect this GitHub repository to Cloudflare Pages with:

- Production branch: `main`
- Root directory: `ui`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Environment variable `NODE_VERSION`: `22`
- Build watch include path: `ui/*`
- Build watch exclude path: `ui/*.md`

Add the three `NEXT_PUBLIC_*` variables above to both Cloudflare environments:
Production uses production Supabase values and Preview uses staging Supabase
values.

The build-watch path prevents backend-only commits from starting a Pages build.
The previous GitHub Pages workflow is not included in this monorepo. Disable
the old GitHub Pages project only after the Cloudflare `*.pages.dev` deployment
is verified.

## GitHub Actions

- `.github/workflows/ui.yml` tests and builds only for non-documentation changes
  under `ui/`.
- `.github/workflows/backend.yml` checks only non-documentation changes under
  `backend/`. Pull requests validate and deploy to staging; changes merged to
  `main` validate and deploy to production.

Never push directly to `main`. Work on an `agent/*` branch and open a pull
request; only the repository owner merges it.
