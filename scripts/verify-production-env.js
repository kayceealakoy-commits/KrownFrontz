/**
 * Verify Netlify production environment variables for Stripe go-live.
 * Usage: node scripts/verify-production-env.js
 *
 * Reads env from Netlify CLI when linked; falls back to process.env for CI.
 */

const { execSync } = require("child_process");

const REQUIRED = [
  { key: "SITE_URL", pattern: /^https:\/\/.+[^/]$/ },
  { key: "STRIPE_SECRET_KEY", pattern: /^sk_(live|test)_[a-zA-Z0-9]+$/ },
  { key: "STRIPE_WEBHOOK_SECRET", pattern: /^whsec_[a-zA-Z0-9]+$/ },
];

const OPTIONAL = ["ORDER_NOTIFICATION_EMAIL", "ORDER_NOTIFICATION_FROM", "RESEND_API_KEY"];

function fail(message) {
  console.error("✗", message);
  process.exit(1);
}

function parseNetlifyEnvList(output) {
  const vars = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      vars[match[1]] = match[2].trim();
    }
  }
  return vars;
}

function parseJsonPayload(output) {
  const start = Math.min(
    ...["{", "["].map((ch) => {
      const idx = output.indexOf(ch);
      return idx === -1 ? Number.POSITIVE_INFINITY : idx;
    })
  );
  if (!Number.isFinite(start)) {
    throw new Error("No JSON payload in netlify env:list output");
  }
  return JSON.parse(output.slice(start));
}

function loadNetlifyEnv() {
  try {
    const output = execSync("npx netlify env:list --json --context production", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const parsed = parseJsonPayload(output);
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((row) => [row.key, row.values?.production || row.value || ""]));
    }
    return parsed;
  } catch {
    return null;
  }
}

function checkPresenceOnly(env) {
  const missing = [];
  for (const { key } of REQUIRED) {
    const value = env[key];
    if (!value || String(value).includes("REPLACE_ME")) {
      missing.push(key);
    }
  }
  return missing;
}

function main() {
  const checkOnly = process.argv.includes("--check-only");
  const netlifyEnv = loadNetlifyEnv();
  const source = netlifyEnv ? "Netlify (production context, --context production)" : "process.env";
  const env = netlifyEnv || process.env;

  console.log(`Checking production env from ${source}...\n`);

  if (checkOnly && netlifyEnv) {
    const missing = checkPresenceOnly(env);
    for (const { key } of REQUIRED) {
      if (missing.includes(key)) {
        console.log(`✗ ${key} — missing or placeholder`);
      } else {
        console.log(`✓ ${key} — set`);
      }
    }
    if (missing.length) {
      fail(`Missing required vars: ${missing.join(", ")}. Run npm run go-live after adding keys.`);
    }
    console.log("\nAll required production env vars are present on Netlify.");
    return;
  }

  for (const { key, pattern } of REQUIRED) {
    const value = env[key];
    if (!value || value.includes("REPLACE_ME")) {
      fail(`${key} is missing or still a placeholder.`);
    }
    if (!pattern.test(value)) {
      fail(`${key} format looks invalid.`);
    }
    console.log(`✓ ${key}`);
  }

  const isLive = /^sk_live_/.test(env.STRIPE_SECRET_KEY);
  if (!isLive) {
    console.warn("⚠ STRIPE_SECRET_KEY is test mode — use sk_live_... before taking real payments.");
  } else {
    console.log("✓ STRIPE_SECRET_KEY is live mode");
  }

  for (const key of OPTIONAL) {
    const value = env[key];
    if (value) {
      console.log(`✓ ${key} (optional)`);
    } else {
      console.log(`○ ${key} not set (optional)`);
    }
  }

  console.log("\nAll required production env vars are configured.");
}

main();
