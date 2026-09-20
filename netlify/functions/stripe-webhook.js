const Stripe = require("stripe");
const { joinMetadataChunks } = require("../../lib/stripe-metadata");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** In-memory dedup for webhook retries (per function instance). */
const processedEventIds = new Set();

function formatCustomerAddress(metadata) {
  const raw =
    joinMetadataChunks(metadata, "customer_address") || metadata?.customer_address || "";
  if (!raw) return "";
  try {
    const address = JSON.parse(raw);
    const lines = [
      address.line1,
      address.line2,
      [address.city, address.postcode].filter(Boolean).join(" "),
      address.country,
    ].filter(Boolean);
    return lines.join("\n");
  } catch {
    return raw;
  }
}

async function sendNotification({ subject, summary }) {
  console.log(summary);

  const to = process.env.ORDER_NOTIFICATION_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!to || !resendKey) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ORDER_NOTIFICATION_FROM || "orders@krownfrontz.com",
      to: [to],
      subject,
      text: summary,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Resend notification failed:", body);
  }
}

async function notifyOrder(session) {
  const email = session.customer_details?.email || session.customer_email || "unknown";
  const amount = ((session.amount_total || 0) / 100).toFixed(2);
  const zoneId = session.metadata?.zoneId || "unknown";
  const customerName = session.metadata?.customer_name || "";
  const customerAddress = formatCustomerAddress(session.metadata);
  const fulfillment =
    joinMetadataChunks(session.metadata, "fulfillment") || session.metadata?.fulfillment || "";
  const summary = [
    "New Krown Frontz order paid",
    customerName ? `Name: ${customerName}` : null,
    `Email: ${email}`,
    customerAddress ? `Address:\n${customerAddress}` : null,
    `Total: GBP ${amount}`,
    `Zone: ${zoneId}`,
    `Session: ${session.id}`,
    `Fulfillment: ${fulfillment}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendNotification({
    subject: `Krown Frontz order paid — ${email}`,
    summary,
  });
}

async function notifyBookingDeposit(session) {
  const email = session.customer_details?.email || session.customer_email || "unknown";
  const amount = ((session.amount_total || 0) / 100).toFixed(2);
  const summary = [
    "In-person booking deposit paid",
    `Email: ${email}`,
    `Deposit: GBP ${amount}`,
    `Session: ${session.id}`,
    "Client should now pick an appointment slot on book.html.",
  ].join("\n");

  await sendNotification({
    subject: `Krown Frontz booking deposit — ${email}`,
    summary,
  });
}

async function notifyCheckoutCompleted(session) {
  if (session.metadata?.type === "booking_deposit") {
    await notifyBookingDeposit(session);
    return;
  }
  await notifyOrder(session);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME") ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET.includes("REPLACE_ME")
  ) {
    return { statusCode: 500, body: "Stripe webhook is not configured." };
  }

  const signature = event.headers["stripe-signature"];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  if (processedEventIds.has(stripeEvent.id)) {
    return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    processedEventIds.add(stripeEvent.id);
    const session = stripeEvent.data.object;
    await notifyCheckoutCompleted(session);
  }

  if (stripeEvent.type === "checkout.session.expired") {
    const session = stripeEvent.data.object;
    console.log("Checkout session expired:", session.id, session.metadata?.type || "order");
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
