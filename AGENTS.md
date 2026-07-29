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

## Deployment

- `.github/workflows/ui.yml` checks UI changes only.
- Cloudflare Pages builds `ui/` changes from `main` and publishes `ui/out/`.
- `.github/workflows/backend.yml` checks backend changes and deploys them from
  `main` to production Supabase.
