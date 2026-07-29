# AI Text Enhancer

This is one Git repository containing two applications:

- `ui/`: Next.js static export deployed to Cloudflare Pages.
- `backend/`: Supabase migrations and Edge Functions.

Follow the nearest `AGENTS.md`: `ui/AGENTS.md` for UI work and
`backend/AGENTS.md` for backend work. The older `CLAUDE.md` files are detailed
reference documents, not Codex instructions.

When an API contract changes, update and verify both applications in the same
change. Do not make an unrelated app change just to trigger its workflow.

## Commands

Run from the repository root:

```bash
npm --prefix ui ci
npm --prefix ui test -- --runInBand
npm --prefix ui run build

npm --prefix backend ci
npm --prefix backend test -- --runInBand
npm --prefix backend run type-check
npm --prefix backend run lint:portability
```

Use Node.js 22. Never commit `.env` files or secrets.

## Git workflow

- Never commit or push directly to `main`.
- Create an `agent/<short-description>` branch and open a pull request to
  `main`.
- Only the repository owner approves and merges pull requests.
- Keep documentation-only changes documentation-only; do not edit application
  code merely to trigger a workflow.

## Deployment

- `.github/workflows/ui.yml` checks UI changes only.
- Cloudflare Pages publishes UI pull requests as previews using staging
  Supabase, and publishes `main` using production Supabase.
- `.github/workflows/backend.yml` deploys backend pull requests to staging and
  backend changes on `main` to production.
- A UI-only pull request reuses the current shared staging backend.

See `docs/getting-started.md` for platform setup and the GitHub Free
limitations.
