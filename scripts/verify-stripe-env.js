/**
 * Verify Stripe env vars and API connectivity.
 * Usage: node scripts/verify-stripe-env.js
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const secret = process.env.STRIPE_SECRET_KEY || "";
const siteUrl = process.env.SITE_URL || "";
const webhook = process.env.STRIPE_WEBHOOK_SECRET || "";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!secret || secret.includes("REPLACE_ME")) {
  fail(
    "STRIPE_SECRET_KEY is missing or still a placeholder. Copy sk_test_... from https://dashboard.stripe.com/test/apikeys into krown-frontz/.env"
  );
}

if (!secret.startsWith("sk_test_") && !secret.startsWith("sk_live_")) {
  fail("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
}

if (!siteUrl) {
  fail("SITE_URL is required (e.g. http://localhost:8888).");
}

async function main() {
  const Stripe = require("stripe");
  const stripe = new Stripe(secret);
  const account = await stripe.accounts.retrieve();
  console.log(`✓ Stripe API connected (${account.id})`);
  console.log(`✓ SITE_URL=${siteUrl}`);
  if (webhook && !webhook.includes("REPLACE_ME")) {
    console.log("✓ STRIPE_WEBHOOK_SECRET is set");
  } else {
    console.log("○ STRIPE_WEBHOOK_SECRET not set (optional for first checkout test)");
  }
}

main().catch((err) => fail(err.message));
