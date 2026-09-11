# Set Netlify production environment variables via CLI.
# Prefer the go-live script for production:
#   npm run go-live
# Or with keys from local .env:
#   powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1 -FromEnv
#
# This script remains for partial updates:
#   powershell -ExecutionPolicy Bypass -File scripts/set-netlify-env.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

Write-Host "Tip: use 'npm run go-live' for full Stripe production setup + deploy." -ForegroundColor Cyan
Write-Host ""

$vars = @{
  SITE_URL                  = "https://krownfrontz.com"
  ORDER_NOTIFICATION_EMAIL  = "krownfrontz@gmail.com"
  ORDER_NOTIFICATION_FROM   = "orders@krownfrontz.com"
  # Paste your live keys below before running:
  STRIPE_SECRET_KEY         = "sk_live_REPLACE_ME"
  STRIPE_WEBHOOK_SECRET     = "whsec_REPLACE_ME"
  RESEND_API_KEY            = ""
}

foreach ($key in $vars.Keys) {
  $val = $vars[$key]
  if ([string]::IsNullOrWhiteSpace($val) -or $val -match "REPLACE_ME") {
    Write-Host "Skipping $key (not set)" -ForegroundColor DarkYellow
    continue
  }
  Write-Host "Setting $key..."
  npx netlify env:set $key $val --context production
}

Write-Host "`nVerify: npm run verify-production-env -- --check-only" -ForegroundColor Cyan
Write-Host "Deploy: npx netlify deploy --prod" -ForegroundColor Cyan
