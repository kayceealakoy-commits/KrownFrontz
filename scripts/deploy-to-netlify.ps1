# Deploy Krown Frontz to Netlify + krownfrontz.com
# Run from the krown-frontz folder in PowerShell.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "=== Krown Frontz deploy ===" -ForegroundColor Cyan

# 1. Dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2. Netlify login (opens browser if needed)
$status = npx netlify status 2>&1 | Out-String
if ($status -match "Not logged in") {
  Write-Host "`nLogging in to Netlify (browser will open)..." -ForegroundColor Yellow
  npx netlify login
}

# 3. Link site if not linked
if (-not (Test-Path ".netlify\state.json")) {
  Write-Host "`nLinking to Netlify site (follow prompts)..." -ForegroundColor Yellow
  npx netlify init
}

# 4. Remind about env vars
Write-Host "`n--- Environment variables ---" -ForegroundColor Cyan
Write-Host "Set these in Netlify if not already done:"
Write-Host "  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_URL=https://krownfrontz.com"
Write-Host "  ORDER_NOTIFICATION_EMAIL=krownfrontz@gmail.com"
Write-Host "Security (Stripe Dashboard): enable Radar + 3DS; use sk_live_ keys in production."
Write-Host "See docs/stripe-dashboard-security.md for Radar, 3DS, and webhook setup."
Write-Host ""

$confirm = Read-Host "Have production env vars been set in Netlify? (y/n)"
if ($confirm -ne "y") {
  Write-Host "Set env vars in Netlify dashboard, then re-run this script." -ForegroundColor Yellow
  Write-Host "  npx netlify env:set SITE_URL https://krownfrontz.com"
  exit 0
}

# 5. Deploy
Write-Host "`nDeploying to production..." -ForegroundColor Yellow
npx netlify deploy --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== Deploy complete ===" -ForegroundColor Green
Write-Host "Next steps (see DEPLOY.md):"
Write-Host "  1. Add krownfrontz.com in Netlify Domain management"
Write-Host "  2. Point Hostinger DNS A/CNAME records to Netlify"
Write-Host "  3. Create Stripe live webhook: https://krownfrontz.com/api/stripe-webhook"
Write-Host "  4. Enable Stripe Radar + 3DS; verify headers at securityheaders.com"
