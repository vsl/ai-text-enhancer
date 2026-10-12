# AI Text Enhancer backend

Supabase Edge Functions and platform-neutral TypeScript services for the [AI Text Enhancer](../README.md) public demo. The current deployed flow uses anonymous Auth, a weekly token allowance, OpenRouter model calls, and optional Jev evaluation through the Decisions API.

- `src/`: validation, prompt building, parallel orchestration, provider connectors, configuration, quota handling, and optional LangSmith tracing.
- `supabase/functions/`: Deno request handlers for `enhance`, `me`, and `admin`.
- `supabase/migrations/`: Postgres quota and supporting schema.
- `tests/`: deterministic unit, HTTP-boundary and SDK integration checks.
- `evaluations/`: offline engines, fixtures, experiment definitions and review artifacts.

The Stripe feature is planned and disabled. Its portable logic is isolated in
`src/payments/`; its HTTP adapters live in `planned/payments/functions/`, outside
the deployed function directory. See [the payment plan](docs/payments.md).

`LANGSMITH_TRACING` is optional. With tracing enabled, `LANGSMITH_CAPTURE_CONTENT=false` remains the default and exports operational metadata without raw source, context, model output, or Jev candidate text. Set content capture to `true` only for sensitive server-side diagnostics; credential redaction still applies. See [.env.local.example](.env.local.example).

From the repository root, use Node.js 22:

```bash
npm --prefix backend ci
npm --prefix backend test -- --runInBand
npm --prefix backend run type-check
npm --prefix backend run lint:portability
```

See [repository setup](../docs/getting-started.md) and [API reference](docs/api-reference.md). This repository is proprietary and view-only under [LICENSE](../LICENSE).
