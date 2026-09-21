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

## Docker development

The development image includes Node.js 22, Git, the Supabase CLI, and Chromium
with the Linux libraries required by Playwright. It uses the shared staging
Supabase backend; it does not start a local Supabase stack.

Copy the UI environment template and replace its placeholders with the staging
project URL and publishable key. Never put service-role, database, Stripe, or
LLM secrets in this file.

```bash
cp ui/.env.local.example ui/.env.local
docker build -t ai-text-enhancer-dev .
```

Podman uses the same Dockerfile. Replace `docker` with `podman` in these
commands if that is your installed container runtime:

```bash
podman build -t ai-text-enhancer-dev .
```

On macOS or Linux, open the development shell with:

```bash
docker run --rm -it \
  --user "$(id -u):$(id -g)" \
  --env npm_config_cache=/tmp/npm-cache \
  -p 3000:3000 \
  --env-file ui/.env.local \
  --mount type=bind,source="$(pwd)",target=/workspace \
  ai-text-enhancer-dev
```

The `--user` option keeps files created through the bind mount owned by your
host account. This is required by rootless runtimes such as Podman.

In PowerShell, use:

```powershell
docker run --rm -it `
  -p 3000:3000 `
  --env-file ui/.env.local `
  --mount "type=bind,source=$($PWD.Path),target=/workspace" `
  ai-text-enhancer-dev
```

Inside the container, install the locked dependencies and start the UI:

```bash
npm --prefix ui ci
npm --prefix backend ci
npm --prefix ui run dev -- --hostname 0.0.0.0
```

Then open <http://localhost:3000>. The bind mount keeps source edits and the
Linux `node_modules` directories in the checkout. Use them only inside Docker.
Run `npm ci` again after a lockfile changes; use `npm install <package>` only
when intentionally changing dependencies.

Run project checks from the same container shell:

```bash
npm --prefix ui test -- --runInBand
npm --prefix ui run build
npm --prefix ui run test:e2e

npm --prefix backend test -- --runInBand
npm --prefix backend run type-check
npm --prefix backend run lint:portability
```

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
