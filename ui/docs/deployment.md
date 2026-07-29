# Cloudflare Pages Deployment

The UI is a static Next.js export deployed from the monorepo through Cloudflare's Git integration.

## Project settings

Connect `vsl/ai-text-enhancer` and configure:

- Production branch: `main`
- Root directory: `ui`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Node version: `22`
- Build watch include path: `ui/*`
- Build watch exclude path: `ui/*.md`

The build-watch path is required for this monorepo. Without it, Cloudflare
Pages builds on backend-only commits too.

## Environment variables

Add the same values to both Production and Preview:

- `NEXT_PUBLIC_APP_SUPABASE_URL`
- `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

These values are embedded in the browser build. The Supabase anon key must be the public anon key, never a service-role key.

## Verification

1. Push a UI change and confirm the `UI` GitHub Actions workflow succeeds.
2. Confirm the production deployment succeeds.
3. Open the generated `*.pages.dev` URL.
4. Verify sign-in, profile loading, text enhancement, and checkout navigation.
5. Verify a pull request receives a working preview deployment.
6. Push a backend-only change and confirm Cloudflare skips the UI build.
7. Disable the old GitHub Pages project after the new deployment is accepted.
