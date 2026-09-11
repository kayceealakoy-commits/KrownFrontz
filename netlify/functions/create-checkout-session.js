const crypto = require("crypto");
const Stripe = require("stripe");
const { buildPricedCheckout } = require("../../lib/pricing");
const { chunkMetadata } = require("../../lib/stripe-metadata");
const {
  corsJson,
  enforceRateLimit,
  checkOrigin,
  validateCustomer,
  validateCartItems,
  getSiteUrl,
} = require("../../lib/http-security");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function json(statusCode, body) {
  return corsJson(statusCode, body, "POST, OPTIONS");
}

function buildSessionMetadata(zoneId, customer, priced) {
  const fulfillmentJson = JSON.stringify(priced.fulfillment);
  const cartJson = JSON.stringify(priced.cart.items);
  const addressJson = JSON.stringify(customer.address);

  return {
    zoneId,
    customer_name: customer.name,
    customer_email: customer.email,
    ...chunkMetadata("customer_address", addressJson),
    ...chunkMetadata("fulfillment", fulfillmentJson),
    ...chunkMetadata("cart", cartJson),
  };
}

function checkoutIdempotencyKey(zoneId, customer, items) {
  const payload = JSON.stringify({ zoneId, email: customer.email, items });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const originCheck = checkOrigin(event);
  if (!originCheck.allowed) {
    return json(403, { error: originCheck.error });
  }

  const rateCheck = enforceRateLimit(event, "create-checkout", 10);
  if (!rateCheck.allowed) {
    return json(429, { error: rateCheck.error });
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME")) {
    return json(500, { error: "Stripe is not configured on the server. Set STRIPE_SECRET_KEY in .env." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const zoneId = String(payload.zoneId || "").trim();

    const customerResult = validateCustomer(payload);
    if (!customerResult.valid) {
      return json(400, { error: customerResult.error });
    }
    const customer = customerResult.customer;

    const cartResult = validateCartItems(payload.items);
    if (!cartResult.valid) {
      return json(400, { error: cartResult.error });
    }

    const priced = buildPricedCheckout({
      zoneId,
      items: payload.items,
    });

    const metadata = buildSessionMetadata(zoneId, customer, priced);

    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customer.email,
        line_items: priced.lineItems,
        success_url: `${siteUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/checkout-cancelled.html`,
        metadata,
        payment_intent_data: {
          metadata,
        },
        billing_address_collection: "required",
        consent_collection: {
          terms_of_service: "required",
        },
        custom_text: {
          terms_of_service_acceptance: {
            message: `I agree to Krown Frontz's [Terms of Service](${siteUrl}/terms-of-service.html) and [Refund Policy](${siteUrl}/refund-policy.html).`,
          },
        },
      },
      {
        idempotencyKey: checkoutIdempotencyKey(zoneId, customer, payload.items),
      }
    );

    return json(200, { url: session.url });
  } catch (error) {
    console.error("create-checkout-session failed:", error);
    return json(400, { error: error.message || "Unable to start checkout." });
  }
};
