# Stripe shop integration

Connect the Krown Frontz custom shop to **Stripe Checkout** for real GBP payments.

**New here?** Start with [stripe-getting-started.md](stripe-getting-started.md), then deploy via [DEPLOY-NETLIFY.md](DEPLOY-NETLIFY.md).

## Architecture

| Layer | Path | Role |
| --- | --- | --- |
| Front-end cart | [`main.js`](../main.js) | Product config, cart, shipping display |
| Checkout page | [`checkout.html`](../checkout.html) | Customer details → Stripe redirect |
| Pricing (server) | [`lib/pricing.js`](../lib/pricing.js) | Re-prices cart in GBP (never trust browser prices) |
| Catalog data | [`lib/catalog-data.js`](../lib/catalog-data.js) | Generated from `main.js` |
| Create session | [`netlify/functions/create-checkout-session.js`](../netlify/functions/create-checkout-session.js) | Stripe Checkout Session |
| Verify session | [`netlify/functions/get-checkout-session.js`](../netlify/functions/get-checkout-session.js) | Confirms payment on success page |
| Webhook | [`netlify/functions/stripe-webhook.js`](../netlify/functions/stripe-webhook.js) | Order notification on payment |

Regenerate catalog data after catalog changes:

```bash
python scripts/sync-pricing-lib.py
```

## Stripe dashboard setup

1. Create a [Stripe account](https://dashboard.stripe.com/register) (UK business).
2. Copy **test** keys from Developers → API keys:
   - Publishable: `pk_test_...` (not used by this v1 — redirect-only Checkout)
   - Secret: `sk_test_...`
3. Enable payment methods you want under Settings → Payment methods.
4. Deploy the site, then add a webhook endpoint:
   - URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret (`whsec_...`)

## Environment variables (Netlify)

Set in Site settings → Environment variables (or a local `.env` for `netlify dev`):

| Variable | Required | Example |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | `whsec_...` |
| `SITE_URL` | Yes | `https://krownfrontz.com` |
| `ORDER_NOTIFICATION_EMAIL` | Optional | `krownfrontz@gmail.com` |
| `RESEND_API_KEY` | Optional | `re_...` |
| `ORDER_NOTIFICATION_FROM` | Optional | `orders@yourdomain.com` |

Copy [`.env.example`](../.env.example) to `.env` for local development.

## Local development

```bash
npm install
netlify dev
```

Open `http://localhost:8888`, add items to cart, and checkout. API routes are proxied to Netlify Functions.

Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Checkout flow

1. Customer configures grillz / adds kit on the site.
2. [`checkout.html`](../checkout.html) collects name, email, address, country zone.
3. `handleCheckoutSubmit()` posts cart lines (no prices) + `zoneId` to `/api/create-checkout-session`.
4. Server runs `buildPricedCheckout()` — same rules as the browser (`syncKitToCountry`, shipping zones).
5. Stripe Checkout opens; customer pays in **GBP** (address collected once on your site — not again on Stripe).
6. Success → [`checkout-success.html`](../checkout-success.html) calls `/api/get-checkout-session` to verify payment, then clears the cart.
7. Webhook logs order details and optionally emails you via Resend.

## Security notes

- Never commit `sk_test_` / `sk_live_` keys or webhook secrets. `.env` is gitignored — verify before every push.
- If a secret key was ever committed or shared, **rotate it immediately** in Stripe Dashboard → Developers → API keys.
- Server ignores client `piecePrice` values; cart lines sent to checkout contain `productId`, `material`, and `kitId` only.
- Cart must include an impression kit when ordering postal grillz.
- Kit auto-swaps to match delivery country (UK vs international).
- Customer shipping address is stored in session metadata (chunked) for webhook fulfillment emails.
- Checkout session creation uses an idempotency key to prevent duplicate sessions on double-submit.
- Booking deposit sessions also use an idempotency key.
- Webhook handler deduplicates retried events by `event.id` (per function instance; acceptable at current volume).
- API functions validate input, enforce origin allowlist on POST, and apply per-IP rate limits via [`lib/http-security.js`](../lib/http-security.js).
- `get-checkout-session` returns only `{ paid, type }` to the browser (no email or amount leakage); booking deposits support one-time `redeem=1` to prevent session ID sharing.
- Checkout API responses return only `{ url }` — no `sessionId` in JSON.
- Site-wide security headers (HSTS, CSP, X-Frame-Options) are set in [`_headers`](../_headers).
- Front-end `escapeHtml()` sanitizes user-influenced strings before `innerHTML` injection in cart and booking panels.
- Booking deposit sessions are single-use: first unlock on `book.html` calls `get-checkout-session?redeem=1`, which marks `deposit_redeemed` in Stripe metadata; a second user with the same session ID gets HTTP 409.

Run security smoke tests:

```bash
npm run test-security-validation
npm run test-checkout-logic
npm run verify-production-env
npm run verify-security-headers
```

Go-live (sets Netlify env vars, deploys, verifies headers):

```powershell
# Edit scripts/go-live-stripe.ps1 with sk_live_... and whsec_..., then:
npm run go-live
```

## Security checklist (Stripe Dashboard)

Configure before going live:

| Setting | Action |
| --- | --- |
| **Radar** | Enable default fraud rules; review blocked payments weekly |
| **3D Secure** | Enable “request 3DS when recommended by Radar” for Checkout |
| **Live keys** | Production Netlify env uses `sk_live_...` and `whsec_...` (not test keys) |
| `SITE_URL` | `https://krownfrontz.com` (no trailing slash) |
| **Webhook** | `https://krownfrontz.com/api/stripe-webhook` → `checkout.session.completed` |
| **Key rotation** | Rotate keys if `.env` was ever committed or shared |

After deploy, verify headers at [securityheaders.com](https://securityheaders.com) for `krownfrontz.com`.

Test 3DS with Stripe card `4000 0027 6000 3184` if 3DS is enabled.

## Go-live checklist

- [ ] Stripe Radar enabled with default rules
- [ ] 3D Secure enabled when recommended by Radar
- [ ] Security headers verified (securityheaders.com)
- [ ] `npm run test-security-validation` passes
- [ ] Live keys (`sk_live_...`) in Netlify production env
- [ ] Webhook registered against production URL with live signing secret
- [ ] `SITE_URL` set to production domain
- [ ] Test order: grillz + international kit + non-UK country → outbound + finish shipping on Stripe receipt
- [ ] Test order: UK kit + UK country → no outbound kit shipping line
- [ ] Order notification email received (if Resend configured)
- [ ] Booking deposits still handled separately via Calendly (see [`live-booking-integration.md`](live-booking-integration.md))

## Related

- Booking / deposit: [`live-booking-integration.md`](live-booking-integration.md)
- Shipping rates: [`shipping.html`](../shipping.html) and `SHIPPING_ZONES` in `main.js`
