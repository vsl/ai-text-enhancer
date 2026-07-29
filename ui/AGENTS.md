# UI instructions

- Work in this directory for Next.js UI changes.
- Use Node.js 22 and the committed npm lockfile.
- Run `npm test -- --runInBand` and `npm run build` before handing off UI changes.
- Keep the app compatible with static export; production output is `out/`.
- Use only `NEXT_PUBLIC_APP_SUPABASE_URL`, `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY`,
  and `NEXT_PUBLIC_API_BASE_URL` in browser code. Never expose a service-role key.
- Production and Cloudflare preview builds intentionally use the production
  Supabase backend.
- Update the backend in the same change when the API contract changes.

See `CLAUDE.md` and `docs/` for detailed architecture and feature documentation.
