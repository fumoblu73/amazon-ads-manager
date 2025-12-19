#!/bin/bash
# ================================================
# RUN MIGRATIONS VIA API
# ================================================
# Script to run database migrations via API endpoint
# For use with Render free tier (no shell access)

echo "🚀 Running Database Migrations via API"
echo "======================================="
echo ""

# Get your app URL and secret
read -p "Enter your Render app URL (e.g., https://your-app.onrender.com): " APP_URL
read -sp "Enter your MIGRATION_SECRET: " MIGRATION_SECRET
echo ""
echo ""

# Remove trailing slash from URL
APP_URL=${APP_URL%/}

echo "📡 Connecting to: $APP_URL/api/migrate"
echo ""

# Run migrations
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$APP_URL/api/migrate" \
  -H "Authorization: Bearer $MIGRATION_SECRET" \
  -H "Content-Type: application/json")

HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "📊 Response Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
    echo "✅ SUCCESS"
    echo ""
    echo "$HTTP_BODY" | python3 -m json.tool 2>/dev/null || echo "$HTTP_BODY"
    echo ""
    echo "🎉 Migrations completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Test OAuth login at: $APP_URL"
    echo "   2. Connect your Amazon account"
    echo "   3. Sync campaigns"
    echo ""
elif [ "$HTTP_STATUS" -eq 401 ]; then
    echo "❌ UNAUTHORIZED"
    echo ""
    echo "The MIGRATION_SECRET is incorrect."
    echo "Please check your Render environment variables."
    echo ""
else
    echo "❌ ERROR"
    echo ""
    echo "$HTTP_BODY" | python3 -m json.tool 2>/dev/null || echo "$HTTP_BODY"
    echo ""
fi
