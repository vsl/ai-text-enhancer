# Development conventions

Use Node.js 22, npm lockfiles, and the nearest `AGENTS.md`. Create an
`agent/<short-description>` branch and open a pull request to `main`; only the
repository owner approves and merges. Do not commit env files or secrets.

## Keep responsibilities separate

Use the [architecture map](docs/architecture.md) before adding code. Put product
policy in the application's config directory, portable business logic in backend
services, database operations in repositories, and HTTP adaptation in function
handlers or UI API clients. Components should not define model catalogs or API
payload contracts. Avoid compatibility aliases and unused abstractions for the
first release.

Use names that describe behavior. Prefer short functions with explicit typed
inputs and visible failure paths. Document constraints and ownership decisions;
avoid comments that merely repeat the next statement. Keep exports narrow and
remove obsolete code, imports, dependencies and fixtures when replacing a feature.

## Change both sides of a contract

`backend/src/types/api.types.ts` owns enhancement DTOs. Update UI serialization,
backend validation, API docs and tests together when the contract changes. Run the
UI parity suite when changing models, roles, options or tier limits. A browser
build must never import secret-loading modules.

## Treat prompts as behavior

Preserve detailed expertise, task, role-specific quality criteria and required
output. Keep shared input-boundary/output rules concise and centralized.
Transformations are additive: no-options Email Assistant still produces a complete
email. Cover every affected role and option, including no options, before changing
prompt policy. Compare generated quality deliberately; a deterministic green
suite alone does not prove a model is suitable.

## Keep evaluation work maintainable

Put reusable offline logic in `backend/evaluations/lib/`, case data at the
workspace root, and named comparison definitions in `evaluations/experiments/`.
CLI and publication adapters belong in `scripts/`. An experiment should state what
it compares, the suite, repetitions, settings and acceptance policy. Consolidate
repeated logic; remove abandoned definitions once their conclusion is recorded.
Use Git history for older approaches rather than leaving several implementation
narratives in the current docs.

Commit no raw production prompts or private generated output. Baselines require
explicit human review and exact provenance. The retained Stripe prototype is
planned work, not a supported endpoint; its [activation gates](backend/docs/payments.md)
must be completed before moving adapters into the deployed function tree.

## Verify and explain

Run the checks in [testing](docs/testing.md) for the affected applications. Include
the concrete behavior change, why it is needed, validation performed and any
remaining limitation in the PR description. Distinguish mocked HTTP tests from
live database/platform verification. Documentation must describe actual behavior,
not promised coverage percentages or removed screens.
