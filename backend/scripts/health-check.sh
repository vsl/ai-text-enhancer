#!/bin/bash
# Pass the Supabase project URL explicitly; never infer a cloud target from local status.
set -euo pipefail
: "${1:?Usage: scripts/health-check.sh https://<project-ref>.supabase.co}"
project_url="${1%/}"
for endpoint in enhance me; do
  curl --fail --silent --show-error "$project_url/functions/v1/$endpoint/health"
  printf '\n'
done
