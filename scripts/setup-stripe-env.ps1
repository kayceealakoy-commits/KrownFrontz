# Configure Stripe test keys in .env (run once)
# Usage: .\scripts\setup-stripe-env.ps1

$envPath = Join-Path $PSScriptRoot ".." ".env"
$examplePath = Join-Path $PSScriptRoot ".." ".env.example"

if (-not (Test-Path $envPath)) {
  Copy-Item $examplePath $envPath
  Write-Host "Created .env from .env.example"
}

Write-Host ""
Write-Host "Paste your Stripe TEST secret key (sk_test_...) from:"
Write-Host "  https://dashboard.stripe.com/test/apikeys"
Write-Host ""
$secret = Read-Host "STRIPE_SECRET_KEY"

if (-not $secret -or $secret -notmatch "^sk_test_") {
  Write-Error "Invalid key — must start with sk_test_"
  exit 1
}

$content = Get-Content $envPath -Raw
$content = $content -replace "STRIPE_SECRET_KEY=.*", "STRIPE_SECRET_KEY=$secret"
if ($content -notmatch "SITE_URL=") {
  $content += "`nSITE_URL=http://localhost:8888`n"
} else {
  $content = $content -replace "SITE_URL=.*", "SITE_URL=http://localhost:8888"
}

Set-Content -Path $envPath -Value $content.TrimEnd() -NoNewline
Write-Host ""
Write-Host "Saved STRIPE_SECRET_KEY and SITE_URL in .env"
Write-Host "Next: npm run verify-stripe && npm run dev"
