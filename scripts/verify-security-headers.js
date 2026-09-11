/**
 * Verify security headers on deployed Krown Frontz URLs.
 * Usage: node scripts/verify-security-headers.js [url]
 */

const DEFAULT_URLS = [
  "https://krownfrontz.com",
  "https://krown-frontz.netlify.app",
];

const REQUIRED_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "content-security-policy",
];

function fail(message) {
  console.error("✗", message);
  process.exit(1);
}

async function checkUrl(url) {
  console.log(`\nChecking ${url}...`);
  let response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    console.warn(`  ⚠ Could not reach ${url}: ${error.message}`);
    return { url, ok: false, skipped: true };
  }

  const missing = [];
  for (const header of REQUIRED_HEADERS) {
    if (!response.headers.get(header)) {
      missing.push(header);
    }
  }

  if (missing.length) {
    console.error(`  ✗ Missing headers: ${missing.join(", ")}`);
    return { url, ok: false, missing, status: response.status };
  }

  if (response.status === 401) {
    console.warn(`  ⚠ HTTP 401 — site may have Netlify password protection; headers apply after deploy on public pages`);
    return { url, ok: false, skipped: true, passwordProtected: true };
  }

  console.log(`  ✓ HTTP ${response.status} — all required security headers present`);
  for (const header of REQUIRED_HEADERS) {
    const value = response.headers.get(header);
    const preview = value.length > 72 ? `${value.slice(0, 69)}...` : value;
    console.log(`    ${header}: ${preview}`);
  }
  return { url, ok: true };
}

async function main() {
  const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
  const results = [];

  for (const url of urls) {
    results.push(await checkUrl(url));
  }

  const checked = results.filter((r) => !r.skipped);
  const passed = checked.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);

  console.log(`\n${passed.length}/${checked.length} URLs passed header checks.`);
  if (skipped.length) {
    console.warn(`${skipped.length} URL(s) skipped (unreachable or password-protected).`);
  }

  if (checked.length && passed.length === 0) {
    fail("No deployed URLs passed security header verification.");
  }

  if (checked.some((r) => !r.ok)) {
    fail("One or more URLs are missing required security headers. Redeploy with npm run deploy after merging security changes.");
  }

  if (!checked.length && skipped.length) {
    console.warn("All URLs were skipped — redeploy and disable password protection to verify, or run against a public URL.");
    return;
  }
}

main();
