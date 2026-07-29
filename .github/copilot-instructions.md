# Repository instructions

This monorepo contains a Next.js static UI in `ui/` and a Supabase backend in
`backend/`. Follow the nearest `AGENTS.md` and keep changes scoped to the
application being modified. Coordinate API contract changes across both apps.

Use Node.js 22, committed npm lockfiles, and never commit environment files or
secrets.

Never commit or push directly to `main`. Work on an `agent/*` branch, open a
pull request, and leave approval and merging to the repository owner.
