# ================================================
# DEPLOYMENT CHECK SCRIPT (PowerShell)
# ================================================
# Verifica lo stato del deployment

Write-Host "🚀 Amazon Ads Manager - Deployment Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 1: Check Git Status" -ForegroundColor Yellow
Write-Host "----------------------------"
git status --short
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git repository OK" -ForegroundColor Green
} else {
    Write-Host "❌ Git error" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Step 2: Check Remote Branch" -ForegroundColor Yellow
Write-Host "-------------------------------"
git fetch origin main 2>&1 | Out-Null
$ahead = (git rev-list --count origin/main..HEAD)
$behind = (git rev-list --count HEAD..origin/main)

if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host "✅ Local and remote are in sync" -ForegroundColor Green
} elseif ($ahead -gt 0) {
    Write-Host "⚠️  Warning: You have $ahead unpushed commits" -ForegroundColor Yellow
    Write-Host "   Run: git push origin main"
} elseif ($behind -gt 0) {
    Write-Host "⚠️  Warning: Remote is $behind commits ahead" -ForegroundColor Yellow
    Write-Host "   Run: git pull origin main"
}

Write-Host ""
Write-Host "📋 Step 3: Latest Commits" -ForegroundColor Yellow
Write-Host "-------------------------"
git log --oneline -5

Write-Host ""
Write-Host "📋 Step 4: Check Build Status" -ForegroundColor Yellow
Write-Host "------------------------------"
Write-Host "Building TypeScript..."
$buildOutput = npm run build:backend 2>&1 | Select-Object -Last 5
$buildOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Backend build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Step 5: Environment Variables Check" -ForegroundColor Yellow
Write-Host "---------------------------------------"
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
    Write-Host "Required variables:"
    Get-Content .env | Select-String "DATABASE_URL|AMAZON_ADS_CLIENT_ID|AMAZON_ADS_CLIENT_SECRET|JWT_SECRET" | ForEach-Object {
        $line = $_ -replace '=.*', '=***'
        Write-Host "   $line"
    }
} else {
    Write-Host "⚠️  .env file not found (OK if using Render environment variables)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎯 NEXT STEPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Go to Render Dashboard:"
Write-Host "   👉 https://dashboard.render.com" -ForegroundColor Green
Write-Host ""
Write-Host "2️⃣  Find your 'amazon-ads-manager' service"
Write-Host ""
Write-Host "3️⃣  Check deployment status:"
Write-Host "   - Should show 'Live' with green indicator"
Write-Host "   - Check 'Logs' tab for any errors"
Write-Host ""
Write-Host "4️⃣  Run migrations via Shell tab:"
Write-Host "   👉 npm run migrate" -ForegroundColor Green
Write-Host ""
Write-Host "5️⃣  Test OAuth flow:"
Write-Host "   - Visit your production URL"
Write-Host "   - Click 'Connect with Amazon'"
Write-Host "   - Complete OAuth flow"
Write-Host ""
Write-Host "📚 Full checklist: DEPLOYMENT_CHECKLIST.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to open Render Dashboard in browser..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "https://dashboard.render.com"
