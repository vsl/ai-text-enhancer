# Model and prompt evaluation workspace

Langfuse is the comparison and human-review UI. Git owns fixtures, prompt builders,
independent Jev rubrics, policies and approval artifacts. Local JSON is always retained.
There is no custom HTML dashboard and no change to production LangSmith tracing or
the product's intentional judging of one valid output.

The supported roles are Editor (General Assistant in the UI) and Email Assistant.
Saved configs with a retired role fall back to Editor while preserving options;
Shorten remains an optional transformation. Historical reports are not rewritten.
Role removal uses `prompt-v12`, `jev-v5` and the `text-quality-v3` evaluator; dataset
and evaluator hashes change, so earlier acceptance approvals cannot be reused.

## Start here

Run from `backend/` with Node 22 and `npm ci`:

```bash
# Validate configuration and count calls without credentials or network access.
npm run eval:compare -- --experiment=evaluations/experiments/models.ts --dry-run
npm run eval:compare -- --experiment=evaluations/experiments/prompts.ts --dry-run

# Small paid smoke test: two generations and at most two Jev calls.
# Existing exported environment variables also work; --env-file never prints keys.
node --env-file=.env.local --import ./scripts/register-npm-imports.mjs \
  --experimental-transform-types scripts/evaluate-experiment.ts \
  --experiment=evaluations/experiments/models.ts --case=editor-protected-facts --repeat=1 --publish

# Retry publication of a saved report: ZERO generation/judge calls.
npm run eval:publish -- --report=evaluation-results/COMPARISON_ID/report.json
```

Generation needs `OPENROUTER_API_KEY` or `GEMINI_API_KEY`; Jev needs OpenRouter.
Publication additionally needs `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and
`LANGFUSE_BASE_URL`. Use an existing configured instance. Provisioning, hosted
evaluator configuration and observability migration are outside this change.
Both backend env templates include blank Langfuse settings. Copy the template to
your private `.env.local` and fill them in; Node requires `--env-file=.env.local`
to load it. Existing `.env` files also work with `--env-file=.env`.
Never commit `.env` or provider keys. Fixtures/outputs may contain sensitive data:
use synthetic/anonymized cases and an appropriately secured Langfuse project.

Existing `eval:prompts` and `eval:jev` commands remain available. The new comparison
runner uses production tier limits, service tier, reasoning effort, timeout,
prompt composition, provider connectors and strict output parsing directly; it
does not invoke HTTP handlers, authentication or quotas. Default tier is free.
The committed examples default to the base suite and one repetition; custom
definitions without a repetition count still default to three. All overrides are
stored. Provider failures are preserved and never retried into passes. OpenRouter
routing models such as `openrouter/free` may resolve to different models: inspect
requested **and resolved** identities; use pinned providers/models for approvals.

## Define a comparison

Edit a trusted TypeScript module under `evaluations/experiments/`. `models.ts` and
`prompts.ts` are working examples, not endorsed replacements for production.

### GLM 5.3 Flash versus Qwen

`evaluations/experiments/glm.ts` runs `z-ai/glm-5.3-flash` against the pinned
Qwen3 baseline on **all 140 acceptance cases**, with identical production prompts
and generation settings, code assertions and Jev quality judging. It defaults to
one repetition to limit cost; this does not add GLM to the production model catalog.

From `backend/` with Node 22:

```bash
# No network or paid calls: validate all cases and inspect the call count.
npm run eval:compare -- --experiment=evaluations/experiments/glm.ts --dry-run

# Paid full comparison, reading your existing private .env file.
node --env-file=.env --import ./scripts/register-npm-imports.mjs \
  --experimental-transform-types scripts/evaluate-experiment.ts \
  --experiment=evaluations/experiments/glm.ts --suite=all --repeat=1
```

This makes at most **280 generations plus 280 Jev calls** without result reuse.
Add `--publish` when all three Langfuse settings are configured, or publish the
saved report later without further AI calls. Add `--reuse=.../report.json` to reuse
matching baseline samples; preview savings by adding it to the dry-run command.
Use `--repeat=3` for a more stable comparison (840 generations plus up to 840
Jev calls without reuse). If your credentials are in `.env.local`, change the env
file flag accordingly. Keep the credentials private and never commit them.

For the manually triggered workflow, select experiment `glm`, suite `all`, clear
the case filter and choose one repetition. A nonempty case filter still limits the
run even when the suite is `all`.

- Model mode: different provider/model identities, identical builder ID/version,
  builder function, rendered prompts and generation settings.
- Prompt mode: identical model/settings, distinct versioned builders receiving
  only role, source, context and UI options. Production composition is the default.
- A model family's production defaults can differ (Nano uses flex/minimal).
  Supply identical explicit common overrides where needed; unequal settings fail
  validation rather than silently confounding the comparison.

`--suite=base|all|development` selects a case list; `acceptance` remains an alias
for `all`. `--case=substring` and repeatable `--tag=role:editor` filter that list;
tags are ANDed. Filters, suite, repetitions and concurrency are recorded. Runs default
to sequential execution. Add `--concurrency=5` or `--concurrency=10` to run up to
that many attempts at once (integer 1–10). Each attempt generates its output and
then runs Jev; completed records and checkpoint writes are serialized. Candidate
dispatch order alternates between repetitions; parallel results are recorded in
completion order. Higher concurrency can change latency measurements or hit provider
rate limits; failures remain recorded without retries. Check `--dry-run` before paying.

```bash
npm run eval:compare -- --experiment=evaluations/experiments/models.ts \
  --suite=all --repeat=1 --concurrency=5
```

| Suite | Cases | New generations + maximum Jev calls, without reuse |
| --- | --- | --- |
| `base`, one repetition (example default) | 26 | 52 + 52 |
| `all`, one repetition | 140 | 280 + 280 |
| `all`, three repetitions | 140 | 840 + 840 |

The base list in `base-case-ids.json` references frozen acceptance fixtures rather
than duplicating them. It covers all roles, no-options behavior, disabled controls,
combinations, facts, tone, symbols, context attacks/conflicts and input sizes.
It is an inexpensive development signal, not complete UI-option coverage.
Only the full, unfiltered `all` suite can become an approved acceptance baseline.

```bash
npm run eval:compare -- --suite=base --dry-run
npm run eval:compare -- --suite=all --repeat=3 --dry-run
```

`evaluations/acceptance.json` is a frozen snapshot, separate from
`development-cases.ts` (`suite: 'development'`). The paid acceptance list contains
137 English cases plus one Spanish translation, one Portuguese translation and
one Ukrainian-to-English case. English coverage includes known regressions, all
non-language UI enum values, every boolean enabled/disabled, no-options controls,
combinations, context conflicts and small/large inputs. The exhaustive language
matrix remains in development cases and offline prompt-parity unit tests, not in
the default paid suites. Change acceptance fixtures deliberately in a reviewed PR;
changing them invalidates baseline hashes. Development edits do not silently
change the frozen acceptance suite. Add minimized real failures as regressions.

## Reuse saved results instead of paying again

Reuse is **opt-in**, using one or more explicit saved reports, not whichever run
happened to finish last. After changing a comparison's candidate to a new model:

```bash
# Inspect hits and exact maximum NEW paid call counts first; no keys required.
npm run eval:compare -- --suite=base \
  --reuse=evaluation-results/PREVIOUS_COMPARISON_ID/report.json --dry-run

# With keys exported, only unmatched generations/judgments make paid calls.
npm run eval:compare -- --suite=base \
  --reuse=evaluation-results/PREVIOUS_COMPARISON_ID/report.json --publish
```

If all 26 baseline cases match, only the new model needs 26 generations and up to
26 Jev calls. Repeating the exact comparison can make zero AI calls. Repeat
`--reuse=...` to supply several reports; the first successful exact match wins.
Local journal checkpoints are loaded as well. A base run can supply matching
cases to an `all` run; missing cases/repetitions are generated normally.

A generation hit requires the same provider/model, exact system and user prompts,
prompt identity/version, generation settings, source/context/role/options/case ID and repetition
index, and a hash of the production connector/output-contract implementation and
lockfile. Candidate labels, comparison IDs and whole-dataset hashes need not
match. Each repetition uses its own saved sample: one sample is never cloned
into three independent repetitions. Invalid JSON, failed attempts and OpenRouter
routing aliases (`openrouter/free`, `openrouter/auto`) are not reused. Existing
clean legacy reports can be fingerprinted from their saved Git revision; reports
without reconstructable code provenance are misses.

Jev reuse additionally requires the same evaluator hash, judge model/config and
exact atomic question request. Stored raw answers are parsed again. Changing the
judge/rubric or semantic expectations reuses generation but pays for fresh judging.
Deterministic code assertions always run again, including newly added assertions,
without paying to regenerate the same output. Cached deterministic failures
remain failures. Tags and critical flags affect reporting/gates, not generation.

Records retain original timestamps, requested/resolved providers/models, outputs,
tokens/cost and source comparison/attempt/Git identity. `summary.json` separates
`newCalls`, `reused`, `newCostUsd`, `newTokens` and `freshLatency` from historical
benchmark measurements. Missing fresh cost remains unavailable, not zero; fully
reused calls cost zero **in this comparison**, not zero for the model itself.
Performance/cost release budgets use the original benchmark measurements, not the
cache's zero marginal spend. Run without `--reuse` for fresh performance evidence:
cache hits are not new latency tests and provider/model behavior can change over time.

Langfuse receives reuse markers/provenance and original measurements as metadata.
Cached observations have zero newly consumed tokens/cost so publication does not
double-count paid usage. Their latency scores are explicitly marked historical.
The local reports, not a separate cache service, are the cache; preserve them or
download CI artifacts before reusing results on another machine. Ordinary CI
workers do not automatically have your local reports.

## Inspect results

Each comparison directory contains `report.json`, append-only `attempts.jsonl`,
`summary.json`, and, when requested, `publication.json`. Checkpoints preserve
completed attempts if the process is interrupted; an incomplete matrix fails
eligibility. Reports include exact prompts and fingerprints, fixtures/options,
settings/overrides, evaluator definition/hash, dataset hash, Git revision/dirty
state, raw and decoded outputs, provider diagnostics and failure stages.

The CLI computes code assertions and **atomic** Jev criteria: task adherence,
meaning preservation, factual grounding, role completeness, language quality,
usability, context correctness when context exists, and each enabled requested
transformation. Disabled controls do not erase intrinsic role behavior.
Expectations are independent of generator prompts. Jev sees source, context,
requested configuration, frozen role requirements and output, never model IDs
or candidate system prompts. Ordered grades are normalized using their recorded
scale; Noul values are probabilities of true, **not quality percentages**.
Raw responses, confidence and probabilities are retained.

Generation and judging have separate latency, input/output/total tokens,
reasoning/cache counts when reported, and provider-reported USD cost. Summaries
include count/coverage, median/p95 and ranges. Missing metrics are `null` or marked
incomplete, never treated as free or zero. Export token buckets subtract cache
from input and reasoning from inclusive OpenRouter output; Gemini reports thinking
separately, so it is added once to normalized output totals. Raw connector usage is
retained unchanged. Buckets do not add subsets twice. Langfuse may
estimate a cost when a provider did not report one: approval budgets use only
reported local costs, with explicit availability metadata on observations.

Publication mirrors the Git snapshot into a hash-addressed Langfuse dataset and
registers two SDK experiment runs with a shared comparison ID. Open both links
from `publication.json` and select them in Langfuse's experiment comparison UI.
Inspect named scores, roles/options/languages/tags and individual regressions.
Generator and judge have distinct generation observations with original call
timestamps. The SDK task/root duration is **artifact export time**, not inference
latency; use the child observation or `generation_latency_ms`/`judge_latency_ms`.
Scores are externally computed. Do **not** attach an automatic hosted Jev
evaluator to these runs; native hosted Jev remains useful for separate exploration.
Export errors leave local results intact. Retrying may create new trace instances
under the same run name, but never performs additional AI calls.

## Calibrate and approve (repository owner)

```bash
# 40 realistic proposed controls, blank human labels; no AI calls.
npm run eval:calibrate
# Optionally judge controls and publish a review experiment (40 paid Jev calls).
node --env-file=.env.local --import ./scripts/register-npm-imports.mjs \
  --experimental-transform-types scripts/evaluate-experiment.ts \
  --calibrate --judge-controls --publish
```

The controls cover tone, context, unsupported commitments and role completeness.
Proposed labels are suggestions, not completed human calibration, and stay local
to avoid anchoring reviewers. In Langfuse create numeric score configurations for
the dimensions, add calibration traces to an annotation queue, and label them.
Compare human labels with Jev, revise the independent rubric if needed, then rerun
the full acceptance suite. Store evidence and the annotation/review link in notes.

Initial thresholds: minimum .6, overall regression tolerance .02 and slice .05.
They are displayed as **advisory** until an owner-reviewed baseline explicitly
approves semantic gates. Incomplete results, missing required judge scores,
critical deterministic failures and newly failing protected code checks are hard
failures immediately. Optional p95 generation latency and combined generation +
judge cost budgets apply only when configured; unknown cost blocks a cost budget.
Means never hide critical or protected case failures.

Copy `evaluations/baselines/review-input.example.json` to a real review-input file,
set `decision`, `candidateId`, reviewer, evidence/notes, human review URL and the
explicit `semanticGatesApproved` choice. Accepted semantic exceptions must be exact
reported advisory strings; hard failures cannot be excepted. This is a human
attestation, not automatic retrieval/verification of annotation labels.

```bash
npm run eval:review -- --report=evaluation-results/COMPARISON_ID/report.json \
  --review=evaluation-results/review-input.json \
  --output=evaluations/baselines/approved-v1.json
# Subsequent comparisons explicitly reference the approved artifact.
npm run eval:compare -- --experiment=evaluations/experiments/models.ts \
  --suite=all --repeat=3 --baseline=evaluations/baselines/approved-v1.json --publish
```

The approval artifact freezes run IDs, identity/settings, hashes, thresholds,
reviewer/time, exceptions and protected checks. The next definition's baseline
must match that identity (including its ID), dataset, rubric, judge and repetition
count. Rejections can also be recorded without successful publication. Outputs
are created exclusively: an existing baseline is never overwritten. There is no
"latest successful run" baseline and no automatic production promotion. Commit
approval/prompt/model changes in an owner-reviewed PR to main. No baseline is
pre-approved by this implementation.

## CI and verification

The **Paid evaluation experiments** workflow is manually dispatched only. Its
default is one base case, one repetition and concurrency 1. Set the workflow's
`concurrency` input to 5 or 10 for parallel attempts. Configure provider/Langfuse credentials as
repository secrets and `LANGFUSE_BASE_URL` as a repository variable. Artifacts are
uploaded even on failures; run links and gate state appear in the step summary.
Ordinary backend CI checks evaluator types and an in-memory Langfuse exporter,
but never makes paid AI calls.

```bash
npm test -- --runInBand
npm run type-check
npm run type-check:evaluations
npm run test:evaluation-export
npm run lint:portability
```

Rollout still requires a configured Langfuse project, live inspection of both
observations/scores/metadata/costs/comparison links, completed human calibration
and an explicitly approved full-suite baseline. Offline SDK tests or a tiny live
generation smoke test do not substitute for those owner actions.
