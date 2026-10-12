# Backend commands

Run from `backend/` with Node.js 22. `package.json` lists every supported command.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Serve local Edge Functions using `.env.local` |
| `npm run setup:env` | Upload selected runtime keys to `SUPABASE_PROJECT_ID`; requires CLI authentication |
| `npm run health -- https://<project-ref>.supabase.co` | Check public enhance/me health endpoints |
| `npm run type-check` | Check portable core and active HTTP handlers |
| `npm run type-check:evaluations` | Check CLI runners, evaluations and export integration test |
| `npm test -- --runInBand` | Run deterministic Jest tests |
| `npm run lint:portability` | Fail when `src/` uses Deno APIs |
| `npm run test:evaluation-export` | Test the real Langfuse SDK with an in-memory exporter, including failure |
| `npm run eval:compare -- --dry-run` | Validate a comparison and count paid calls offline |

Deployments run through `.github/workflows/backend.yml`. Read
[repository setup](../../docs/getting-started.md) for bootstrap commands. Local
`supabase status` describes the local stack and is not cloud-link verification.
Use the Supabase dashboard for hosted function logs; the removed logs/deploy
wrappers mixed local status with cloud operations.

`setup-env.sh` reads a trusted, shell-compatible `.env.local`. Quote values
containing spaces or JSON. It uploads an explicit runtime allowlist, never the
entire env file or evaluation credentials, and exits unsuccessfully if upload
fails. Set the target project and authenticate before running it. It does not
upload the disabled payment feature's secrets.

Evaluation runners load `.env.evaluation` only when explicitly passed through
Node's `--env-file` flag. `scripts/lib/` contains file/publication adapters;
`evaluations/lib/` contains offline evaluation logic. Generated outputs go to the
ignored `evaluation-results/` directory. See [the evaluation guide](../docs/evaluations.md).
