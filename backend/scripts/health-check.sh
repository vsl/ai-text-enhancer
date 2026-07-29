#!/bin/bash

# Health check script
# Usage: ./scripts/health-check.sh [URL]

set -e

# Get function URL from argument or try to detect
if [ -n "$1" ]; then
    FUNCTION_URL="$1"
else
    # Try to get from supabase status
    if command -v supabase &> /dev/null && supabase status &> /dev/null; then
        FUNCTION_URL=$(supabase status | grep "API URL" | awk '{print $3}')
    fi
fi

if [ -z "$FUNCTION_URL" ]; then
    echo "❌ Could not determine function URL"
    echo ""
    echo "Usage: ./scripts/health-check.sh <URL>"
    echo ""
    echo "Example:"
    echo "  ./scripts/health-check.sh https://YOUR_PROJECT_REF.supabase.co"
    exit 1
fi

HEALTH_URL="$FUNCTION_URL/functions/v1/enhance/health"

echo "🏥 Checking health at: $HEALTH_URL"
echo ""

# Make request and capture response + status code
RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

# Check if HTTP code is numeric (handles curl errors)
if ! [[ "$HTTP_CODE" =~ ^[0-9]+$ ]]; then
    echo "❌ Health check failed - connection error"
    echo "   Response: $RESPONSE"
    exit 1
fi

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
    echo ""
    echo "Response: $BODY"
    echo "HTTP Status: $HTTP_CODE"
    echo ""
    echo "✨ Function is healthy and responding!"
else
    echo "❌ Health check failed"
    echo ""
    echo "Response: $BODY"
    echo "HTTP Status: $HTTP_CODE"
    exit 1
fi
