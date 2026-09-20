const crypto = require("crypto");
const Stripe = require("stripe");
const {
  corsJson,
  enforceRateLimit,
  checkOrigin,
  validateEmail,
  publicSiteUrl,
} = require("../../lib/http-security");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const BOOKING_DEPOSIT_PENCE = 1000;

function sanitizeReturnQuery(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("?")) return "";
  const params = new URLSearchParams(trimmed.slice(1));
  params.delete("deposit_session_id");
  params.delete("deposit_cancelled");
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

function depositIdempotencyKey(email, returnQuery) {
  const payload = JSON.stringify({ email, returnQuery });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

exports.handler = async (event) => {
  const json = (statusCode, body) => corsJson(statusCode, body, "POST, OPTIONS", event);

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

  const rateCheck = enforceRateLimit(event, "create-booking-deposit", 10);
  if (!rateCheck.allowed) {
    return json(429, { error: rateCheck.error });
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME")) {
    return json(500, { error: "Stripe is not configured on the server. Set STRIPE_SECRET_KEY in .env." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const returnQuery = sanitizeReturnQuery(payload.returnQuery);
    const siteUrl = publicSiteUrl(event);
    const metadata = { type: "booking_deposit" };

    const sessionParams = {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: BOOKING_DEPOSIT_PENCE,
            product_data: {
              name: "In-person impression booking deposit",
              description: "Deducted from the final price of your grillz.",
            },
          },
        },
      ],
      success_url: `${siteUrl}/book.html?deposit_session_id={CHECKOUT_SESSION_ID}${returnQuery}`,
      cancel_url: `${siteUrl}/book.html${returnQuery ? `?${returnQuery.slice(1)}&deposit_cancelled=1` : "?deposit_cancelled=1"}`,
      metadata,
      payment_intent_data: { metadata },
    };

    let email = "";
    if (payload.email) {
      const emailResult = validateEmail(payload.email);
      if (!emailResult.valid) {
        return json(400, { error: emailResult.error });
      }
      email = emailResult.value;
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: depositIdempotencyKey(email, returnQuery),
    });

    return json(200, { url: session.url });
  } catch (error) {
    console.error("create-booking-deposit-session failed:", error);
    return json(400, { error: error.message || "Unable to start deposit checkout." });
  }
};
