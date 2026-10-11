# First-release engineering review

Reviewed on 11 October 2026. The cleanup is prepared for developer review;
local verification passed. Hosted platform and live model checks remain separate
release activities. Role prompts and generation requirements were preserved.

## Changes made

| Finding | Resolution |
| --- | --- |
| Policy defaults and provider URLs mixed into services, connectors and UI state | Centralized backend/UI configuration, shared assistant defaults and UI timing policy; strict numeric/boolean environment parsing |
| Configuration loading returned mutable shared catalogs | Independent copies on each load, with mutation-isolation coverage |
| Published fixed bootstrap credentials and admin access through private fields | Bootstrap disabled by default; explicit secret user configuration; active-admin authentication through a public service method |
| Bootstrap lookup covered only the first auth page and could leave a partially configured new account | Paginated case-insensitive lookup; compensate failed profile/quota setup by removing only the newly created account |
| Blocked `/me` requests returned internal errors | Authorization maps to 403; unexpected failures use a generic response; routing/method checks have boundary coverage |
| Missing staging secrets could fall back to production values | Choose secret names before reading values; validate required deployment settings |
| Payment prototype mixed with released functions and ledger adapters | Retained as planned work in `src/payments/` and `planned/payments/functions/`; prototype tests grouped under `tests/unit/payments/` |
| Evaluation engines shipped inside the production source tree | Engines, fixtures, configuration, experiments and reviewed observations grouped under `evaluations/`; CLI adapters remain in `scripts/` |
| Older saved workflow/report compatibility paths obscured the current schema | Removed role-label migration and old report fingerprint reconstruction; validate current browser storage at hydration |
| Skipped integration placeholders and tests of invented validation/CSS behavior | Removed obsolete scaffolding; added executable HTTP/configuration regressions; browser fixtures isolate auth/profile/AI requests |
| Invalid dialog title IDs and hidden accessibility warnings | Let Radix own matching title/description IDs; removed the broad warning filter |
| Portability command swallowed its own failure | Replaced it with a checker that exits unsuccessfully when `Deno` APIs appear in core source |
| Production minification disabled and stale scaffold assets/dependencies retained | Restored standard static-export build configuration; removed unused assets/dependencies and declarations |
| Large duplicate/stale documentation and inaccurate payment promises | Consolidated maintained architecture, configuration, API, testing, evaluation and payment-plan guides; fixed local links |
| Outdated dependencies carried critical/high advisories | Next.js 15.5.27 and compatible dependency updates; scoped PostCSS override to patched 8.5.29 |

Applied database migrations remain intact. They describe deployed schema history,
not a compatibility layer to remove. Dated evaluation observations are labeled as
research evidence and do not substitute for current acceptance runs.

## Verification

All deterministic checks used Node.js 22.23.3 and the committed lockfiles.

| Check | Result |
| --- | --- |
| Clean `npm ci`, both applications | Passed |
| Backend core and active HTTP handler type checks | Passed |
| Evaluation/CLI/SDK smoke source type checks | Passed |
| Backend Jest | 37 suites, 717 tests passed; no skipped tests |
| UI type check and Jest | 17 suites, 204 tests passed; no skipped tests |
| Next.js production static export | Passed; home, app and not-found routes exported |
| Chromium against the exported production files | 37 tests passed; unexpected browser errors checked |
| Langfuse SDK in-memory export, success and failure paths | Passed; no paid AI calls |
| Model, prompt, Luna/Haiku and GLM experiment dry runs | Passed; GLM validates the 140-case full suite |
| Portability check, including an intentional negative probe | Passed; invalid core code was rejected and the probe removed |
| Shell syntax, local Markdown links and Git whitespace | Passed |

The browser build used explicit public fixture values. The shared fixture mocks
anonymous auth, usage profile and enhancement requests, and blocks Analytics.
Build-time Google font downloading required network access. Paid evaluations,
local SQL regression execution and hosted deployment verification were not part
of these deterministic results. Deno startup adapters were not checked by a
local Deno runtime; Node checks cover the active HTTP handlers and portable core.

## Remaining dependency advisory

The final npm audit reports **zero high or critical advisories** in either app.
It reports 19 moderate entries in the UI graph and 20 in the backend graph,
all propagated from the test-tool dependency `sprintf-js` through
`argparse`/`js-yaml` and coverage instrumentation. This is one root advisory,
not 39 independent defects. The advisory applies to all published `sprintf-js`
versions; npm proposes incompatible test-tool changes rather than a compatible
patched leaf. No forced downgrade or major framework migration was applied.

Recheck [the sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
and `npm audit` when maintaining the test toolchain. Keep the PostCSS override
until the chosen Next.js release includes a patched compatible dependency;
remove it only after a fresh install, audit and static build succeed.

## Owner checks before public release

1. **Inspect old bootstrap accounts.** The previous runtime bootstrap used
   committed known passwords. If it ran on a hosted project, remove or rotate
   those accounts before release. Existing accounts are deliberately skipped by
   the new bootstrap, so deploying this cleanup does not rotate their passwords.
   Keep local `seed.sql` and test credentials out of hosted projects. Remove the
   bootstrap user JSON after intentional initialization.
2. **Verify staging and previews.** Confirm Actions chooses the staging project,
   functions start with real server secrets, migrations apply, anonymous signup
   is enabled, `/me` supplies the weekly allowance, and Cloudflare Preview uses
   the same staging backend. Exercise a real generation and judge fallback with
   synthetic input. Confirm production remains separately configured.
3. **Run database regression and intended acceptance evaluations.** Execute the
   SQL suite against a disposable local database and the intended current-model
   acceptance suite deliberately. A dry run establishes configuration integrity,
   not model quality or provider availability.
4. **Accept the demo's quota policy explicitly.** Preflight estimation and
   postflight deduction do not reserve quota across concurrent requests; provider
   cost can occur before a failed deduction. Jev usage is not deducted from the
   generation balance. These limits are documented in the architecture; a hard
   spending cap requires reservation/concurrency work.
5. **Keep payments disabled.** The prototype still requires SDK/API alignment,
   durable atomic idempotency, paid/async fulfillment, retry-safe webhooks and
   correct incremental refunds. Its unit tests do not establish billing readiness.
   See [the payment activation gates](../backend/docs/payments.md).

Start review with [architecture](architecture.md),
[configuration ownership](../backend/docs/configuration.md),
[API contracts](../backend/docs/api-reference.md), and
[test responsibilities](testing.md).
