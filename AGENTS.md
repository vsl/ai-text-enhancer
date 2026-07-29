# AI Text Enhancer

This directory is one Git repository containing two applications:

- `ui/`: Next.js static export deployed to Cloudflare Pages.
- `backend/`: Supabase migrations and Edge Functions.

Before changing an application, read its `CLAUDE.md` for architecture and conventions. When an API contract changes, update and verify both applications in the same change.

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

- Cloudflare Pages builds `ui/` from `main` with `npm run build` and publishes `out/`.
- GitHub Actions deploys `backend/` to Supabase only when backend files change.
