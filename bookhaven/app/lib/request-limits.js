// Small, pure policy helpers for the two places where a signed-in customer
// can consume a scarce resource: M-Pesa pushes and cash-on-delivery stock.
//
// They live here so the rules can be unit-tested without a database, and so
// the route code reads as a decision rather than a pile of comparisons.

// ── M-Pesa ────────────────────────────────────────────────────────────────
// An STK push costs money and rings a stranger's phone. 5 pushes per account
// in 10 minutes was already enforced; the phone number is the other axis,
// because one account can type a new number every time and one victim's phone
// can be targeted from several accounts.
export const MPESA_WINDOW_MS = 10 * 60 * 1000;
export const MPESA_MAX_PER_ACCOUNT = 5;
export const MPESA_MAX_PER_PHONE = 3;

/**
 * @param {{ accountAttempts: number, phoneAttempts: number }} counts
 * @returns {"account"|"phone"|null}
 */
export function mpesaAttemptVerdict({ accountAttempts, phoneAttempts }) {
  if (Number(accountAttempts) >= MPESA_MAX_PER_ACCOUNT) return "account";
  if (Number(phoneAttempts) >= MPESA_MAX_PER_PHONE) return "phone";
  return null;
}

export function mpesaLimitMessage(reason) {
  if (reason === "phone") {
    return "That number has had several M-Pesa attempts in the last few minutes. Please wait a little, or pay on delivery.";
  }
  return "Too many M-Pesa attempts. Please wait a few minutes and try again.";
}

// ── Cash on delivery ──────────────────────────────────────────────────────
// COD reserves stock without payment. Without a ceiling, an account can place
// order after order, hold the last copies of a book off the shelf, and never
// collect. 3 open COD orders and 5 copies of any one title is well above a
// normal household order and well below "clearing the shelf".
export const COD_MAX_OPEN = 3;
export const COD_MAX_LINE_QTY = 5;
export const COD_MAX_TOTAL_QTY = 15;

/**
 * @param {{ openCodOrders: number, lines: Array<{ quantity: number }> }} input
 * @returns {"open"|"line"|"total"|null}
 */
export function codVerdict({ openCodOrders, lines }) {
  if (Number(openCodOrders) >= COD_MAX_OPEN) return "open";
  const quantities = (lines || []).map((line) => Number(line?.quantity) || 0);
  if (quantities.some((qty) => qty > COD_MAX_LINE_QTY)) return "line";
  if (quantities.reduce((sum, qty) => sum + qty, 0) > COD_MAX_TOTAL_QTY) return "total";
  return null;
}

export function codLimitMessage(reason) {
  if (reason === "open") {
    return `You already have ${COD_MAX_OPEN} cash-on-delivery orders waiting. Please collect or cancel one before placing another, or pay with M-Pesa.`;
  }
  if (reason === "line") {
    return `Cash on delivery is limited to ${COD_MAX_LINE_QTY} copies of a single title. Please reduce the quantity or pay with M-Pesa.`;
  }
  return `Cash on delivery is limited to ${COD_MAX_TOTAL_QTY} books per order. Please reduce the basket or pay with M-Pesa.`;
}
