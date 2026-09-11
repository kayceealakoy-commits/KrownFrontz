# Deploy Krown Frontz to Netlify

The site is a static front-end plus Netlify Functions for Stripe.

## Prerequisites

- GitHub repo containing the `krown-frontz` folder
- Stripe test (or live) secret key
- Netlify account

## Steps

1. Push your code to GitHub.

2. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**.

3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Base directory | `krown-frontz` (if repo root is parent) or leave blank if repo is only this site |
   | Build command | `npm install` |
   | Publish directory | `.` |

4. **Site settings → Environment variables** (add for all contexts you use):

   | Key | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
   | `SITE_URL` | `https://your-site.netlify.app` (your real URL, no trailing slash) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe webhook setup |
   | `ORDER_NOTIFICATION_EMAIL` | Optional — your inbox |
   | `RESEND_API_KEY` | Optional — for order emails |

5. Deploy. Netlify reads [`netlify.toml`](../netlify.toml) for function routing:

   - `POST /api/create-checkout-session`
   - `GET /api/get-checkout-session`
   - `POST /api/stripe-webhook`

6. Register Stripe webhook (see [stripe-getting-started.md](stripe-getting-started.md)).

7. Test: configure grillz → checkout → pay with test card → success page verifies payment and clears cart.

## Custom domain

After adding a domain in Netlify, update `SITE_URL` to `https://yourdomain.com`.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| "Stripe is not configured" | `STRIPE_SECRET_KEY` missing or still `REPLACE_ME` in `.env` — run `.\scripts\setup-stripe-env.ps1` |
| Checkout redirect fails | `SITE_URL` must match deployed URL |
| Webhook 400 signature error | Wrong `STRIPE_WEBHOOK_SECRET` for this endpoint |
| Prices wrong on Stripe | Run `python scripts/sync-pricing-lib.py` and redeploy |
| `KIT_SHARED_INCLUDES is not defined` | Run `npm run sync-pricing` to regenerate `lib/catalog-data.js` |
