/**
 * Disable team SSO / password protection on the krown-frontz Netlify site.
 * Usage: node scripts/disable-netlify-sso.js
 */

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const SITE_ID = "16614ce3-2f9d-4954-9f64-91fd4cdbecde";
const ROOT = path.join(__dirname, "..");

function netlifyApi(method, data) {
  const payloadPath = path.join(ROOT, ".netlify-api-payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(data), "utf8");
  try {
    const out = execSync(`npx netlify api ${method} --data "${payloadPath}"`, {
      encoding: "utf8",
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, Path: `C:\\Program Files\\nodejs;${process.env.Path || ""}` },
    });
    return JSON.parse(out);
  } finally {
    try {
      fs.unlinkSync(payloadPath);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const site = netlifyApi("updateSite", {
    site_id: SITE_ID,
    body: {
      sso_login: false,
      password_context: "none",
    },
  });
  console.log("✓ Site access updated:");
  console.log("  sso_login:", site.sso_login);
  console.log("  password_context:", site.password_context);
  console.log("  url:", site.ssl_url || site.url);
}

main().catch((error) => {
  console.error("Netlify API error:", error.stderr?.toString() || error.message);
  console.error(
    "If this fails, disable SSO manually: https://app.netlify.com/projects/krown-frontz/configuration/access"
  );
  process.exit(1);
});
