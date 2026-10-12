# Configuration

Application policy lives in `backend/src/config/` and `ui/src/config/`.
Evaluation policy lives in `backend/evaluations/`. Environment values supply
secrets and deployment-specific overrides; they are not duplicated inside
services or components. Framework/build files remain at each application's root
where their tools discover them.

## Authoritative locations

| Setting | Location |
| --- | --- |
| Provider model IDs, capabilities, reasoning and service tier | `backend/src/config/models.config.ts` |
| Detailed role prompts and role model access | `backend/src/config/roles.config.ts` |
| Transformation values and language names | `backend/src/config/transformation-options.config.ts` |
| Input, output-token and assistant limits by tier | `backend/src/config/tier-limits.config.ts` |
| Timeout, batch ceiling, raw connector output budget and token estimates | `backend/src/config/runtime.config.ts` |
| Provider endpoints and attribution | `backend/src/config/providers.config.ts` |
| Optional trace defaults and secret redaction inputs | `backend/src/config/observability.config.ts` |
| Explicit initial admin accounts | `backend/src/config/admin.config.ts`, through server secrets |
| UI labels, controls and public tier projection | `ui/src/config/catalog.config.ts` |
| Initial assistants and saved workflows | `ui/src/config/workflows.config.ts` |
| User-facing messages | `ui/src/config/messages.config.ts` |
| Repository URL and Analytics measurement ID | `ui/src/config/site.config.ts` |
| UI feedback and refresh timings | `ui/src/config/interaction.config.ts` |
| Required public build environment values | `ui/src/config/runtime.config.ts` |
| Experiment defaults and gates | `backend/evaluations/config.ts`; per-experiment overrides in `experiments/` |
| Anonymous weekly allowance and reset schedule | `private.runtime_settings` and the quota migration |
| Planned token packages | `backend/src/config/payment.config.ts`; not a live offering |

Values in configuration files are intentional, reviewable policy defaults.
Services and connectors reference those values instead of repeating literals.
Protocol structure, algorithmic constants and test fixtures are not deployment
configuration. Do not introduce environment variables for every implementation
detail.

## Environment files

- Copy `ui/.env.local.example` to `ui/.env.local`. All three public URLs/keys are
  required; Next.js embeds them at build time. A changed value requires a rebuild.
- Copy `backend/.env.local.example` to `backend/.env.local` for the local functions.
  Hosted functions receive `SUPABASE_URL` from Supabase automatically.
- Copy `backend/.env.evaluation.example` to `backend/.env.evaluation` for CLI
  evaluation and publication. Load it explicitly with Node's `--env-file` option.
  These credentials are not synchronized to Edge Functions.

Private `.env*` files are ignored; only templates are committed. Keep provider,
service-role, database and CLI access keys server-side. `setup-env.sh` reads a
trusted shell-compatible file: quote JSON and values containing spaces.

The public demo requires `OPENROUTER_API_KEY`, `SUPABASE_URL`, and
`APP_SUPABASE_SERVICE_ROLE_KEY`. The profile/admin endpoints only need the
Supabase settings. Blank optional numeric overrides use committed defaults;
nonblank values must be whole numbers in range. Boolean flags accept exactly
`true` or `false`, with blank values using their defaults. Invalid configuration
fails startup rather than silently accepting values such as `30000ms`.

| Optional backend override | Default | Constraint |
| --- | --- | --- |
| `LLM_TIMEOUT_MS` | Runtime timeout policy | 1,000–300,000 ms |
| `MAX_BATCH_SIZE` | Runtime batch policy | 1–100; tier-specific limits also apply |
| `JEV_MODEL_ID` | Runtime Jev model policy | Nonblank override |
| `JEV_TIMEOUT_MS` | Runtime Jev timeout policy | Positive safe integer |
| `EXPOSE_ERROR_DETAILS` | `false` | Boolean |
| `LANGSMITH_TRACING` | `false` | Enabled only with `LANGSMITH_API_KEY` |
| `LANGSMITH_CAPTURE_CONTENT` | `false` | Boolean; permits sensitive content capture |

`LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`, `APP_ENV`, `APP_RELEASE`, and `LOG_LEVEL`
configure tracing/deployment diagnostics. GitHub Actions sets deployment metadata
and chooses staging/production secrets. Timeout/batch/Jev defaults remain in
TypeScript, so empty Actions overrides do not define a second policy.

## Admin bootstrap

Bootstrap is disabled unless `ADMIN_BOOTSTRAP_USERS_JSON` contains an explicit
nonempty user array and `BOOTSTRAP_SECRET_KEY` contains at least 32 characters.
The user data is a server secret, not an HTTP request body or committed fixture.
Each entry must specify `email`, a unique 16+ character `password`, `tier`,
`isAdmin`, `tokens`, `isActive`, and `description`. Use independently generated
passwords for real accounts. Existing accounts are skipped; this mechanism does
not rotate their passwords or update their privileges. Account lookup is paginated
and case-insensitive. A failed profile/quota setup removes only the account just
created by that operation, so it can be retried; accounts successfully created
earlier in the same bootstrap remain in place.

The deployment workflow accepts optional `STAGING_ADMIN_BOOTSTRAP_USERS_JSON`
and `PRODUCTION_ADMIN_BOOTSTRAP_USERS_JSON` repository secrets. Unset values
leave bootstrap disabled. Remove the user JSON after initialization. Known-password
fixtures in `tests/fixtures/` and `supabase/seed.sql` are local-only test data.

## Database allowance

The database owns the actual anonymous allowance. Change it in the appropriate
project as the database owner:

```sql
update private.runtime_settings
set bigint_value = <amount>
where setting_name = 'anonymous_weekly_token_allowance';

-- Explicitly apply to existing anonymous accounts when intended:
select private.reset_anonymous_quotas();
```

Existing migrations also encode initial registered-user balances. Do not edit
already applied migrations or reset deployed data to make a first-release tree
look shorter; schema changes require a new migration.

## Planned payments

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PUBLISHABLE_KEY` are
required only by the disabled payment adapters. The current deployment and secret
synchronization do not enable this feature. See [payment activation gates](payments.md).
