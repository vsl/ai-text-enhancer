# Released API

Base URL: the configured Supabase project's `/functions/v1`. The browser uses
`NEXT_PUBLIC_API_BASE_URL`. Startup adapters live in `supabase/functions/`; the
portable enhancement DTOs are defined in `src/types/api.types.ts`.

## Public health

`GET /enhance/health` and `GET /me/health` return a JSON object with `status: "ok"`.
They do not require a JWT. `OPTIONS` handles browser preflight. `/enhance` also
accepts a root GET health check; `/me` uses its root for the authenticated profile.

## Enhance

`POST /enhance` requires `Authorization: Bearer <Supabase user JWT>` and a JSON
body. This is a user session token, not a Supabase CLI access token.

```json
{
  "assistants": [{
    "id": "1",
    "model": "open-router-free",
    "aiRoleId": "editor",
    "userText": "This are a short message.",
    "contextText": "",
    "options": { "fixMistakes": true }
  }]
}
```

`model` is a public catalog ID, not an arbitrary provider model ID. Roles are
`editor` and `email_assistant`. Options are validated against the transformation
configuration. Empty options preserve inherent role behavior. Requests reject
unknown fields/values and conflicting shorten/lengthen options. IDs must be
unique, nonblank strings. Limits are defined in configuration; do not copy numeric
limits into client logic.

```json
{
  "results": [{
    "id": "1",
    "status": "success",
    "enhancedText": "This is a short message.",
    "total_tokens": 42
  }],
  "selection": {
    "status": "success",
    "judge": "jev",
    "model": "typesafe/jev-1.13",
    "selectedResultId": "1",
    "confidence": 0.9,
    "scores": { "1": 0.89 }
  }
}
```

The example is illustrative, not a promised score. Jev scores are normalized
rubric levels; confidence is a separate judge value. A single valid output may be
scored. Selection may instead be `skipped` or `unavailable`, with a reason. All
successful results remain usable if judging fails.

Per-assistant failures use `status: "error"` and an error code. Assistants beyond
the user's tier batch limit receive errors while allowed positions still run.
An individual timeout/provider/output failure does not erase other outputs.
Usage is reported for successful generation; Jev usage is separate.

Request-level errors use `{ "error": { "code": "...", "message": "..." } }`:
400 for malformed/invalid input, 401 for authentication, 403 for authorization,
429 for quota, and 500 for unexpected failures. Provider detail exposure is an
explicit backend flag. `/enhance` returns `X-Request-ID` for correlation.

## Profile

`GET /me` requires the same session JWT and returns:

```json
{
  "profile": {
    "id": "user-id",
    "email": "anonymous@example.invalid",
    "tier": "free",
    "is_admin": false,
    "is_active": true,
    "auth_provider": "anonymous"
  },
  "quota": { "tokens_available": 50000, "tokens_used": 0 }
}
```

Blocked users receive 403. Missing/invalid sessions receive 401. Unsupported
methods receive 405 and unknown paths receive 404. Unexpected internal diagnostics
are not returned to the client. The browser obtains anonymous sessions through
Supabase Auth; this API does not implement signup/login.

## Administration

Released admin routes require an active admin user's JWT, except explicit
bootstrap. Privileges come from server-managed profiles, not user-editable
metadata.

| Route | Body/query | Purpose |
| --- | --- | --- |
| `GET /admin/users` | `limit`, `offset` | List users |
| `GET /admin/users/:id` | None | Profile, quota and recent ledger entries |
| `POST /admin/users/:id/tokens` | Integer `tokens`, optional string `description` | Adjust token balance |
| `PUT /admin/users/:id/tier` | `tier`: free/plus/premium | Change tier |
| `PUT /admin/users/:id/status` | Boolean `isActive` | Block/unblock |
| `POST /admin/bootstrap` | No client-supplied users | Create explicitly server-configured initial accounts |

Bootstrap accepts its configured secret directly in `Authorization`, not a Bearer
JWT. It returns 503 when unconfigured and 401 for a missing/wrong secret. Users and
passwords are loaded from server configuration. Existing accounts are skipped;
this is not password rotation. See [configuration](configuration.md).

There are no released `/create-checkout` or `/stripe-webhook` endpoints. Their
source is retained outside the deployed function directory as [planned work](payments.md).
