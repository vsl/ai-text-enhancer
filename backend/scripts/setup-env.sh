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
        supabase secrets set $key="$value" --env-file .env.local 2>/dev/null || echo "   (using value from environment)"
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

# Set secrets
set_secret "GEMINI_API_KEY" "$GEMINI_API_KEY"
set_secret "OPENROUTER_API_KEY" "$OPENROUTER_API_KEY"
set_secret "USER_SERVICE_URL" "$USER_SERVICE_URL"
set_secret "USER_SERVICE_API_KEY" "$USER_SERVICE_API_KEY"
set_secret "LM_STUDIO_BASE_URL" "$LM_STUDIO_BASE_URL"
set_secret "LLM_TIMEOUT_MS" "$LLM_TIMEOUT_MS"
set_secret "MAX_BATCH_SIZE" "$MAX_BATCH_SIZE"

echo ""
echo "✨ Environment setup complete!"
echo ""
echo "📋 To view secrets: supabase secrets list"
echo "🚀 To deploy: npm run deploy"
