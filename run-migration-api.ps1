# ================================================
# RUN MIGRATIONS VIA API (PowerShell)
# ================================================
# Script to run database migrations via API endpoint
# For use with Render free tier (no shell access)

Write-Host "🚀 Running Database Migrations via API" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Get your app URL and secret
$APP_URL = Read-Host "Enter your Render app URL (e.g., https://your-app.onrender.com)"
$MIGRATION_SECRET = Read-Host "Enter your MIGRATION_SECRET" -AsSecureString
$MIGRATION_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($MIGRATION_SECRET)
)

Write-Host ""

# Remove trailing slash from URL
$APP_URL = $APP_URL.TrimEnd('/')

Write-Host "📡 Connecting to: $APP_URL/api/migrate" -ForegroundColor Yellow
Write-Host ""

try {
    # Run migrations
    $headers = @{
        "Authorization" = "Bearer $MIGRATION_SECRET_PLAIN"
        "Content-Type" = "application/json"
    }

    $response = Invoke-RestMethod -Uri "$APP_URL/api/migrate" `
        -Method POST `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Migration Results:" -ForegroundColor Cyan
    Write-Host ""

    $response | ConvertTo-Json -Depth 10 | Write-Host

    Write-Host ""
    Write-Host "🎉 Migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Test OAuth login at: $APP_URL" -ForegroundColor White
    Write-Host "   2. Connect your Amazon account" -ForegroundColor White
    Write-Host "   3. Sync campaigns" -ForegroundColor White
    Write-Host ""

} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 401) {
        Write-Host "❌ UNAUTHORIZED" -ForegroundColor Red
        Write-Host ""
        Write-Host "The MIGRATION_SECRET is incorrect." -ForegroundColor Yellow
        Write-Host "Please check your Render environment variables." -ForegroundColor Yellow
    } else {
        Write-Host "❌ ERROR (Status: $statusCode)" -ForegroundColor Red
        Write-Host ""
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
