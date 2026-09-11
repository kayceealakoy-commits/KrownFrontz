# Stripe Dashboard security settings

Complete these in [Stripe Dashboard](https://dashboard.stripe.com) before accepting live payments.

## Radar (fraud prevention)

1. Open **Settings → Payments → Fraud and risk** (or **Radar** in the sidebar).
2. Enable **default Radar rules** for your account.
3. Review blocked payments weekly under **Payments → Radar**.

## 3D Secure (SCA)

1. Open **Settings → Payments → 3D Secure**.
2. Enable **Request 3D Secure when recommended by Radar** for Checkout.
3. Test with Stripe card `4000 0027 6000 3184` after enabling.

## Webhook (required for order notifications)

| Mode | Endpoint URL | Event |
| --- | --- | --- |
| Test (staging) | `https://krown-frontz.netlify.app/api/stripe-webhook` | `checkout.session.completed` |
| Live (production) | `https://krownfrontz.com/api/stripe-webhook` | `checkout.session.completed` |

Copy the **signing secret** (`whsec_...`) into Netlify:

```powershell
npx netlify env:set STRIPE_WEBHOOK_SECRET whsec_YOUR_SECRET --context production
```

## Live API keys

1. Toggle **Live mode** (top right of Dashboard).
2. **Developers → API keys** → copy **Secret key** (`sk_live_...`).
3. Set on Netlify:

```powershell
npx netlify env:set STRIPE_SECRET_KEY sk_live_YOUR_KEY --context production
```

Or run the all-in-one script after editing keys:

```powershell
npm run go-live
```

## Verify after deploy

```bash
npm run verify-production-env
npm run verify-security-headers
```

Also scan manually at [securityheaders.com](https://securityheaders.com/?q=krownfrontz.com).

## Booking deposit note

The £10 deposit gate on `book.html` is enforced server-side via one-time session redemption. Clients can still book directly at the public Calendly URL unless you enable **Calendly paid events** or restrict the event type in Calendly settings.
