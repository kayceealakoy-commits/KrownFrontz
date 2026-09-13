const Stripe = require("stripe");
const {
  DEPOSIT_REDEEMED_META,
  resolveDepositVerification,
} = require("../../lib/booking-deposit");
const {
  corsJson,
  enforceRateLimit,
  checkOrigin,
  validateSessionId,
} = require("../../lib/http-security");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const json = (statusCode, body) => corsJson(statusCode, body, "GET, OPTIONS", event);

  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed." });
  }

  const originCheck = checkOrigin(event);
  if (!originCheck.allowed) {
    return json(403, { error: originCheck.error });
  }

  const rateCheck = enforceRateLimit(event, "get-checkout-session", 30);
  if (!rateCheck.allowed) {
    return json(429, { error: rateCheck.error });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: "Stripe is not configured on the server." });
  }

  const sessionResult = validateSessionId(event.queryStringParameters?.session_id);
  if (!sessionResult.valid) {
    return json(400, { error: sessionResult.error });
  }

  const redeemRequested = event.queryStringParameters?.redeem === "1";

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionResult.value);
    const decision = resolveDepositVerification(session, redeemRequested);

    if (decision.action === "reject") {
      return json(decision.statusCode, decision.body);
    }

    if (decision.action === "redeem") {
      await stripe.checkout.sessions.update(sessionResult.value, {
        metadata: {
          ...session.metadata,
          [DEPOSIT_REDEEMED_META]: "1",
        },
      });
    }

    return json(200, decision.body);
  } catch (error) {
    console.error("get-checkout-session failed:", error);
    return json(400, { error: "Unable to verify checkout session." });
  }
};
