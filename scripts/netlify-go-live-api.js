/**
 * Netlify go-live helpers (domain + access + env check).
 * Usage: node scripts/netlify-go-live-api.js [update-site|check-env|add-domain]
 */

const { execSync } = require("child_process");

const path = require("path");
const ROOT = path.join(__dirname, "..");
const SITE_ID = "16614ce3-2f9d-4954-9f64-91fd4cdbecde";

function netlifyApi(method, data) {
  const fs = require("fs");
  const payloadPath = path.join(ROOT, ".netlify-api-payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(data), "utf8");
  try {
    const out = execSync(`npx netlify api ${method} --data "${payloadPath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: ROOT,
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

const action = process.argv[2] || "status";

try {
  if (action === "update-site") {
    const site = netlifyApi("updateSite", {
      site_id: SITE_ID,
      body: {
        custom_domain: "krownfrontz.com",
        domain_aliases: ["www.krownfrontz.com"],
        sso_login: false,
        password_context: "none",
      },
    });
    console.log("Site updated:");
    console.log("  custom_domain:", site.custom_domain);
    console.log("  domain_aliases:", site.domain_aliases);
    console.log("  sso_login:", site.sso_login);
    console.log("  password_context:", site.password_context);
  } else if (action === "check-env") {
    const vars = netlifyApi("getSiteEnvVars", { site_id: SITE_ID });
    const keys = (vars || []).map((v) => v.key);
    const required = ["SITE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
    let ok = true;
    for (const key of required) {
      const entry = (vars || []).find((v) => v.key === key);
      const hasValue = entry?.values?.some(
        (v) => v.value && !String(v.value).includes("REPLACE_ME")
      );
      if (hasValue) {
        console.log(`✓ ${key} — set`);
      } else {
        console.log(`✗ ${key} — missing or placeholder`);
        ok = false;
      }
    }
    process.exit(ok ? 0 : 1);
  } else {
    const site = netlifyApi("getSite", { site_id: SITE_ID });
    console.log("custom_domain:", site.custom_domain);
    console.log("domain_aliases:", JSON.stringify(site.domain_aliases));
    console.log("sso_login:", site.sso_login);
    console.log("password_context:", site.password_context);
    console.log("ssl:", site.ssl);
    console.log("url:", site.ssl_url);
  }
} catch (error) {
  console.error("Netlify API error:", error.stderr || error.message);
  process.exit(1);
}
