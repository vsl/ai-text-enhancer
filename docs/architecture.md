# Architecture

This repository has two independently deployed applications and one API contract.
The UI is a static Next.js export on Cloudflare Pages. Supabase Edge Functions
handle authenticated requests; portable TypeScript handles business rules.

## Request flow

1. `ui/src/context/AuthContext.tsx` restores or creates an anonymous Supabase session
   and fetches `/me`. Tier limits control the browser form; the backend enforces them.
2. `WorkflowContext` owns saved workflows, generation state and cancellation.
   `ui/src/lib/workflow-config.ts` validates browser storage at hydration.
   `ui/src/lib/enhance-api.ts` translates options and sends `/enhance`.
3. `backend/supabase/functions/enhance/index.ts` assembles dependencies once.
   `handler.ts` owns routing, authentication, JSON parsing and HTTP error mapping.
4. `BatchOrchestrator` validates requests, checks model access and estimated quota,
   builds distinct role prompts, and runs enabled assistants concurrently.
5. Provider connectors serialize requests, enforce cancellation/timeouts and parse
   usage. The output contract requires a JSON object with a nonblank `text` field.
6. Successful generation usage is deducted atomically in Postgres. The optional
   Jev selector scores valid outputs; judge failures preserve generated results.
   One valid output may also be scored. All results remain available to the user.

Responses are returned as one batch, including partial failures; there is no
streaming endpoint. Workflows and text are not stored in the application's
Postgres tables. Optional tracing and evaluation publication have their own data
handling settings.

## Code ownership

| Directory | Responsibility | Boundary |
| --- | --- | --- |
| `ui/src/app/` | Routes and layout | Static export; no server-only keys |
| `ui/src/components/` | Presentation and interactions | Read context and receive callbacks |
| `ui/src/context/` | Session/workflow state | Delegate HTTP serialization to clients |
| `ui/src/lib/` | API clients, storage validation, utilities and UI types | No product catalogs or deployment defaults |
| `ui/src/config/` | Public catalog, defaults, messages, site and build settings | Public-safe values only |
| `backend/src/config/` | Models, roles, options, policies, environment loaders | Own all runtime defaults and environment reads |
| `backend/src/services/` | Prompt composition, access, quota, orchestration and administration | No Deno APIs or HTTP responses |
| `backend/src/connectors/` | Provider/Supabase client adapters | Credentials are constructor/configuration inputs |
| `backend/src/repositories/` | Database queries and RPC operations | No prompt or HTTP logic |
| `backend/src/observability/` | Optional sanitized traces | Export failures do not repeat successful work |
| `backend/src/types/api.types.ts` | Shared enhancement request/response types | UI imports types; never imports server credentials |
| `backend/supabase/functions/` | Released endpoint startup and HTTP handlers | Deno stays in startup adapters |
| `backend/supabase/migrations/` | Versioned database schema and initial database policy | Applied migrations are not rewritten |
| `backend/tests/` | Deterministic unit and boundary/integration tests | No paid calls or production credentials |
| `backend/evaluations/` | Evaluation engines, fixtures, policies, experiments and review artifacts | May use production builders/connectors; production must not import evaluation logic |
| `backend/scripts/` | CLI/file/publication adapters | Explicit targets and credentials |
| `backend/src/payments/` | Portable planned payment feature | Not included in released service assembly |
| `backend/planned/payments/functions/` | Disabled payment HTTP adapters | Outside local/deployed function discovery |

## Configuration and shared contracts

Backend role prompts are product behavior: expertise, task, quality criteria and
required output remain distinct. Shared input-boundary and output policies live
in prompt templates. Enabled transformations add requirements to a role; disabled
options do not remove inherent behavior, such as producing a complete email.

The browser catalog is a public projection of backend settings. The UI parity
suite checks models, roles, tiers and transformation values. A catalog or API
change must update both applications and run both suites. Provider API keys and
Supabase service-role keys never enter the browser configuration.

The weekly anonymous allowance is database policy, stored in
`private.runtime_settings`; it is not an unused TypeScript daily-rate setting.
See [configuration](../backend/docs/configuration.md) for the authoritative locations.

## Deliberate limits

The demo uses browser-local workflows and anonymous sessions. It does not offer
account-bound synchronization or paid plans. Quota is checked before generation
and deducted afterwards: concurrent requests can pass the same balance check,
and deduction failures are logged after provider cost has already occurred.
This is not a quota reservation system. Jev usage is not deducted from the user's
generation balance. Changing either policy requires explicit product and database
work, including concurrency tests.

LangSmith defaults to metadata-only capture. Evaluation reports deliberately
retain prompts and outputs; use synthetic cases and keep generated reports out
of Git. Google Analytics is configured separately in the UI. See the
[release review](release-review.md) for the outstanding deployment checks.
