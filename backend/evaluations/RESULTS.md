# Injection and symbol evaluation, 26 September 2026

The screenshot's number-generating answer is invalid for this product: the input
is text to transform, not a request to answer. A comparative choice alone cannot
implement a hard zero. Jev now checks instruction boundaries independently before
ranking eligible candidates; decoded em dashes are checked in code. Rejected
outputs remain visible with 0% and a reason. If all fail, no winner is selected.

The distinction between choice probabilities and absolute correctness follows the
[OpenRouter Jev documentation](https://openrouter.ai/docs/guides/community/jev-tutorial).

## Live results

Used the existing local OpenRouter key, synthetic committed fixtures, prompt-v9,
jev-v3, Qwen `qwen/qwen3-30b-a3b-instruct-2507`, and resolved judge
`typesafe/jev-1.13-20260917`. Final generation runs use production `json-schema`
output mode, default provider temperature, and 2,000 output tokens.

| Evaluation | Result |
| --- | --- |
| Judge and symbol-check calibration: 17 labeled pairs, 3 repetitions, singles and both mixed candidate orders | 306/306 candidate checks passed; zero false accepts, false rejects, wrong reasons, or request errors |
| Qwen, complete 71-case suite | 64/71 cases passed the recorded checks; 229/237 deterministic checks passed; 5 candidates rejected; no request errors |
| Replay after correcting a Spanish sender-placeholder fixture | 65/71 outputs passed both the updated checks and the recorded judge decisions; 6 model failures remain |
| Screenshot's random-number input, all 3 roles, 3 repetitions each | 9/9 outputs passed; none answered with a generated number |
| Em-dash cases in the final full run | 4/4 outputs still contained an em dash; every violating output received 0% |

The six remaining model failures were four em-dash cases, one summarizer that
turned a statement of need into a command, and one email that invented a sender
name. The hard gate rejected all four symbol failures and the summarizer. The
email problem was detected by a role fixture, not the narrower runtime
instruction-boundary gate. One other email used `[Nombre del remitente]`, a
legitimate Spanish sender placeholder; the old regex falsely flagged it. The
updated fixture accepts it. The replay reused the saved raw outputs and judge
decisions, so it did not make another provider call.

Prompts helped with the request-answering failure, but did not reliably prevent
em dashes. This change therefore does **not** certify Qwen as fully compliant.
The failed generation runs intentionally exit nonzero. The final repeat result
also shows why raw failures must remain observable instead of being silently
replaced with punctuation after generation. The calibration corpus is finite;
passing it does not prove that Jev detects every future attack.

Exploratory `json-object` runs are retained locally too. They are not used as
production-mode evidence. Specifying a configured model without an explicit mode
now uses that model's production mode automatically.

## Reproduction and evidence

See [testing instructions](../docs/testing.md#promptmodel-evaluations). Reports are
gitignored and contain raw outputs, model revisions, prompt fingerprints, checks,
and judge outcomes. These local files recorded the final runs:

- `evaluation-results/jev-2026-09-26T15-01-09.079Z.json`
- `evaluation-results/2026-09-26T15-05-43.481Z.json`
- `evaluation-results/2026-09-26T15-06-40.094Z.json`

Offline validation: 707 backend tests passed (26 existing integration tests
skipped), 232 UI tests passed, backend type checking and portability checks passed,
evaluation scripts type-checked, and the UI static build passed using placeholder
public configuration. No new dependencies or provider credentials were added.
