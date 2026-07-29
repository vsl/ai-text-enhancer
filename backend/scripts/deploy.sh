#!/bin/bash

# Deployment script for Supabase Edge Function
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Deploying AI Text Enhancer Backend..."
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "   Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Check if project is linked
if ! supabase status &> /dev/null; then
    echo "❌ Supabase project not linked"
    echo "   Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

# Type check
echo "📝 Type checking..."
npm run type-check || {
    echo "❌ Type check failed"
    exit 1
}
echo "✅ Type check passed"
echo ""

# Run tests
echo "🧪 Running tests..."
npm test || {
    echo "❌ Tests failed"
    exit 1
}
echo "✅ Tests passed"
echo ""

# Check platform portability
echo "🔍 Checking platform portability..."
npm run lint:portability || {
    echo "❌ Portability check failed"
    exit 1
}
echo ""

# Deploy function
echo "📦 Deploying to Supabase..."
supabase functions deploy enhance --no-verify-jwt

# Get function URL
echo ""
echo "🔎 Getting function URL..."
FUNCTION_URL=$(supabase status | grep "API URL" | awk '{print $3}')

if [ -z "$FUNCTION_URL" ]; then
    echo "⚠️  Could not determine function URL automatically"
    echo "   Check Supabase dashboard for deployment status"
else
    echo ""
    echo "✨ Deployment complete!"
    echo ""
    echo "📍 Function URL: $FUNCTION_URL/functions/v1/enhance"
    echo ""
    echo "🏥 Test health endpoint:"
    echo "   curl $FUNCTION_URL/functions/v1/enhance/health"
    echo ""
    echo "📊 View logs:"
    echo "   npm run logs"
fi
