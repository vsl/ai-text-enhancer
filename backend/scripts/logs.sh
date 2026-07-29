#!/bin/bash

# View function logs
# Usage: ./scripts/logs.sh [--tail]

set -e

# Check if Supabase CLI is installed
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

if [ "$1" = "--tail" ]; then
    echo "📊 Tailing logs (Ctrl+C to stop)..."
    echo ""
    supabase functions logs enhance --tail
else
    echo "📊 Recent logs:"
    echo ""
    supabase functions logs enhance
fi
