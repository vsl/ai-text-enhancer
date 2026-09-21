# Payment-path defects (report only)

Reviewed 2026-08-05. These defects are outside the configuration/prompt hardening scope and were not modified.

1. **Checkout initialization is broken.** `create-checkout/index.ts` calls `new AuthMiddleware(config)`, but `AuthMiddleware` requires `(supabaseClient, jwtSecret)`. The Edge Function files are outside `backend/tsconfig.json`, so the normal type-check does not catch this constructor mismatch.
2. **The package catalogs are duplicated and already differ.** The backend exposes `starter`, `popular`, `premium`, and `enterprise`; the UI exposes only the first three. There is no shared payment contract or parity test.
3. **Purchases do not grant the tiers advertised by the UI.** Checkout metadata and webhook processing add tokens only. They never update `user_profiles.tier`, although the pricing page says starter/popular unlock Plus and premium unlocks Premium.
4. **Token and tier expiry are not implemented.** The pricing page promises one-year token validity, but the quota/profile schema has no expiry columns and no service enforces expiry or tier downgrade.
5. **`/me` mishandles blocked users.** `UserBlockedError` is an `AuthorizationError`, while the `/me` handler only recognizes `AuthenticationError`; blocked accounts therefore fall through to HTTP 500 instead of HTTP 403.
