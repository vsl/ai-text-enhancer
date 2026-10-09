---
name: openrouter-add-model
description: Inspect current OpenRouter model capabilities using OPENROUTER_API_KEY and prepare per-model production or evaluation settings when adding a model, checking reasoning support, or comparing parameter variants.
---

# Add an OpenRouter model

Use live model metadata to choose each model's intended production settings. If
the user only asks for information, return findings without editing the app.

## Inspect authenticated metadata

Read the repository's AGENTS.md and find its model catalog, generation-settings
resolver, connector and evaluation definitions. Use `OPENROUTER_API_KEY` from the
environment. If absent, load an existing private env file with Node's `--env-file`
option; for AI Text Enhancer, check `backend/.env.local` and then `backend/.env`.
Do not print env-file contents, the key, Authorization headers, or copy credentials
from an attached screenshot. If no key is available, report the missing variable.

Run the bundled helper from the repository root with exact provider model IDs
(Node 22+):

```bash
node .agents/skills/openrouter-add-model/scripts/inspect-models.mjs \
  openai/gpt-5-nano openrouter/free

# From a repository root when the key is in backend/.env:
node --env-file=backend/.env \
  .agents/skills/openrouter-add-model/scripts/inspect-models.mjs \
  openai/gpt-5-nano
```

The helper makes one authenticated, read-only GET request per model to
`https://openrouter.ai/api/v1/model/{author}/{slug}`. It records requested and
resolved IDs, source URL, verification time, supported parameters, reasoning
metadata, default parameters, output limits, context length and pricing. It makes
no generation calls. Report lookup errors per model without claiming verification.

Explain these fields, preserving absence, null and explicit false:

- `reasoning.mandatory`: true forbids disabling reasoning, including effort
  `none`. Missing does not establish that disabling is allowed.
- `supported_efforts`: an array lists accepted levels; null means all gateway
  effort values are accepted, subject to mandatory reasoning. Omitted means
  effort selection is not exposed. Do not apply one effort to every model.
- `default_effort` and `default_enabled`: report actual values, or “not reported.”
  Omitting request controls keeps provider defaults; it does not mean reasoning
  is disabled.
- `supports_max_tokens`: describes a separate reasoning token budget, distinct
  from the response's overall `max_tokens`.
- Missing `reasoning` metadata: report it as absent. Non-reasoning models and
  dynamic routers can omit it; parameter names alone do not establish mandatory
  status, defaults or accepted efforts. A router's underlying model can change.
  Do not invent fixed reasoning defaults for `openrouter/free`.

`reasoningEnabled` and `reasoningEffort` are application configuration names;
OpenRouter accepts `reasoning.enabled` and `reasoning.effort` in generation requests.
For ambiguous controls or effort/enablement combinations, fetch current official
documentation through Context7 when available, following repository instructions.
Use [model lookup docs](https://openrouter.ai/docs/api/api-reference/models/get-a-model-by-its-slug)
and [reasoning docs](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
as references; live endpoint metadata is the source for requested model IDs.

## Choose and apply individual settings

Follow the user's cost/quality preference. When minimizing reasoning, use a
verified supported `none` when reasoning is optional; for mandatory reasoning,
choose the lowest supported effort (such as `minimal`). Explicit disabling with
`reasoning.enabled: false` needs verified support and a compatible effort. Leave
controls omitted for models that do not expose them. Treat uncertain metadata as
unknown and never silently substitute unsupported settings. Explain proposed
settings separately from observed defaults. Hidden reasoning is still billable;
`exclude` is not a token-saving substitute for disabling it.

For an authorized implementation, keep production settings in the repository's
model catalog and pass them through its production resolver and connector.
Evaluations should inherit that configuration and allow candidate-specific
overrides for parameter experiments, including the same model with different
settings. New evaluation-only models may declare proposed production settings
per candidate until promotion; preserve those settings when promoting. Keep
prompts/data fixed when comparing model configurations, and record exact resolved
parameters, token usage and cost. Check unsupported reasoning before paid calls;
never disable a model whose reasoning is mandatory.

Adding a production model may also require tier access, role allowlists, UI model
lists and labels. Inspect those callers, update both apps when applicable, and
run required checks. An information-only lookup or evaluation configuration does
not authorize enabling a production model or paid experiments.
