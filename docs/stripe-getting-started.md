# Stripe getting started — step by step

Quick path from zero to your first test payment for Krown Frontz.

## 1. Connect Stripe MCP in Cursor (optional)

Stripe MCP is configured in `C:\Users\blais\.cursor\mcp.json`. After editing:

1. Restart Cursor or run `/reload-plugins`
2. Authenticate when prompted (OAuth) for the Stripe MCP server
3. Start a new chat and confirm `stripe_implementation_planner` is available

CLI alternative:

```bash
npm install -g @stripe/cli@latest
stripe agent setup
```

## 2. Stripe Dashboard — test keys

1. Create an account at [dashboard.stripe.com](https://dashboard.stripe.com/register)
2. Stay in **Test mode**
3. **Developers → API keys** → copy **Secret key** (`sk_test_...`)

## 3. Local environment

**Option A — interactive setup (Windows):**

```powershell
cd krown-frontz
.\scripts\setup-stripe-env.ps1
```

**Option B — edit manually:** copy [`.env.example`](../.env.example) to `.env` and set:

```
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
SITE_URL=http://localhost:8888
```

Verify connectivity:

```bash
npm run verify-stripe
```

## 4. Install Node.js and run locally

Install [Node.js LTS](https://nodejs.org/) if needed, then:

```bash
cd krown-frontz
npm install
npx netlify dev
```

Open `http://localhost:8888` → shop → checkout → **Pay with Stripe**.

**Test card:** `4242 4242 4242 4242` · any future expiry · any CVC

## 5. Webhooks locally (Stripe CLI)

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) if needed (`winget install Stripe.StripeCli` on Windows).

In a second terminal:

```bash
stripe login
stripe listen --forward-to localhost:8888/api/stripe-webhook
```

Copy the `whsec_...` secret into `.env` as `STRIPE_WEBHOOK_SECRET`, restart `npm run dev`, then pay again. You should see `checkout.session.completed` in the CLI.

## 6. Deploy to Netlify

See [DEPLOY-NETLIFY.md](DEPLOY-NETLIFY.md).

## 7. Production webhook

After deploy:

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR-DOMAIN/api/stripe-webhook`
3. Event: `checkout.session.completed`
4. Copy signing secret → Netlify env `STRIPE_WEBHOOK_SECRET`

## 8. Go live

1. Complete Stripe account verification
2. Switch Netlify production env to `sk_live_...`
3. Register a **live mode** webhook endpoint
4. Place one small real order to confirm

## Stripe MCP planner result

The Stripe implementation planner confirmed **hosted Stripe Checkout** (`checkout_type: hosted`, `origin_context: web`) is the correct integration for Krown Frontz one-time physical goods with a custom configurator. This matches the existing Netlify Functions integration.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local site + API at http://localhost:8888 |
| `npm run verify-stripe` | Confirm `.env` keys connect to Stripe |
| `npm run test-checkout-logic` | Smoke-test server-side pricing + metadata (no API call) |

## Related

- Architecture and security: [stripe-integration.md](stripe-integration.md)
- Booking deposits (separate): [live-booking-integration.md](live-booking-integration.md)
