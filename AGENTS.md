# AI Text Enhancer

This is one Git repository containing two applications:

- `ui/`: Next.js static export deployed to Cloudflare Pages.
- `backend/`: Supabase migrations and Edge Functions.

Follow the nearest `AGENTS.md`: `ui/AGENTS.md` for UI work and
`backend/AGENTS.md` for backend work. The older `CLAUDE.md` files are detailed
reference documents, not Codex instructions.

When an API contract changes, update and verify both applications in the same
change. Do not make an unrelated app change just to trigger its workflow.

## Product and prompt quality

The product sends one input through multiple configurable AI assistants in
parallel so users can compare specialized results and reuse the best one.
Saved workflows should remove repeated prompt writing and make recurring text
work faster and more consistent.

- Treat each role prompt as product behavior. It must define distinct expertise,
  a clear primary task, role-specific quality criteria, and the expected result.
- Keep shared safety, input-boundary, and output-format rules centralized and
  concise. Do not shorten role prompts merely to make the overall prompt lean.
- Treat enabled options as additive transformations. Disabled options must not
  remove behavior inherent to a role, such as summarizing or producing a
  complete email.
- Prompt changes must include regression coverage for every affected role and
  option, including the no-options case.

## Code Review Rules

### Prompt quality regressions

- Flag a prompt change that replaces a role's expertise, task, quality criteria,
  or required result with a generic one-line instruction. Safe path: keep the
  shared policy lean while preserving a detailed, distinct role prompt and
  additive option behavior.

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
