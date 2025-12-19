#!/bin/bash
# ================================================
# DEPLOYMENT CHECK SCRIPT
# ================================================
# Verifica lo stato del deployment e esegue le migrazioni

echo "🚀 Amazon Ads Manager - Deployment Check"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

echo "📋 Step 1: Check Git Status"
echo "----------------------------"
git status --short
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Git repository OK${NC}"
else
    echo -e "${RED}❌ Git error${NC}"
    exit 1
fi

echo ""
echo "📋 Step 2: Check Remote Branch"
echo "-------------------------------"
git fetch origin main
AHEAD=$(git rev-list --count origin/main..HEAD)
BEHIND=$(git rev-list --count HEAD..origin/main)

if [ $AHEAD -eq 0 ] && [ $BEHIND -eq 0 ]; then
    echo -e "${GREEN}✅ Local and remote are in sync${NC}"
elif [ $AHEAD -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: You have $AHEAD unpushed commits${NC}"
    echo "   Run: git push origin main"
elif [ $BEHIND -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Remote is $BEHIND commits ahead${NC}"
    echo "   Run: git pull origin main"
fi

echo ""
echo "📋 Step 3: Latest Commits"
echo "-------------------------"
git log --oneline -5

echo ""
echo "📋 Step 4: Check Build Status"
echo "------------------------------"
echo "Building TypeScript..."
npm run build:backend 2>&1 | tail -5

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

echo ""
echo "📋 Step 5: Environment Variables Check"
echo "---------------------------------------"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file found${NC}"
    echo "Required variables:"
    grep -E "DATABASE_URL|AMAZON_ADS_CLIENT_ID|AMAZON_ADS_CLIENT_SECRET|JWT_SECRET" .env | sed 's/=.*/=***/' || echo -e "${YELLOW}⚠️  Some variables may be missing${NC}"
else
    echo -e "${YELLOW}⚠️  .env file not found (OK if using Render environment variables)${NC}"
fi

echo ""
echo "========================================"
echo "🎯 NEXT STEPS"
echo "========================================"
echo ""
echo "1️⃣  Go to Render Dashboard:"
echo "   👉 https://dashboard.render.com"
echo ""
echo "2️⃣  Find your 'amazon-ads-manager' service"
echo ""
echo "3️⃣  Check deployment status:"
echo "   - Should show 'Live' with green indicator"
echo "   - Check 'Logs' tab for any errors"
echo ""
echo "4️⃣  Run migrations via Shell tab:"
echo "   👉 npm run migrate"
echo ""
echo "5️⃣  Test OAuth flow:"
echo "   - Visit your production URL"
echo "   - Click 'Connect with Amazon'"
echo "   - Complete OAuth flow"
echo ""
echo "📚 Full checklist: DEPLOYMENT_CHECKLIST.md"
echo ""
