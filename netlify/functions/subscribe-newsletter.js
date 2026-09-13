const {
  corsJson,
  enforceRateLimit,
  checkOrigin,
  validateEmail,
} = require("../../lib/http-security");

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const topicId = process.env.RESEND_NEWSLETTER_TOPIC_ID;
  if (!apiKey || !topicId || topicId.includes("REPLACE_ME")) {
    return { ok: false, error: "Newsletter signup is not configured on the server." };
  }
  return { ok: true, apiKey, topicId };
}

async function resendFetch(apiKey, method, path, body) {
  const response = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { ok: response.ok, status: response.status, data };
}

function isDuplicateContactError(result) {
  if (result.status === 409) return true;
  const message = String(result.data?.message || result.data?.error || "").toLowerCase();
  return message.includes("already") || message.includes("exist") || message.includes("duplicate");
}

async function subscribeContact(apiKey, topicId, email) {
  const topics = [{ id: topicId, subscription: "opt_in" }];

  const createResult = await resendFetch(apiKey, "POST", "/contacts", {
    email,
    unsubscribed: false,
    topics,
  });

  if (createResult.ok) {
    return { ok: true };
  }

  if (!isDuplicateContactError(createResult)) {
    console.error("Resend create contact failed:", createResult.status, createResult.data);
    return { ok: false, error: "Could not add you to the list. Please try again later." };
  }

  const encodedEmail = encodeURIComponent(email);
  const updateResult = await resendFetch(apiKey, "PATCH", `/contacts/${encodedEmail}/topics`, topics);

  if (updateResult.ok) {
    return { ok: true };
  }

  console.error("Resend update contact topics failed:", updateResult.status, updateResult.data);
  return { ok: false, error: "Could not add you to the list. Please try again later." };
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

  const rateCheck = enforceRateLimit(event, "subscribe-newsletter", 5);
  if (!rateCheck.allowed) {
    return json(429, { error: rateCheck.error });
  }

  const config = getResendConfig();
  if (!config.ok) {
    return json(500, { error: config.error });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request." });
  }

  if (payload.consent !== true) {
    return json(400, { error: "Please agree to receive marketing emails before subscribing." });
  }

  const emailResult = validateEmail(payload.email);
  if (!emailResult.valid) {
    return json(400, { error: emailResult.error });
  }

  const subscribeResult = await subscribeContact(config.apiKey, config.topicId, emailResult.value);
  if (!subscribeResult.ok) {
    return json(502, { error: subscribeResult.error });
  }

  return json(200, { ok: true });
};
