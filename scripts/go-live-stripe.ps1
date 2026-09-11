# Configure Stripe + Netlify for Krown Frontz production go-live.
# Usage:
#   1. Edit the $vars block below with your live Stripe keys
#   2. powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1
#
# Or load from local .env (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET only):
#   powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1 -FromEnv

param(
  [switch]$FromEnv
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

function Read-DotEnvValue($key) {
  $envPath = Join-Path (Get-Location) ".env"
  if (-not (Test-Path $envPath)) { return $null }
  foreach ($line in Get-Content $envPath) {
    if ($line -match "^\s*$key=(.+)$") {
      return $matches[1].Trim()
    }
  }
  return $null
}

$vars = @{
  SITE_URL                  = "https://krownfrontz.com"
  ORDER_NOTIFICATION_EMAIL  = "krownfrontz@gmail.com"
  ORDER_NOTIFICATION_FROM   = "orders@krownfrontz.com"
  STRIPE_SECRET_KEY         = "sk_live_REPLACE_ME"
  STRIPE_WEBHOOK_SECRET     = "whsec_REPLACE_ME"
}

if ($FromEnv) {
  $sk = Read-DotEnvValue "STRIPE_SECRET_KEY"
  $wh = Read-DotEnvValue "STRIPE_WEBHOOK_SECRET"
  if ($sk) { $vars.STRIPE_SECRET_KEY = $sk }
  if ($wh) { $vars.STRIPE_WEBHOOK_SECRET = $wh }
}

Write-Host "=== Krown Frontz Stripe go-live ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before running, complete in Stripe Dashboard (Live mode):"
Write-Host "  1. Developers -> Webhooks -> Add endpoint"
Write-Host "     URL: https://krownfrontz.com/api/stripe-webhook"
Write-Host "     Event: checkout.session.completed"
Write-Host "  2. Copy signing secret (whsec_...) into STRIPE_WEBHOOK_SECRET below"
Write-Host "  3. Settings -> Payments -> Fraud and risk -> enable Radar default rules"
Write-Host "  4. Settings -> Payments -> 3D Secure -> request when recommended by Radar"
Write-Host ""

$status = npx netlify status 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -and $status -match "Not logged in") {
  Write-Host "Logging in to Netlify..." -ForegroundColor Yellow
  npx netlify login
}

$setCount = 0
foreach ($key in $vars.Keys) {
  $val = $vars[$key]
  if ([string]::IsNullOrWhiteSpace($val) -or $val -match "REPLACE_ME") {
    Write-Host "Skipping $key (not set)" -ForegroundColor DarkYellow
    continue
  }
  Write-Host "Setting $key on Netlify..."
  npx netlify env:set $key $val --context production
  $setCount++
}

if ($setCount -eq 0) {
  Write-Host "`nNo variables were set. Edit scripts/go-live-stripe.ps1 or use -FromEnv." -ForegroundColor Yellow
  exit 1
}

Write-Host "`nVerifying env..." -ForegroundColor Yellow
node scripts/verify-production-env.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "Env verification failed - fix values and re-run." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "`nDeploying to production..." -ForegroundColor Yellow
npx netlify deploy --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nVerifying security headers..." -ForegroundColor Yellow
node scripts/verify-security-headers.js

Write-Host "`n=== Go-live complete ===" -ForegroundColor Green
Write-Host "Run a test order with a real card, then refund in Stripe Dashboard if needed."
