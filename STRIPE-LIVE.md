# Stripe live mode setup for krownfrontz.com

Complete **after** DNS is live and the site loads at https://krownfrontz.com

## 0. Rotate exposed keys (if key was shared)

If your live secret key (`sk_live_...`) was pasted in chat, email, or a screenshot:

1. Stripe Dashboard → **Developers → API keys** (Live mode)
2. **Roll** the exposed key or create a new secret key
3. Update `.env` and Netlify `STRIPE_SECRET_KEY` with the new value
4. Redeploy: `npx netlify deploy --prod`

## 1. Switch Stripe to Live mode

1. Open https://dashboard.stripe.com
2. Toggle **Test mode** off (top right) → **Live mode**

## 2. Copy live API keys to Netlify

1. **Developers → API keys** → copy **Secret key** (`sk_live_...`)
2. Netlify → **Site settings → Environment variables**
3. Set `STRIPE_SECRET_KEY` = your live secret key
4. Ensure `SITE_URL` = `https://krownfrontz.com`

Or run (after editing `scripts/set-netlify-env.ps1`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/set-netlify-env.ps1
```

## 3. Create live webhook

1. Stripe Dashboard → **Developers → Webhooks**
2. **Add endpoint**
3. **Endpoint URL:** `https://krownfrontz.com/api/stripe-webhook`
4. **Events to send:** select `checkout.session.completed`
5. **Add endpoint**
6. Click the endpoint → **Signing secret** → Reveal → copy `whsec_...`
7. Netlify → set `STRIPE_WEBHOOK_SECRET` = that value

## 4. Redeploy

```powershell
npm run deploy
```

Or: `npx netlify deploy --prod`

## 5. Test checkout

1. Add a low-price item to cart (or use a test product)
2. Complete checkout with a real card
3. Confirm redirect to `checkout-success.html`
4. Check Stripe Dashboard → **Payments** for the charge
5. Refund the test payment in Stripe if desired

## 6. Optional: order emails (Resend)

1. Sign up at https://resend.com
2. Add and verify domain `krownfrontz.com`
3. Create API key → set `RESEND_API_KEY` in Netlify
4. Set `ORDER_NOTIFICATION_FROM` = `orders@krownfrontz.com`

## Security verification

```bash
npm run verify-production-env -- --check-only
npm run verify-security-headers
```

See [docs/stripe-dashboard-security.md](docs/stripe-dashboard-security.md) for Radar and 3DS settings.

## Local dev stays on test keys

Keep `sk_test_...` in your local `.env` file. Never use live keys locally.
