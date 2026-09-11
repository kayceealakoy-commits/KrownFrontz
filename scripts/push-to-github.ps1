# Push krown-frontz to GitHub for Netlify Git deploy
# Requires Git and GitHub CLI (gh): https://cli.github.com

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is not installed. Download: https://git-scm.com/download/win" -ForegroundColor Red
  exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "GitHub CLI (gh) is not installed. Download: https://cli.github.com" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".git")) {
  git init -b main
}

# Ensure secrets are not staged
if (Test-Path ".env") {
  git check-ignore -q .env 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: .env is not gitignored — check .gitignore before committing." -ForegroundColor Yellow
  }
}

git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "Prepare Krown Frontz for Netlify deployment"
}

$remotes = git remote 2>$null
if ($remotes -notcontains "origin") {
  Write-Host "Creating private GitHub repo krown-frontz..."
  gh repo create krown-frontz --private --source=. --remote=origin --push
} else {
  Write-Host "Pushing to origin..."
  git push -u origin main
}

Write-Host "Done. Import this repo in Netlify: Add new site -> Import from Git" -ForegroundColor Green
