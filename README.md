# AI Text Enhancer

A serverless AI application for turning repeated text-editing prompts into reusable multi-model workflows.

Provide source text and optional reference context once, then run configurable assistants in parallel, compare their outputs, and let Jev evaluate successful alternatives. The application keeps every result available for the user's final choice.

[Live site](https://ai-text-enhancer.sertalp.com/) · [Open the app](https://ai-text-enhancer.sertalp.com/text-ai-assistants)

## The problem

General-purpose AI chats are flexible, but recurring writing tasks often require the same setup again: context, tone, formality, edits, alternative versions, and model choice. AI Text Enhancer saves those instructions as browser workflows. The default workflows are Quick Fix and Formal Email; users can configure or create their own.

## What it does

- Runs multiple assistants against one source text, with reference context kept in a separate field.
- Offers editor, summarizer, and professional email roles, each with distinct prompts.
- Configures improvements, corrections, formatting, length, tone, formality, language level, translation, and emojis per assistant.
- **Avoid common AI symbols** — optionally discourages em dashes, semicolons, unnecessary formatting, and other frequently overused AI-writing patterns when simpler phrasing works.
- Lets assistants use different currently configured OpenRouter models and returns partial results when an individual model fails.
- Sends two or more valid outputs to TypeSafe Jev through the OpenRouter Decisions API. Jev returns a selected result and relative candidate probabilities; a failed evaluation never discards generated text.
- Saves workflows in browser `localStorage`. The public demo uses invisible Supabase anonymous auth and a weekly token allowance, with no traditional signup flow.

## Architecture

```text
Browser / Next.js static export (Cloudflare Pages)
  ├─ local workflows, source and context, comparison UI
  └─ Supabase anonymous JWT → Edge Function /enhance
       ├─ validate request, tier access, and weekly quota
       ├─ run assistants in parallel → OpenRouter → parse structured output
       ├─ report successful token usage
       └─ evaluate valid alternatives → Jev Decisions API
            └─ return all results + optional selection
```

The `ui/` app exports static files. Secrets, quota checks, provider calls, and Jev evaluation stay in the Supabase backend. Backend business logic lives in `backend/src/` and uses portable TypeScript; Edge Function handlers adapt HTTP, Deno, and Supabase services. The `/me` function supplies profile and allowance data. Supabase Postgres holds quota and user records; generated texts and workflows are not stored there by this feature.

| Area | Current implementation |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Hosting | Cloudflare Pages static export |
| Backend | Supabase Edge Functions, Deno, TypeScript |
| Data and auth | Supabase Postgres and anonymous Auth |
| AI | OpenRouter model calls; TypeSafe Jev via OpenRouter Decisions API |
| Observability | LangSmith traces and request-scoped IDs/logs |
| CI/CD | GitHub Actions checks and backend deployment; Cloudflare Git integration for UI |
| Testing | Jest, Playwright, prompt evaluations |
| Development | Node.js 22; optional Docker or Podman shell |

The configured demo models are [GPT-5 Nano, OpenRouter Free, and Qwen3 30B A3B Instruct 2507](backend/src/config/models.config.ts). The backend model catalog defines their provider IDs and display names; a UI parity test keeps the browser labels aligned.

## Prompt engineering and transformations

Each assistant keeps its distinct role prompt. Enabled transformations add instructions to that role. **Avoid common AI symbols** is enabled by default in the UI and configurable per assistant. It is a prompt-level preference: generated text is not post-processed or mechanically stripped of punctuation. Role requirements and grammatical correctness take precedence, including a professional email's `Subject:` line. This feature is not an AI detector and does not claim to make text indistinguishable from human writing.

## Engineering choices

- **Static frontend:** The UI needs no Next.js server, while server-side keys remain in Edge Functions.
- **Portable core:** Business logic can be tested under Node; Deno and Supabase APIs stay at the boundary.
- **Partial success:** One timeout or model failure should not erase useful outputs from other assistants.
- **Noncritical Jev:** Generation remains usable when the decision service is unavailable. Jev's probabilities express relative preference among that run's candidates, not correctness or an absolute quality score.
- **Browser workflows:** Local persistence is sufficient for the anonymous demo and avoids account-bound workflow storage.

## Tracing and data handling

LangSmith tracing is optional. `LANGSMITH_TRACING=true` with an API key records operational metadata such as request ID, model, elapsed time, token usage, and failure code. `LANGSMITH_CAPTURE_CONTENT=false` is the default: tracing omits raw source and context, full prompts, provider responses, generated text, and Jev candidate text. Set the server-side flag or GitHub Actions repository secret to `true` only for an explicitly sensitive diagnostic session; credential fields remain redacted in both modes. Do not put backend keys in `ui/.env.local`. The frontend includes Google Analytics in production; avoid treating this tracing setting as a blanket privacy guarantee.

## Repository layout

```text
.
├── ui/                    # Next.js pages, components, context, Jest, Playwright
├── backend/
│   ├── src/               # services, connectors, config, observability
│   ├── supabase/          # Edge Functions and migrations
│   ├── tests/             # unit and integration checks
│   └── evaluations/       # prompt regression cases
├── docs/                  # current setup and product flow
└── .github/workflows/     # UI and backend checks/deployments
```

## Run locally

Use Node.js 22 and run from the repository root:

```bash
npm --prefix ui ci
npm --prefix backend ci
npm --prefix ui run dev
```

Copy [the UI environment template](ui/.env.local.example) to `ui/.env.local` and configure the public staging Supabase URL, anon key, and API base URL. For a local backend, use [the backend environment template](backend/.env.local.example), then `npm --prefix backend run dev`. Never commit `.env` files. [Setup and deployment details](docs/getting-started.md) cover Supabase, GitHub, and Cloudflare.

## Verification

```bash
npm --prefix ui test -- --runInBand
npm --prefix ui run build
npm --prefix ui run test:e2e
npm --prefix backend test -- --runInBand
npm --prefix backend run type-check
npm --prefix backend run lint:portability
```

Jest covers UI state and service boundaries, including structured output parsing, partial failures, timeouts, quota validation, Jev candidate mapping, invalid decisions, and judge fallback. Playwright covers browser flows; it is a separate suite and is not run by the current GitHub Actions checks. Prompt evaluation cases in `backend/evaluations/` are an additional AI-specific regression layer. GitHub Actions runs `npm ci`, Jest, backend type and portability checks, and the Next.js static build. Backend pull requests deploy to staging and `main` deploys to production; Cloudflare Pages builds previews and production from Git.

## Monetization status and license

A Stripe token-purchase subsystem exists as a monetization prototype, but payment functions are intentionally disabled in the current deployment. The deployed public demo uses a weekly anonymous allowance; old token-package prices are not a live offering.

This repository is proprietary and view-only. See [LICENSE](LICENSE) for the complete terms.
