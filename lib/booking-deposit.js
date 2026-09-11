/** Booking deposit session metadata and verification helpers. */

const DEPOSIT_REDEEMED_META = "deposit_redeemed";
const BOOKING_DEPOSIT_TYPE = "booking_deposit";

function isBookingDepositSession(session) {
  return session?.metadata?.type === BOOKING_DEPOSIT_TYPE;
}

function isDepositRedeemed(session) {
  return session?.metadata?.[DEPOSIT_REDEEMED_META] === "1";
}

/**
 * Decide how to respond when verifying a checkout session.
 * @param {{ payment_status?: string, metadata?: Record<string, string> }} session
 * @param {boolean} redeemRequested - true when unlocking Calendly for the first time
 */
function resolveDepositVerification(session, redeemRequested) {
  const paid = session.payment_status === "paid";
  const type = session.metadata?.type || "order";

  if (!isBookingDepositSession(session)) {
    return { action: "return", body: { paid, type } };
  }

  if (!paid) {
    return { action: "return", body: { paid: false, type: BOOKING_DEPOSIT_TYPE } };
  }

  const redeemed = isDepositRedeemed(session);

  if (redeemRequested) {
    if (redeemed) {
      return {
        action: "reject",
        statusCode: 409,
        body: {
          error: "This deposit has already been used to unlock booking.",
          paid: false,
          type: BOOKING_DEPOSIT_TYPE,
        },
      };
    }
    return {
      action: "redeem",
      body: { paid: true, type: BOOKING_DEPOSIT_TYPE },
    };
  }

  return {
    action: "return",
    body: { paid: true, type: BOOKING_DEPOSIT_TYPE, redeemed },
  };
}

module.exports = {
  DEPOSIT_REDEEMED_META,
  BOOKING_DEPOSIT_TYPE,
  isBookingDepositSession,
  isDepositRedeemed,
  resolveDepositVerification,
};
