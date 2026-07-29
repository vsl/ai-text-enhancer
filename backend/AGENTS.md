# Backend instructions

- Work in this directory for Supabase migrations, Edge Functions, and core logic.
- Put business logic in `src/`; keep platform-specific request handling in
  `supabase/functions/`.
- Do not use `Deno.*` in `src/`.
- Use Node.js 22 and the committed npm lockfile.
- Run `npm run type-check`, `npm test -- --runInBand`, and
  `npm run lint:portability` before handing off backend changes.
- Never commit secrets. Keep service-role and provider keys server-side.
- Create schema changes with the Supabase CLI and keep migrations in
  `supabase/migrations/`.
- Update the UI in the same change when the API contract changes.

See `CLAUDE.md` and `docs/` for detailed architecture and feature documentation.
