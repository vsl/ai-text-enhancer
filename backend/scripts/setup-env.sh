#!/bin/bash

# Setup script for Supabase environment variables
# Usage: ./scripts/setup-env.sh

set -e

echo "🔧 Setting up Supabase Edge Function environment..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Check if project is linked
if ! supabase status &> /dev/null; then
    echo "❌ Supabase project not linked. Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

# Function to set secret
set_secret() {
    local key=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo "⚠️  Skipping $key (not set)"
    else
        echo "✅ Setting $key"
        # Only deploy the explicitly selected runtime key, never the entire
        # local file (which may also contain evaluation-only Langfuse keys).
        supabase secrets set "$key=$value" 2>/dev/null || echo "   (using value from environment)"
    fi
}

# Load from .env.local if exists
if [ -f .env.local ]; then
    echo "📄 Loading variables from .env.local..."
    export $(cat .env.local | grep -v '^#' | xargs)
fi

echo ""
echo "Setting secrets..."
echo ""

# Explicit runtime allowlist: keep app configuration without uploading local
# evaluation credentials or CLI access tokens. SUPABASE_URL is platform-provided.
for runtime_key in \
    APP_SUPABASE_SERVICE_ROLE_KEY APP_SUPABASE_JWT_SECRET BOOTSTRAP_SECRET_KEY \
    OPENROUTER_API_KEY GEMINI_API_KEY USER_SERVICE_URL USER_SERVICE_API_KEY \
    LM_STUDIO_BASE_URL LLM_TIMEOUT_MS MAX_BATCH_SIZE JEV_MODEL_ID JEV_TIMEOUT_MS \
    LOG_LEVEL EXPOSE_ERROR_DETAILS LANGSMITH_TRACING LANGSMITH_API_KEY \
    LANGSMITH_PROJECT LANGSMITH_ENDPOINT LANGSMITH_CAPTURE_CONTENT APP_ENV APP_RELEASE; do
    set_secret "$runtime_key" "${!runtime_key}"
done

echo ""
echo "✨ Environment setup complete!"
echo ""
echo "📋 To view secrets: supabase secrets list"
echo "🚀 To deploy: npm run deploy"
