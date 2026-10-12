# Testing and verification

Use Node.js 22 and committed npm lockfiles. Run from the repository root:

```bash
npm --prefix ui ci
npm --prefix backend ci
npm --prefix ui run type-check
npm --prefix ui test -- --runInBand
npm --prefix ui run build
npm --prefix backend run type-check
npm --prefix backend run type-check:evaluations
npm --prefix backend test -- --runInBand
npm --prefix backend run test:evaluation-export
npm --prefix backend run lint:portability
```

## Suite ownership

| Suite | Location | What it establishes |
| --- | --- | --- |
| UI units | `ui/__tests__/unit/` | Storage, contexts, cancellation, limits, ordering and config parity |
| UI interactions | `ui/__tests__/integration/` | Modal, assistant and result behavior across components |
| Browser flows | `ui/e2e/` | Real browser navigation, workflows, forms and mocked enhancement responses |
| Backend units | `backend/tests/unit/` | Prompt/option regressions, access, quota, provider parsing, tracing and offline evaluation logic |
| HTTP boundaries | `backend/tests/integration/*-handler.test.ts` | Routing, status mapping, authentication failures and explicit bootstrap settings using injected services |
| SDK integration | `backend/tests/integration/evaluation-export.smoke.ts` | Real Langfuse SDK observations with an in-memory exporter, including export failure |
| Database regression | `backend/supabase/tests/` | Weekly anonymous quota-reset behavior in a local database |
| Paid model quality | `backend/evaluations/` | Generated output assertions, independent Jev rubric, model/prompt comparisons and human review |

Jest discovers only named test files inside its test roots. SDK smoke tests are
run separately because they use native ESM and top-level await. Backend core type
checking includes active HTTP handlers; Deno startup adapters require their own
platform verification. Coverage targets `src/`, not obsolete root-level paths.

No deterministic suite should need production credentials or paid AI calls.
Restricted-model tests use an explicit catalog fixture even when every current
demo model is free. Test the real code path; do not copy a validation function
into a test, assert invented CSS strings, add `expect(true)` scaffolding, or leave
future integration cases permanently skipped.

## Browser checks

Install the lockfile's Chromium build, then run:

```bash
cd ui
npx playwright install chromium
npm run test:e2e

# Check the production export (build with the same public fixture values):
NEXT_PUBLIC_APP_SUPABASE_URL=https://e2e.supabase.co \
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=e2e-anon-key \
NEXT_PUBLIC_API_BASE_URL=https://e2e.supabase.co/functions/v1 npm run build
E2E_STATIC_EXPORT=1 npm run test:e2e
```

The browser suite is separate from Jest. UI builds need the three public env
values, even when API responses are mocked. The shared browser fixture mocks anonymous auth, profiles and enhancement calls.
The dev server uses explicit fixture settings; exported builds must use the same
settings. `e2e/serve-export.mjs` serves extensionless exported routes locally. Real staging smoke
checks are a separate release activity. GitHub Actions currently runs types,
Jest and the static build; see the release review for browser verification status.

## Prompt and model evaluations

Keep fixture datasets, experiment definitions, engine code and generated outputs
separate. Commit representative synthetic cases and reviewed baseline artifacts;
keep raw outputs under ignored `backend/evaluation-results/`.

```bash
cd backend
npm run eval:compare -- --experiment=evaluations/experiments/models.ts --dry-run
npm run eval:compare -- --experiment=evaluations/experiments/prompts.ts --dry-run
```

Dry runs validate definitions and count calls without network access. Paid runs
are explicit, use `.env.evaluation`, and do not run in ordinary CI. `eval:prompts`
is a diagnostic smoke runner with its own configured output budget; `eval:compare`
is the production-settings comparison and approval path. `eval:jev` exercises the
product selector against fixed good/bad outputs; independent evaluator calibration
uses `eval:calibrate`. These test different contracts and are not interchangeable.

Reuse requires an exact recorded execution fingerprint; changed provider policy,
settings, prompt inputs or judge criteria invalidate matching results. Older
reports are not upgraded automatically. Publication does not repeat generation.
Read [the evaluation guide](../backend/docs/evaluations.md) for gates and human review.

## Local database checks

Start the local Supabase stack and apply committed migrations before running the
SQL regression suite through the installed CLI's `db test` command. Keep this
separate from hosted deployment and never use production to run reset tests.
`supabase/seed.sql` contains local fixtures, including known test passwords; it is
not a production account bootstrap mechanism.
