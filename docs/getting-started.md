# Deploy from scratch

This guide configures the application as two Supabase projects and one
Cloudflare Pages project. It matches the code and workflows in this repository.

## What will be deployed

| Event | UI | Backend |
| --- | --- | --- |
| Pull request to `main` | Cloudflare Pages Preview, built with staging values | Staging Supabase when the PR changes non-documentation files in `backend/` |
| Merge to `main` | Cloudflare Pages Production, built with production values | Production Supabase when the merge changes non-documentation files in `backend/` |

Cloudflare's Git integration deploys the static UI. GitHub Actions runs checks;
the `Backend` workflow applies migrations, synchronizes function secrets, and
deploys the `enhance`, `me`, and `admin` Edge Functions.

The application uses anonymous Supabase Auth sessions. The browser holds only
a Supabase publishable key; database, provider, and bootstrap secrets remain
in GitHub Actions and Supabase Edge Functions.

## Before you start

Use the same Supabase organization for both projects. Keep the two deployment
environments separate by using distinct projects, database passwords, API
keys, and bootstrap secrets.

| System | Person setting it up needs | Other contributors need |
| --- | --- | --- |
| Supabase | Organization owner (or a role allowed to create projects and view API keys) | No project access unless they operate the backend |
| GitHub | Repository **admin** to add Actions secrets and configure Actions | Write access to open deployment pull requests |
| Cloudflare | Account access to create and edit Pages projects | No Cloudflare access for normal code changes |
| GitHub organization | Organization owner or GitHub App manager if it restricts app installations | None |

The current backend configuration uses OpenRouter for both available models.

Use Node.js 22 for local checks. Install the Supabase CLI only for the
one-time command-line bootstrap below. Never put a service-role key, Supabase
access token, database password, or LLM key in `ui/.env.local`, a Cloudflare
variable, source code, or a committed file.

## 1. Create the provider key

### OpenRouter

1. In [OpenRouter Keys](https://openrouter.ai/keys), create a usage API key
   named `ai-text-enhancer`.
2. Set an environment-appropriate spend limit; use a lower limit for staging.
3. Copy the value immediately into a password manager. A newly created key is
   shown only once.

This is a server-side usage key for OpenRouter's chat-completions API. Do not
use an OpenRouter management key.

The default model is `openrouter/free`, which routes to a free model that
supports the requested features. The second model is `openai/gpt-5-nano`, a
paid OpenRouter model. Both are available to every user tier, so set a spend
limit that includes GPT-5 Nano usage.

## 2. Create the Supabase organization and two projects

1. Open [Supabase](https://database.new). If the organization picker does not
   show a suitable organization, choose **New organization**.
2. Set its name to your company or product name, such as `AI Text Enhancer`.
   Choose its billing plan and invite only the people who need to administer
   Supabase. This organization owns both projects and their billing.
3. Select that organization, then choose **New project** twice. Use these
   exact environment names:

   | Project | Name | Recommended creation settings |
   | --- | --- | --- |
   | Staging | `ai-text-enhancer-staging` | Same region as production; its own strong database password |
   | Production | `ai-text-enhancer-production` | Same region as staging; a different strong database password |

4. Keep the default PostgreSQL engine and select the smallest compute size
   appropriate for each environment. Store the database password at creation
   time; it cannot be read back from the dashboard.

For **each** project, wait until its status is healthy, then save these values
in a password manager:

| Value | Dashboard location | Used for |
| --- | --- | --- |
| Project ref | **Settings > General** | function URL and `*_SUPABASE_PROJECT_ID` |
| Database password | chosen at project creation | `supabase db push` in Actions |
| Project URL | **Connect** (top bar), or `https://<project-ref>.supabase.co` | Cloudflare UI variable |
| Default publishable key | **Settings > API Keys > Publishable and secret API keys** | Cloudflare UI variable only |
| Secret key (preferred) or legacy service-role key | **Settings > API Keys** | `*_APP_SUPABASE_SERVICE_ROLE_KEY` |

For a newly created project, copy the `default` publishable key and the
`default` secret key from **Publishable and secret API keys**. The backend
verifies user sessions through Supabase Auth, which supports the current
asymmetric JWT signing keys through the project's JWKS. A publishable key may
be exposed in the browser; the secret key must not be.

For **each** project, open **Authentication > Sign In / Providers** and:

1. Enable **Allow new users to sign up**. Anonymous sign-in creates a user.
2. Enable **Allow anonymous sign-ins**.
3. Keep **Allow manual linking** and **Confirm email** disabled.
4. Disable individual email/password and OAuth providers; do not disable the
   global "Allow new users to sign up" setting.
5. Leave CAPTCHA disabled for now: the UI does not send a CAPTCHA token.
6. Leave redirect URLs unset; this anonymous-only UI does not use them.

The first migration creates the private weekly allowance and schedules its
Monday 00:00 UTC reset through `pg_cron`. No manual SQL setup is needed.

## 3. Authorize GitHub Actions and add its secrets

In the repository, open **Settings > Actions > General** and allow GitHub
Actions to run. Leave workflow permissions at the default read-only setting;
the checked-in workflow explicitly uses `contents: read` and needs no GitHub
personal access token.

Create `SUPABASE_ACCESS_TOKEN` after both Supabase projects exist. In
Supabase **Account > Access Tokens**, create a scoped token named
`ai-text-enhancer-github-actions`:

1. Choose **Project** access, select the application organization, and select
   both the staging and production projects.
2. Use **Custom** permissions, not **Full access**:
   - **Project > Project Settings:** Read
   - **Database > Migrations:** Read-write
   - **Application services > Edge Functions:** Read-write
   - If listed separately, **Edge Function Secrets:** Read-write
3. Set an expiry date and rotate the token before it expires. Do not grant
   billing, organization, API-key, Auth-settings, backup, or member-management
   access.

Then open **Settings > Secrets and variables > Actions** and create these
**repository secrets** (not variables). Repository secrets are deliberate:
they keep production credentials scoped to this one repository. If you use
organization secrets instead, restrict each secret to this repository.

| Secret name | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | The scoped token created above |
| `OPENROUTER_API_KEY` | The OpenRouter usage API key |
| `LLM_TIMEOUT_MS` | Optional; use `30000` or omit it for the default |
| `MAX_BATCH_SIZE` | Optional; use `10` or omit it for the default |
| `STAGING_SUPABASE_PROJECT_ID` | Staging project ref |
| `STAGING_SUPABASE_DB_PASSWORD` | Staging database password |
| `STAGING_APP_SUPABASE_SERVICE_ROLE_KEY` | Staging secret/service-role key |
| `STAGING_BOOTSTRAP_SECRET_KEY` | Unique random staging bootstrap secret |
| `PRODUCTION_SUPABASE_PROJECT_ID` | Production project ref |
| `PRODUCTION_SUPABASE_DB_PASSWORD` | Production database password |
| `PRODUCTION_APP_SUPABASE_SERVICE_ROLE_KEY` | Production secret/service-role key |
| `PRODUCTION_BOOTSTRAP_SECRET_KEY` | Different random production bootstrap secret |

Generate two different random 32+ character bootstrap secrets in a password
manager and retain them. They are not UI credentials. The checked-in backend
workflow selects `STAGING_` values
for pull requests and `PRODUCTION_` values after a merge to `main`. No
Cloudflare API token is required. GitHub does not provide repository secrets
to fork pull requests, so use a branch in this repository for deployment PRs.

Protect `main` in **Settings > Branches** (or **Rules**) so production comes
from reviewed pull requests. Do not grant normal contributors repository-admin
access: repository admins can edit the production secrets.

## 4. Bootstrap Supabase from a local `.env`

The workflow intentionally has no manual-dispatch trigger. To deploy the
untouched baseline, bootstrap manually once for staging and once for
production. `backend/.env` is already ignored by Git, so it keeps values out
of source control and out of command history.

Create `backend/.env` for **staging** first. This is a shell file, so use
shell-safe quoted values; regenerate a locally generated secret if quoting it
would be awkward.

```dotenv
SUPABASE_ACCESS_TOKEN='sbp_...'
SUPABASE_PROJECT_ID='staging-project-ref'
SUPABASE_DB_PASSWORD='staging-database-password'
OPENROUTER_API_KEY='sk-or-v1-...'
APP_SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'
BOOTSTRAP_SECRET_KEY='staging-random-bootstrap-secret'
LLM_TIMEOUT_MS='30000'
MAX_BATCH_SIZE='10'
```

Run the following from the repository root:

```bash
cd backend
chmod 600 .env
set -a
source .env
set +a

supabase link --project-ref "$SUPABASE_PROJECT_ID"
supabase secrets set \
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  APP_SUPABASE_SERVICE_ROLE_KEY="$APP_SUPABASE_SERVICE_ROLE_KEY" \
  BOOTSTRAP_SECRET_KEY="$BOOTSTRAP_SECRET_KEY" \
  LLM_TIMEOUT_MS="$LLM_TIMEOUT_MS" \
  MAX_BATCH_SIZE="$MAX_BATCH_SIZE"
supabase db push --linked
for function in enhance admin me; do
  supabase functions deploy "$function" --no-verify-jwt
done
```

Replace the values in the same `backend/.env` with the production values,
including a different `BOOTSTRAP_SECRET_KEY`, and run the same commands again.
`SUPABASE_URL` is supplied by the hosted Edge Functions runtime, so do not set
it as a secret. Close the terminal when finished or run `unset` for the loaded
variables.

Alternatively, a PR containing a genuine `backend/` change deploys staging;
after review and merge, the same workflow deploys production. Do not make a
no-op source change merely to trigger a deployment.

Only `enhance`, `me`, and `admin` are deployed. If legacy payment
functions exist from an earlier deployment, remove them once per project:

```bash
supabase functions delete create-checkout --project-ref <project-ref>
supabase functions delete stripe-webhook --project-ref <project-ref>
```

## 5. Connect Cloudflare Pages to GitHub

1. In the intended Cloudflare account, open **Workers & Pages > Create
   application > Pages > Connect to Git** and choose GitHub.
2. When GitHub asks where to install the Cloudflare Workers & Pages GitHub App,
   choose **Only select repositories**, then select this repository. This is
   the least-privilege option; do not grant it every repository in the
   organization.
3. If the repository is not listed, a GitHub organization owner or GitHub App
   manager must approve the app installation in the GitHub organization. Retry
   the Cloudflare connection after approval.
4. Select the repository in Cloudflare and use these build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Root directory | `ui` |
   | Framework preset | `Next.js (Static HTML Export)` |
   | Build command | `npm run build` |
   | Build output directory | `out` |
   | Environment variable | `NODE_VERSION=22` |

Under **Settings > Builds > Build watch paths**, include `ui/*` and exclude
`ui/*.md`. This prevents backend-only commits from rebuilding Pages. One
Cloudflare Pages project is enough: `main` is its Production environment and
same-repository pull requests automatically create Preview deployments. There
is no second Cloudflare project and no Cloudflare staging secret.

Under **Settings > Variables and Secrets**, create these plain build variables
in both environments. They are compiled into the browser bundle, so all three
must be public-safe values.

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_SUPABASE_URL` | Production project URL | Staging project URL |
| `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY` | Production publishable key | Staging publishable key |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<production-ref>.supabase.co/functions/v1` | `https://<staging-ref>.supabase.co/functions/v1` |

Do not add provider keys, a service-role key, database password,
or `SUPABASE_ACCESS_TOKEN` to Cloudflare. Cloudflare creates preview URLs for
same-repository pull requests; a UI-only preview uses the shared staging API.

After connecting, open **Settings > Builds** and use **Manage** beside the
Git repository to review or change the selected GitHub repository. The
Cloudflare GitHub App connection—not a Cloudflare API token in GitHub—is what
creates the Pages preview and production deployments.

## 6. Verify and operate

For each Supabase project, confirm both public health endpoints return JSON
with `status: "ok"`:

```bash
curl --fail https://<project-ref>.supabase.co/functions/v1/enhance/health
curl --fail https://<project-ref>.supabase.co/functions/v1/me/health
```

Open the Cloudflare Pages Preview URL and verify it creates an anonymous
session, loads the usage profile, and produces a result with both assistants.
After merging, repeat those checks on the production `*.pages.dev` URL (and
custom domain, if configured).

To change the anonymous weekly allowance after deployment, run this as the
database owner in the appropriate project's SQL editor:

```sql
update private.runtime_settings
set bigint_value = <amount>
where setting_name = 'anonymous_weekly_token_allowance';

-- Optional: apply the new amount to existing anonymous users immediately.
select private.reset_anonymous_quotas();
```

Use branches and pull requests; never push directly to `main`. A backend PR
updates the one shared staging project. When rotating a provider, Supabase, or
bootstrap secret, update GitHub first, then deploy a backend PR so the
workflow synchronizes it. For a Cloudflare build value, update the relevant
Production or Preview variable and trigger a UI deployment.

Useful current documentation: [Supabase CLI](https://supabase.com/docs/reference/cli/introduction),
[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous),
[Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/),
[Cloudflare preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/),
and [OpenRouter authentication](https://openrouter.ai/docs/quickstart).
