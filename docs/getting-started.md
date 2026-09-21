# Repository and deployment setup

This repository uses one shared staging environment and one production
environment.

| Change | UI | Backend |
| --- | --- | --- |
| Pull request to `main` | Cloudflare Pages Preview | Staging Supabase, only when `backend/` code changes |
| Merge to `main` | Cloudflare Pages Production | Production Supabase, only when `backend/` code changes |

A UI-only pull request uses the latest shared staging backend.

## 1. Create the Supabase environments

Keep the existing live project as production. In the
[Supabase dashboard](https://database.new), create a second project named
`ai-text-enhancer-staging`, preferably in the same region. Save each project
reference and database password.

For each project:

1. Open **Settings > API Keys**.
2. Copy or create a publishable key for the UI.
3. Create a secret key for the backend. The workflow stores it under the
   existing `APP_SUPABASE_SERVICE_ROLE_KEY` application variable.
4. Copy the legacy JWT secret for `APP_SUPABASE_JWT_SECRET`.

The backend currently verifies user tokens with the legacy JWT secret. Do not
rotate Auth to an asymmetric signing key until that code is migrated to JWKS
verification.

Open **Authentication > Providers** and enable **Anonymous Sign-Ins**. Disable
email/password signups and any OAuth providers. The public UI creates an
anonymous session in the background, so it does not need Auth redirect URLs.

The first successful backend deployment applies migrations, syncs function
secrets, and deploys the Edge Functions.

## 2. Add GitHub Actions secrets

Open the repository's **Settings > Secrets and variables > Actions**, then add
these repository secrets.

Shared by staging and production:

- `SUPABASE_ACCESS_TOKEN`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `LLM_TIMEOUT_MS` (optional; defaults to `30000`)
- `MAX_BATCH_SIZE` (optional; defaults to `10`)

Add every name below twice, once with the `STAGING_` prefix and once with the
`PRODUCTION_` prefix:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `APP_SUPABASE_JWT_SECRET`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `BOOTSTRAP_SECRET_KEY`

For example, add `STAGING_SUPABASE_PROJECT_ID` and
`PRODUCTION_SUPABASE_PROJECT_ID`.

After the first anonymous-only deployment, remove the two dormant payment
functions once from both linked projects:

```bash
supabase functions delete create-checkout --project-ref <project-ref>
supabase functions delete stripe-webhook --project-ref <project-ref>
```

They are no longer deployed or supplied with payment secrets. Their source and
historical database records remain in the repository.

## 3. Connect Cloudflare Pages

In **Workers & Pages**, create a Pages project using **Connect to Git**,
authorize the Cloudflare GitHub application for `vsl/ai-text-enhancer`, and
use:

- Production branch: `main`
- Root directory: `ui`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Environment variable `NODE_VERSION`: `22`

Under **Settings > Build > Build watch paths**:

- Include: `ui/*`
- Exclude: `ui/*.md`

Under **Settings > Variables and Secrets**, add these variables to both
Production and Preview, using production Supabase values for Production and
staging Supabase values for Preview:

- `NEXT_PUBLIC_APP_SUPABASE_URL`
- `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY` (use the publishable key)
- `NEXT_PUBLIC_API_BASE_URL`

The API base URL is:

```text
https://<supabase-project-ref>.supabase.co/functions/v1
```

Cloudflare creates preview URLs only for pull requests whose branches are in
this repository, not forks.

## 4. Configure the weekly anonymous allowance

The database resets every anonymous user's balance each Monday at 00:00 UTC.
Change the allowance without redeploying:

```sql
update private.runtime_settings
set bigint_value = <amount>
where setting_name = 'anonymous_weekly_token_allowance';
```

The new value applies immediately to new anonymous sessions and at the next
weekly reset to existing sessions. Apply it to existing sessions immediately
when needed:

```sql
select private.reset_anonymous_quotas();
```

Run these statements as the database owner. Neither interface is available to
the public Data API roles.

## 5. Work through pull requests

Never push directly to `main`.

```bash
git switch main
git pull --ff-only
git switch -c agent/<short-description>

# edit and validate
git add <files>
git commit -m "<description>"
git push -u origin agent/<short-description>
```

Open a pull request to `main`, wait for checks and preview deployments, then
review and merge it yourself. After merging, update locally:

```bash
git switch main
git pull --ff-only
```

## GitHub Free limitation

GitHub does not enforce protected branches or provide GitHub Environments for
a private repository on a personal Free account. This repository therefore
uses prefixed repository secrets and an explicit PR-only process. Only the
repository owner should have write access.

If the account is upgraded later, configure a `main` ruleset requiring a pull
request, one approval, resolved conversations, and the `UI / check` and
`Backend / check` status checks. Until then, the rules in `AGENTS.md` instruct
Codex not to push directly to `main`.

References:

- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Cloudflare Pages build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
