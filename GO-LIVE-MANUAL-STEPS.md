# Go-live — manual steps required (agent blocked on Netlify/Stripe writes)

**Date:** 30 Aug 2026  
**DNS:** Records are correct (`krownfrontz.com` → `75.2.60.5`, `www` → Netlify).  
**Blockers found:** Netlify custom domain not added; team SSO enabled (site returns 401); live Stripe keys not in `.env`.

Run these in order (~10 minutes). After each block, re-run verification at the bottom.

---

## 1. Netlify — make site public and add domain

Open https://app.netlify.com/projects/krown-frontz

### A. Disable password / team SSO (fixes 401)

1. **Site configuration → Access control**
2. Turn **off** password protection and **team SSO** for this site
3. Save

### B. Add custom domain

1. **Domain management → Add a domain**
2. Add `krownfrontz.com` and `www.krownfrontz.com`
3. Wait until DNS shows **verified** and HTTPS certificate is **active**

Or run locally (when Cursor allows):

```powershell
cd c:\Users\blais\Projects\figma\krown-frontz
node scripts/netlify-go-live-api.js update-site
```

---

## 2. Stripe Live — webhook + keys

Open https://dashboard.stripe.com ( **Live mode** ON )

1. **Developers → API keys** → copy **Secret key** (`sk_live_...`)
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://krownfrontz.com/api/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy **Signing secret** (`whsec_...`)
3. **Settings → Payments → Fraud and risk** → enable default **Radar** rules
4. **Settings → Payments → 3D Secure** → **Request when recommended by Radar**

---

## 3. Set secrets locally and on Netlify

Edit `krown-frontz/.env` (never commit):

```
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
SITE_URL=https://krownfrontz.com
```

Then run:

```powershell
cd c:\Users\blais\Projects\figma\krown-frontz
powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1 -FromEnv
```

This sets Netlify env vars, verifies, deploys, and checks headers.

---

## 4. Verify

```powershell
npm run verify-production-env -- --check-only
npm run verify-security-headers
npm run test-security-validation
npm run test-checkout-logic
```

Then test checkout at https://krownfrontz.com with a real card (refund in Stripe if needed).

---

## Agent-completed items (30 Aug 2026 evening)

- [x] Live Stripe webhook created: `https://krownfrontz.com/api/stripe-webhook` (`checkout.session.completed`)
- [x] Netlify production env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` set
- [x] Production deploy live: https://krownfrontz.com (deploy `6a948486eb01f7c879226200`)
- [x] Helper scripts: `scripts/create-stripe-live-webhook.js`, `scripts/disable-netlify-sso.js`
- [ ] **Disable Netlify SSO** — site still returns **401** until you do step 1 below
- [ ] **Rotate Stripe live key** — key was shared in chat; roll in Stripe Dashboard (see STRIPE-LIVE.md §0)
- [ ] **Test checkout** — after SSO is off, place one real order and refund in Stripe

## Agent-completed items (earlier)

- [x] DNS lookup — apex and www point to Netlify
- [x] Security + checkout tests pass locally
- [x] `scripts/netlify-go-live-api.js` added for domain/SSO fix
- [ ] Netlify SSO disabled (you)
- [ ] Custom domain added in Netlify (you)
- [ ] Live Stripe keys + webhook (you)
- [ ] Production deploy with live env (you via `npm run go-live`)
