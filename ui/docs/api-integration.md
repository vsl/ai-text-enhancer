# UI and backend contract

The current public UI sends a batch request from `WorkflowContext.tsx` to the Supabase `enhance` Edge Function using an anonymous bearer token. Each enabled assistant has an ID, configured model, one of the `editor`, `summarizer`, or `email_assistant` roles, source text, separate optional context, and transformation options. The backend returns per-assistant successes or errors and an optional Jev `selection`.

For request and response fields, limits, models, and errors, use the maintained [backend API reference](../../backend/docs/api-reference.md) and the source types in [`api.types.ts`](../../backend/src/types/api.types.ts). UI model labels come from the backend model catalog. The frontend keeps workflows in browser `localStorage`; it does not store generated results on the server.
