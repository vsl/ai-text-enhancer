# UI

Next.js static export for the anonymous text-enhancement demo. The app keeps
workflows in browser storage, submits enabled assistants as one backend request,
and displays all results with an optional Jev selection. It does not stream results
or include account, pricing, theme-switching or payment screens.

Use Node.js 22 and run from the repository root:

```bash
npm --prefix ui ci
cp ui/.env.local.example ui/.env.local
# Fill all three public environment values before starting or building.
npm --prefix ui run dev
npm --prefix ui run type-check
npm --prefix ui test -- --runInBand
npm --prefix ui run build
npm --prefix ui run test:e2e
```

`src/config/` owns public catalogs, defaults, messages, site settings and required
build-time environment values. `src/lib/enhance-api.ts` translates UI options to
the shared backend contract. Context providers manage session and workflow state;
components render that state. Stored JSON is validated before it becomes workflow
state. Previous role-label storage formats are not migrated.

Jest tests live in `__tests__/unit/` and `__tests__/integration/`; browser tests
live in `e2e/`. The build produces `out/` for Cloudflare Pages. `next start` is not
part of the static hosting workflow.

See [architecture](../docs/architecture.md), [configuration](../backend/docs/configuration.md),
[testing](../docs/testing.md), and [Pages deployment](docs/deployment.md).
