# Deployment status — Krown Frontz

**Last updated:** 30 Aug 2026 (go-live run)

**Live URL:** https://krown-frontz.netlify.app  
**Custom domain (DNS ready, Netlify pending):** https://krownfrontz.com  
**Netlify dashboard:** https://app.netlify.com/projects/krown-frontz  
**Latest production deploy:** `6a93b6efe75f974165f03a87` — https://app.netlify.com/projects/krown-frontz/deploys/6a93b6efe75f974165f03a87

---

## Go-live run results

| Check | Status | Notes |
| --- | --- | --- |
| DNS apex (`krownfrontz.com`) | **Pass** | Resolves to `75.2.60.5` (Netlify) |
| DNS www | **Pass** | CNAME → `krown-frontz.netlify.app` |
| Custom domain in Netlify | **Pending** | `custom_domain` still `null` — add in Domain management |
| Site publicly accessible | **Blocked** | HTTP **401** — team **SSO enabled** (`sso_login: true`) |
| Security headers on live URL | **Blocked** | Headers deploy with site; 401 gate prevents verification |
| Production deploy | **Done** | Security-hardened code + functions deployed |
| `STRIPE_SECRET_KEY` (live) | **Pending** | Netlify still on test key; paste `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | **Pending** | No live webhook in Stripe yet (`whsec_...` needed) |
| Stripe live webhooks | **None** | Confirmed via Stripe API — `data: []` |
| Local security tests | **Pass** | `test-security-validation`, `test-checkout-logic` |
| Radar + 3DS | **Pending** | Enable in Stripe Dashboard (Live mode) |

---

## Completed

- [x] Netlify site `krown-frontz` linked
- [x] Production deploy with 4 Stripe functions (latest: 30 Aug 2026)
- [x] Security hardening in codebase (deposit redeem, origin check, headers in `netlify.toml`)
- [x] Hostinger DNS records correct (apex + www)
- [x] `SITE_URL`, `ORDER_NOTIFICATION_EMAIL`, `ORDER_NOTIFICATION_FROM` on Netlify

---

## Your next steps (required before real payments)

**See [GO-LIVE-MANUAL-STEPS.md](GO-LIVE-MANUAL-STEPS.md) for copy-paste instructions.**

### 1. Netlify — unblock public access (~2 min)

1. https://app.netlify.com/projects/krown-frontz/configuration/access
2. **Disable team SSO / password protection** for this site
3. **Domain management → Add** `krownfrontz.com` and `www.krownfrontz.com`
4. Wait for HTTPS certificate

### 2. Stripe Live — webhook + keys (~5 min)

1. Live mode ON → copy `sk_live_...`
2. Create webhook: `https://krownfrontz.com/api/stripe-webhook` → `checkout.session.completed`
3. Copy `whsec_...`
4. Enable Radar + 3DS ([docs/stripe-dashboard-security.md](docs/stripe-dashboard-security.md))

### 3. Set secrets and redeploy

Add to `.env`, then:

```powershell
cd c:\Users\blais\Projects\figma\krown-frontz
powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1 -FromEnv
```

### 4. Verify + test checkout

```powershell
npm run verify-production-env -- --check-only
npm run verify-security-headers
```

Then one live test order at https://krownfrontz.com (refund in Stripe if needed).

---

## Helper scripts added this session

| Script | Purpose |
| --- | --- |
| `scripts/netlify-go-live-api.js status` | Show domain / SSO / SSL state |
| `scripts/netlify-go-live-api.js update-site` | Add domain + disable SSO (when approved) |
| `scripts/netlify-go-live-api.js check-env` | Check required env vars exist (no values printed) |
| `scripts/go-live-stripe.ps1` | Full Stripe + Netlify go-live |
| `GO-LIVE-MANUAL-STEPS.md` | Step-by-step when agent writes are blocked |
