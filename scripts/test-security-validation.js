/**
 * Security validation smoke tests (no Stripe API calls).
 * Usage: node scripts/test-security-validation.js
 */

const {
  validateEmail,
  validateCustomer,
  validateCartItems,
  validateSessionId,
  checkOrigin,
  enforceRateLimit,
} = require("../lib/http-security");
const { resolveDepositVerification } = require("../lib/booking-deposit");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fail(message) {
  console.error("✗", message);
  process.exit(1);
}

// Email validation
if (validateEmail("test@example.com").valid !== true) {
  fail("valid email should pass");
}
if (validateEmail("not-an-email").valid !== false) {
  fail("invalid email should fail");
}
if (validateEmail("a@b.c").valid !== true) {
  fail("short valid email should pass");
}

// Customer validation
const goodCustomer = validateCustomer({
  customer: {
    email: "buyer@example.com",
    first: "Jane",
    last: "Doe",
    address: {
      line1: "1 Test Street",
      city: "Manchester",
      postcode: "M1 1AA",
      country: "United Kingdom",
    },
  },
});
if (!goodCustomer.valid) {
  fail("valid customer should pass");
}

const badCustomer = validateCustomer({
  customer: { email: "bad", first: "", last: "Doe", address: { line1: "1", city: "M", postcode: "M1" } },
});
if (badCustomer.valid) {
  fail("incomplete customer should fail");
}

// Cart limits
const bigCart = Array.from({ length: 21 }, (_, i) => ({
  kind: "kit",
  kitId: "impression-kit-uk",
  id: i,
}));
if (validateCartItems(bigCart).valid) {
  fail("cart over 20 items should fail");
}

const xssTeeth = validateCartItems([
  {
    kind: "grillz",
    productId: "canine",
    material: "dental-gold",
    selectedTeeth: ["11"],
    selectedTeethLabel: "<script>alert(1)</script>",
  },
]);
if (!xssTeeth.valid) {
  fail("xss teeth label within length should pass server validation");
}

const escaped = escapeHtml("<script>alert(1)</script>");
if (escaped.includes("<script>")) {
  fail("escapeHtml should neutralize script tags");
}
if (!escaped.includes("&lt;script&gt;")) {
  fail("escapeHtml should encode angle brackets");
}

// Session ID validation
if (!validateSessionId("cs_test_a1b2c3d4").valid) {
  fail("valid Stripe session id should pass");
}
if (validateSessionId("cs_test_bad;drop").valid) {
  fail("malformed session id should fail");
}
if (validateSessionId("").valid) {
  fail("empty session id should fail");
}

// Origin check
process.env.SITE_URL = "https://krownfrontz.com";
const allowedOrigin = checkOrigin({ headers: { origin: "https://krownfrontz.com" } });
if (!allowedOrigin.allowed) {
  fail("production origin should be allowed");
}

const blockedOrigin = checkOrigin({ headers: { origin: "https://evil.example" } });
if (blockedOrigin.allowed) {
  fail("unknown origin should be blocked");
}

const noOrigin = checkOrigin({ headers: {} });
if (!noOrigin.allowed) {
  fail("missing origin should be allowed (same-origin GET)");
}

const localOrigin = checkOrigin({ headers: { origin: "http://localhost:8888" } });
if (!localOrigin.allowed) {
  fail("localhost origin should be allowed for local Stripe testing");
}

const loopbackOrigin = checkOrigin({ headers: { origin: "http://127.0.0.1:5500" } });
if (!loopbackOrigin.allowed) {
  fail("127.0.0.1 origin should be allowed for local Stripe testing");
}

// Booking deposit one-time redeem
const unpaidDeposit = resolveDepositVerification(
  { payment_status: "unpaid", metadata: { type: "booking_deposit" } },
  true
);
if (unpaidDeposit.action !== "return" || unpaidDeposit.body.paid !== false) {
  fail("unpaid booking deposit should return paid:false");
}

const redeemDeposit = resolveDepositVerification(
  { payment_status: "paid", metadata: { type: "booking_deposit" } },
  true
);
if (redeemDeposit.action !== "redeem") {
  fail("paid unredeemed deposit with redeem=1 should require redeem action");
}

const reusedDeposit = resolveDepositVerification(
  { payment_status: "paid", metadata: { type: "booking_deposit", deposit_redeemed: "1" } },
  true
);
if (reusedDeposit.action !== "reject" || reusedDeposit.statusCode !== 409) {
  fail("already redeemed deposit with redeem=1 should be rejected");
}

const refreshDeposit = resolveDepositVerification(
  { payment_status: "paid", metadata: { type: "booking_deposit", deposit_redeemed: "1" } },
  false
);
if (refreshDeposit.body.paid !== true || refreshDeposit.body.redeemed !== true) {
  fail("redeemed deposit read-only check should still return paid:true");
}

// Rate limit
const fakeEvent = { headers: { "x-nf-client-connection-ip": "192.0.2.1" } };
for (let i = 0; i < 10; i += 1) {
  const result = enforceRateLimit(fakeEvent, "test-action", 10);
  if (!result.allowed) {
    fail("rate limit should allow first 10 requests");
  }
}
const blocked = enforceRateLimit(fakeEvent, "test-action", 10);
if (blocked.allowed) {
  fail("rate limit should block 11th request");
}

console.log("✓ email validation");
console.log("✓ customer validation");
console.log("✓ cart size limits");
console.log("✓ escapeHtml neutralizes XSS payloads");
console.log("✓ session id format validation");
console.log("✓ origin allowlist");
console.log("✓ booking deposit one-time redeem");
console.log("✓ rate limiting");
