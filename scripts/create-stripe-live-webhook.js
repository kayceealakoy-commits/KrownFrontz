/**
 * Create (or reuse) live Stripe webhook for krownfrontz.com checkout.
 * Usage: node scripts/create-stripe-live-webhook.js
 * Reads STRIPE_SECRET_KEY from .env — must be sk_live_...
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const WEBHOOK_URL = "https://krownfrontz.com/api/stripe-webhook";
const EVENT = "checkout.session.completed";

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function upsertEnvValue(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  content = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV_PATH, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  loadEnvFile();
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret.startsWith("sk_live_")) {
    fail("STRIPE_SECRET_KEY must be a live key (sk_live_...) in .env");
  }

  const Stripe = require("stripe");
  const stripe = new Stripe(secret);

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((endpoint) => endpoint.url === WEBHOOK_URL);

  let endpoint = match;
  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: [EVENT],
      description: "Krown Frontz production checkout",
    });
    console.log(`✓ Created webhook endpoint: ${endpoint.id}`);
  } else {
    console.log(`✓ Reusing webhook endpoint: ${endpoint.id}`);
  }

  const signingSecret = endpoint.secret;
  if (!signingSecret) {
    fail(
      "Could not read signing secret. In Stripe Dashboard open the webhook and reveal whsec_, then set STRIPE_WEBHOOK_SECRET in .env"
    );
  }

  upsertEnvValue("STRIPE_WEBHOOK_SECRET", signingSecret);
  upsertEnvValue("SITE_URL", "https://krownfrontz.com");
  console.log("✓ Saved STRIPE_WEBHOOK_SECRET and SITE_URL to .env");
  console.log("Next: powershell -ExecutionPolicy Bypass -File scripts/go-live-stripe.ps1 -FromEnv");
}

main().catch((err) => fail(err.message));
