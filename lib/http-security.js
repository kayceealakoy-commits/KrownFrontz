/** Shared HTTP security helpers for Netlify Functions. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LEN = 100;
const MAX_ADDRESS_LEN = 200;
const MAX_POSTCODE_LEN = 20;
const MAX_CART_ITEMS = 20;
const MAX_SELECTED_TEETH = 32;

/** In-memory rate limit buckets (per function instance; resets on cold start). */
const rateLimitBuckets = new Map();

function getSiteUrl() {
  return (process.env.SITE_URL || process.env.URL || "http://localhost:8888").replace(/\/$/, "");
}

function corsOrigin() {
  return getSiteUrl();
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function corsJson(statusCode, body, methods = "GET, OPTIONS") {
  return jsonResponse(statusCode, body, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": methods,
  });
}

function getClientIp(event) {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    rateLimitBuckets.set(key, { start: now, count: 1 });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function enforceRateLimit(event, action, maxRequests = 10, windowMs = 5 * 60 * 1000) {
  const ip = getClientIp(event);
  const key = `${action}:${ip}`;
  if (!checkRateLimit(key, maxRequests, windowMs)) {
    return { allowed: false, error: "Too many requests. Please wait a few minutes and try again." };
  }
  return { allowed: true };
}

function normalizeOrigin(origin) {
  if (!origin) return "";
  return origin.replace(/\/$/, "");
}

function checkOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin;
  if (!origin) return { allowed: true };

  const siteUrl = getSiteUrl();
  const allowed = [siteUrl];

  if (siteUrl.startsWith("https://")) {
    allowed.push(siteUrl.replace("https://", "http://"));
  }
  if (siteUrl.includes("://www.")) {
    allowed.push(siteUrl.replace("://www.", "://"));
  } else {
    const parts = siteUrl.split("://");
    if (parts.length === 2) {
      allowed.push(`${parts[0]}://www.${parts[1]}`);
    }
  }

  const normalized = normalizeOrigin(origin);
  if (allowed.some((a) => normalizeOrigin(a) === normalized)) {
    return { allowed: true };
  }

  return { allowed: false, error: "Request origin is not allowed." };
}

function trimField(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen);
}

function validateEmail(email) {
  const trimmed = trimField(email, 254);
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  return { valid: true, value: trimmed };
}

function validateCustomer(formData) {
  const customer = formData?.customer || {};
  const address = customer.address || {};

  const emailResult = validateEmail(customer.email);
  if (!emailResult.valid) {
    return { valid: false, error: emailResult.error };
  }

  const first = trimField(customer.first, MAX_NAME_LEN);
  const last = trimField(customer.last, MAX_NAME_LEN);
  const line1 = trimField(address.line1, MAX_ADDRESS_LEN);
  const city = trimField(address.city, MAX_NAME_LEN);
  const postcode = trimField(address.postcode, MAX_POSTCODE_LEN);

  if (!first || !last || !line1 || !city || !postcode) {
    return { valid: false, error: "Please complete all required checkout fields." };
  }

  return {
    valid: true,
    customer: {
      email: emailResult.value,
      first,
      last,
      name: `${first} ${last}`,
      address: {
        line1,
        line2: trimField(address.line2, MAX_ADDRESS_LEN),
        city,
        postcode,
        country: trimField(address.country, MAX_NAME_LEN),
      },
    },
  };
}

function validateCartItems(items) {
  if (!Array.isArray(items)) {
    return { valid: false, error: "Cart is empty." };
  }
  if (!items.length) {
    return { valid: false, error: "Cart is empty." };
  }
  if (items.length > MAX_CART_ITEMS) {
    return { valid: false, error: "Cart exceeds the maximum number of items." };
  }

  for (const item of items) {
    if (item.kind === "grillz" && Array.isArray(item.selectedTeeth)) {
      if (item.selectedTeeth.length > MAX_SELECTED_TEETH) {
        return { valid: false, error: "Too many teeth selected on a cart line." };
      }
    }
    if (item.selectedTeethLabel && String(item.selectedTeethLabel).length > MAX_ADDRESS_LEN) {
      return { valid: false, error: "Teeth label is too long." };
    }
  }

  return { valid: true };
}

function validateSessionId(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id || id.length > 255 || !/^cs_[a-zA-Z0-9_]+$/.test(id)) {
    return { valid: false, error: "Invalid session reference." };
  }
  return { valid: true, value: id };
}

module.exports = {
  corsJson,
  jsonResponse,
  getSiteUrl,
  corsOrigin,
  getClientIp,
  enforceRateLimit,
  checkOrigin,
  validateEmail,
  validateCustomer,
  validateCartItems,
  validateSessionId,
};
