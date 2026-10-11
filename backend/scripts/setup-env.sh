#!/bin/bash
# Sync only current runtime keys. Run from backend/ with SUPABASE_PROJECT_ID set.
set -euo pipefail
command -v supabase >/dev/null || { echo 'Supabase CLI is required' >&2; exit 1; }

if [ -f .env.local ]; then
  set -a
  # This is a trusted, shell-compatible local configuration file.
  source .env.local
  set +a
fi
: "${SUPABASE_PROJECT_ID:?Set SUPABASE_PROJECT_ID to the target cloud project reference}"

secrets=()
for runtime_key in \
  APP_SUPABASE_SERVICE_ROLE_KEY OPENROUTER_API_KEY BOOTSTRAP_SECRET_KEY ADMIN_BOOTSTRAP_USERS_JSON \
  LLM_TIMEOUT_MS MAX_BATCH_SIZE JEV_MODEL_ID JEV_TIMEOUT_MS LOG_LEVEL EXPOSE_ERROR_DETAILS \
  LANGSMITH_TRACING LANGSMITH_API_KEY LANGSMITH_PROJECT LANGSMITH_ENDPOINT \
  LANGSMITH_CAPTURE_CONTENT APP_ENV APP_RELEASE; do
  value="${!runtime_key-}"
  if [ -n "$value" ]; then secrets+=("$runtime_key=$value"); fi
done
if [ "${#secrets[@]}" -eq 0 ]; then echo 'No runtime secrets configured' >&2; exit 1; fi
supabase secrets set --project-ref "$SUPABASE_PROJECT_ID" "${secrets[@]}"
echo 'Runtime secrets synchronized.'
