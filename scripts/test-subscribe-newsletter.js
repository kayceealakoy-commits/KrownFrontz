/**
 * Newsletter subscribe handler smoke tests (no Resend API calls).
 * Usage: node scripts/test-subscribe-newsletter.js
 */

const { handler } = require("../netlify/functions/subscribe-newsletter");

function fail(message) {
  console.error("✗", message);
  process.exit(1);
}

function makeEvent(body, overrides = {}) {
  return {
    httpMethod: "POST",
    headers: {
      origin: "https://krownfrontz.com",
      "x-forwarded-for": "203.0.113.1",
      ...overrides.headers,
    },
    body: JSON.stringify(body),
    ...overrides,
  };
}

async function run() {
  const savedKey = process.env.RESEND_API_KEY;
  const savedTopic = process.env.RESEND_NEWSLETTER_TOPIC_ID;
  const savedSiteUrl = process.env.SITE_URL;

  process.env.SITE_URL = "https://krownfrontz.com";

  process.env.RESEND_API_KEY = "";
  process.env.RESEND_NEWSLETTER_TOPIC_ID = "";

  const unconfigured = await handler(makeEvent({ email: "test@example.com", consent: true }));
  if (unconfigured.statusCode !== 500) {
    fail(`missing Resend config should return 500, got ${unconfigured.statusCode}: ${unconfigured.body}`);
  }
  console.log("✓ returns 500 when Resend is not configured");

  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_NEWSLETTER_TOPIC_ID = "topic_REPLACE_ME";

  const placeholder = await handler(makeEvent({ email: "test@example.com", consent: true }));
  if (placeholder.statusCode !== 500) {
    fail("placeholder topic id should return 500");
  }
  console.log("✓ returns 500 when topic id is placeholder");

  process.env.RESEND_NEWSLETTER_TOPIC_ID = "topic_test123";

  const noConsent = await handler(makeEvent({ email: "test@example.com", consent: false }));
  if (noConsent.statusCode !== 400) {
    fail("missing consent should return 400");
  }
  console.log("✓ requires consent");

  const badEmail = await handler(makeEvent({ email: "not-an-email", consent: true }));
  if (badEmail.statusCode !== 400) {
    fail("invalid email should return 400");
  }
  console.log("✓ validates email format");

  const wrongMethod = await handler({ ...makeEvent({}), httpMethod: "GET" });
  if (wrongMethod.statusCode !== 405) {
    fail("GET should return 405");
  }
  console.log("✓ rejects non-POST methods");

  const badOrigin = await handler(
    makeEvent(
      { email: "test@example.com", consent: true },
      { headers: { origin: "https://evil.example" } }
    )
  );
  if (badOrigin.statusCode !== 403) {
    fail("disallowed origin should return 403");
  }
  console.log("✓ enforces origin check");

  if (savedKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedKey;
  if (savedTopic === undefined) delete process.env.RESEND_NEWSLETTER_TOPIC_ID;
  else process.env.RESEND_NEWSLETTER_TOPIC_ID = savedTopic;
  if (savedSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = savedSiteUrl;

  console.log("\nAll subscribe-newsletter smoke tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
