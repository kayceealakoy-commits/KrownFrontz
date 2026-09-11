# Deploy Krown Frontz to krownfrontz.com

Domain registrar: **Hostinger** (krownfrontz.com)  
Hosting: **Netlify** (required for Stripe checkout APIs)

## Prerequisites

- [Node.js](https://nodejs.org) installed
- [Git](https://git-scm.com/download/win) installed (for GitHub deploy)
- Netlify account: https://app.netlify.com
- Stripe live keys: https://dashboard.stripe.com/apikeys

## Quick deploy (Netlify CLI)

From the `krown-frontz` folder:

```powershell
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

`netlify init` links this folder to a new or existing Netlify site.

## Environment variables (Netlify dashboard)

**Site settings → Environment variables → Add variable:**

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` from Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe webhook (below) |
| `SITE_URL` | `https://krownfrontz.com` |
| `ORDER_NOTIFICATION_EMAIL` | `krownfrontz@gmail.com` |
| `RESEND_API_KEY` | (optional) from resend.com |
| `ORDER_NOTIFICATION_FROM` | `orders@krownfrontz.com` |

Or via CLI after login:

```powershell
npx netlify env:set STRIPE_SECRET_KEY "sk_live_..."
npx netlify env:set SITE_URL "https://krownfrontz.com"
npx netlify env:set ORDER_NOTIFICATION_EMAIL "krownfrontz@gmail.com"
```

Redeploy after setting variables: `npx netlify deploy --prod`

## Connect krownfrontz.com (Hostinger DNS)

### 1. Netlify

1. **Domain management → Add a domain** → `krownfrontz.com`
2. Add `www.krownfrontz.com` as well
3. Note the DNS records Netlify shows

### 2. Hostinger hPanel

1. **Domains → krownfrontz.com → DNS / Nameservers**
2. Add records (use values from Netlify UI):

| Type | Name | Value |
|------|------|-------|
| A | @ | `75.2.60.5` (or IP shown by Netlify) |
| CNAME | www | `your-site-name.netlify.app` |

3. Wait for DNS propagation (often 1–2 hours)

### 3. HTTPS

In Netlify → **Domain management → HTTPS** → verify certificate provisions automatically.

Set primary domain to `krownfrontz.com` with redirect from `www`.

## Stripe live webhook

1. Stripe Dashboard → switch to **Live mode**
2. **Developers → Webhooks → Add endpoint**
3. URL: `https://krownfrontz.com/api/stripe-webhook`
4. Events: `checkout.session.completed`
5. Copy signing secret → Netlify `STRIPE_WEBHOOK_SECRET`
6. Redeploy and place a small test order

## GitHub deploy (optional, for auto-deploy on push)

```powershell
git init -b main
git add -A
git commit -m "Initial commit"
gh repo create krown-frontz --private --source=. --push
```

Then in Netlify: **Add new site → Import from Git → GitHub → select repo**.

Build settings are read from `netlify.toml` automatically.

## Verify after launch

- [ ] https://krownfrontz.com loads
- [ ] Shop → checkout → Stripe payment works
- [ ] checkout-success.html loads after payment
- [ ] book.html deposit flow works
- [ ] Calendly embed works (add domain in Calendly if blocked)
- [ ] Order email arrives (if Resend configured)

## Local development (unchanged)

```powershell
npm install
npm run dev
```

Uses `.env` with test keys — never commit `.env`.
