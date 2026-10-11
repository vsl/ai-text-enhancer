# Planned payment feature

Stripe token purchases are retained as planned work. They are not part of the
first-release public demo, are not deployed, and have no current UI or live price
offering. The weekly anonymous allowance is the released usage model.

## Ownership

- `src/payments/`: portable checkout/webhook logic, payment errors and draft payment ledger adapters.
- `src/config/payment.config.ts`: draft packages and pricing policy.
- `planned/payments/functions/`: disabled HTTP adapters; outside deployed function discovery.
- `src/repositories/quota.repository.ts`: token ledger operations also used by admin grants.
- `tests/unit/payments/`: deterministic prototype service/error/ledger checks.
- `src/config/loader.ts`: a separate payment configuration loader; public endpoints do not require Stripe keys.

The backend workflow deploys only `enhance`, `me`, and `admin`. It also removes
previously deployed payment functions. Do not copy the planned adapters into
`supabase/functions/` or enable a pricing UI without completing the work below.

## Activation gates

1. Align the Node and Deno Stripe SDK/API versions and type-check the actual HTTP
   adapters. The retained adapters still use an older SDK/API version; unit tests
   of the portable service do not establish runtime compatibility.
2. Verify redirect URLs against configured frontend origins and validate request
   bodies. Do not allow arbitrary checkout redirects.
3. Fulfill only confirmed paid sessions, support asynchronous success events, and
   propagate processing failures so Stripe can retry. The prototype currently
   acknowledges webhook processing failures with HTTP 200.
4. Replace description-string event lookup with a durable unique event/transaction
   key and atomic fulfillment. A separate lookup followed by crediting is not
   concurrency-safe idempotency.
5. Handle incremental/duplicate refund events without repeatedly deducting the
   cumulative refunded amount. Keep balance and ledger operations atomic.
6. Decide and implement tier entitlements and token expiry before advertising
   either. The prototype credits tokens; it does not provide the old pricing
   page's upgrade/one-year-expiry promises.
7. Add the UI/API contract and integration tests using an isolated Stripe test
   environment. Verify signatures, retries, duplicates, async payments, refund
   sequences, and reconciliation. Enable deployment only after owner review.

The current feature has no Connect marketplace or multi-party payment flow.
Packages and tests are development artifacts; they are not release acceptance for
billing. Older payment implementation plans and pricing claims were removed from
the maintained documentation.
