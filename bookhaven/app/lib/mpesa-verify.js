// Verification rules for an M-Pesa STK payment.
//
// Everything here is a pure function of its arguments: no network, no
// database, no globals. That is deliberate — these are the rules that decide
// whether real money is treated as received, so they have to be readable,
// reviewable and testable with a mocked Safaricom response
// (see scripts/mpesa-callback-smoke.mjs).
//
// THREAT MODEL
//   Daraja does not sign callbacks, and /api/mpesa/callback is a public URL.
//   Anyone who learns a CheckoutRequestID (it is returned to the browser that
//   started the payment, and appears in Daraja's own responses) can POST a
//   fabricated "success" to it. Therefore the HTTP body on its own is never
//   evidence of payment:
//
//     1. the callback must match a payment intent WE persisted before the
//        push was sent (so a forged success cannot invent a payment);
//     2. the MerchantRequestID must match that intent;
//     3. the reported amount must be EXACTLY the amount we asked for —
//        not "at least", because an overpayment is still not an order total;
//     4. a receipt number must be present;
//     5. Safaricom must independently confirm success when we ask
//        /mpesa/stkpushquery/v1/query.
//
//   Anything that fails these checks leaves the row in `pending` with a
//   reason recorded, and is copied to mpesa_callbacks so a human can
//   reconcile it. Nothing is ever silently accepted, and nothing is ever
//   deleted.

/** M-Pesa receipts are ~10 uppercase alphanumerics, e.g. "SGR7XYZ1AB". */
export const RECEIPT_PATTERN = /^[A-Z0-9]{6,24}$/;

const MAX_TEXT = 500;

function text(value, max = MAX_TEXT) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Normalise Safaricom's callback envelope.
 *
 * Returns `{ ok: true, ...fields }` or `{ ok: false, reason }`. A malformed
 * body is not an error worth a 500: Safaricom retries 5xx responses, and a
 * body we cannot parse will not become parseable on retry.
 */
export function parseCallback(body) {
  const stk = body?.Body?.stkCallback;
  if (!stk || typeof stk !== "object") {
    return { ok: false, reason: "MALFORMED_CALLBACK" };
  }

  const checkoutRequestId = text(stk.CheckoutRequestID, 120);
  if (!checkoutRequestId) {
    return { ok: false, reason: "MISSING_CHECKOUT_REQUEST_ID" };
  }

  const items = Array.isArray(stk.CallbackMetadata?.Item)
    ? stk.CallbackMetadata.Item
    : [];
  const pick = (name) => {
    const hit = items.find((item) => item && item.Name === name);
    return hit ? hit.Value : undefined;
  };

  const rawCode = stk.ResultCode;
  const resultCode =
    rawCode === null || rawCode === undefined || rawCode === ""
      ? null
      : Number(rawCode);

  return {
    ok: true,
    checkoutRequestId,
    merchantRequestId: text(stk.MerchantRequestID, 120),
    resultCode: Number.isFinite(resultCode) ? resultCode : null,
    resultDesc: text(stk.ResultDesc),
    amount: pick("Amount"),
    receipt: text(pick("MpesaReceiptNumber"), 40),
    transactionDate: pick("TransactionDate"),
    phone: pick("PhoneNumber"),
    raw: stk,
  };
}

/** Facts about the stored intent that the callback is checked against. */
export function describeIntent(intent) {
  const expected = Number(intent?.expected_amount);
  return {
    id: intent?.id ?? null,
    status: intent?.status ?? null,
    userId: intent?.user_id ?? null,
    orderId: intent?.order_id ?? null,
    merchantRequestId: intent?.merchant_request_id ?? null,
    checkoutRequestId: intent?.checkout_request_id ?? null,
    expectedAmount: Number.isFinite(expected) && expected > 0 ? expected : null,
  };
}

/**
 * Decide what a callback is allowed to do.
 *
 * @param {object} args
 * @param {object} args.callback  result of parseCallback()
 * @param {object} args.intent    the mpesa_payments row (may be null)
 * @param {object|null} args.query Safaricom's STK-query verdict:
 *        `{ ok: true, resultCode, resultDesc }` when Safaricom answered,
 *        `{ ok: false, reason }` when it could not be reached.
 *
 * @returns {{
 *   action: 'complete'|'fail'|'hold'|'ignore',
 *   reason: string,
 *   retryable?: boolean,
 *   fields?: object
 * }}
 *
 * `complete` is the only action that may set status='completed', and it is
 * reachable only with all five checks above satisfied.
 */
export function evaluateCallback({ callback, intent, query } = {}) {
  if (!callback || callback.ok !== true) {
    return { action: "ignore", reason: callback?.reason || "MALFORMED_CALLBACK" };
  }
  if (!intent) {
    return { action: "ignore", reason: "NO_INTENT" };
  }

  const expected = describeIntent(intent);

  if (!expected.expectedAmount) {
    // A pre-existing row with no recorded amount cannot be verified. Hold it
    // rather than guessing what the customer agreed to pay.
    return { action: "hold", reason: "INTENT_WITHOUT_AMOUNT" };
  }

  if (expected.status === "completed") {
    return { action: "ignore", reason: "ALREADY_COMPLETED" };
  }
  if (expected.status !== "pending") {
    return { action: "ignore", reason: `INTENT_${String(expected.status).toUpperCase()}` };
  }
  if (expected.orderId) {
    return { action: "ignore", reason: "INTENT_ALREADY_ORDERED" };
  }

  // ── 2. the callback must belong to this intent ──────────────────────────
  if (!callback.merchantRequestId) {
    return { action: "hold", reason: "MISSING_MERCHANT_REQUEST_ID" };
  }
  if (
    expected.merchantRequestId &&
    callback.merchantRequestId !== expected.merchantRequestId
  ) {
    // Not our payment. Do not touch the row at all: a body with a foreign
    // merchant id must not be able to fail or complete our pending payment.
    return { action: "ignore", reason: "MERCHANT_REQUEST_ID_MISMATCH" };
  }

  if (callback.resultCode === null) {
    return { action: "ignore", reason: "MISSING_RESULT_CODE" };
  }

  // ── non-zero result: the customer cancelled, timed out, or had no float ──
  if (callback.resultCode !== 0) {
    return {
      action: "fail",
      reason: "DARAJA_NON_ZERO_RESULT",
      fields: {
        status: "failed",
        result_code: callback.resultCode,
        result_desc: (callback.resultDesc || "Payment was not completed").slice(0, 500),
        merchant_request_id: callback.merchantRequestId,
      },
    };
  }

  // ── 4. a success must carry a receipt ───────────────────────────────────
  if (!callback.receipt || !RECEIPT_PATTERN.test(callback.receipt)) {
    return { action: "hold", reason: "MISSING_RECEIPT" };
  }

  // ── 3. exact amount, not "at least" ─────────────────────────────────────
  const reported = Number(callback.amount);
  if (!Number.isFinite(reported)) {
    return { action: "hold", reason: "MISSING_AMOUNT" };
  }
  if (Math.round(reported) !== expected.expectedAmount) {
    return {
      action: "hold",
      reason: reported < expected.expectedAmount ? "UNDERPAID" : "AMOUNT_MISMATCH",
    };
  }

  // ── 5. independent confirmation from Safaricom ──────────────────────────
  if (!query || query.ok !== true) {
    // Could not ask. Keep the row pending and tell the caller to ask Daraja
    // to retry the callback rather than accepting the body on trust.
    return { action: "hold", reason: "DARAJA_UNAVAILABLE", retryable: true };
  }
  if (query.resultCode !== 0) {
    // Safaricom says this transaction did not succeed. The body claiming
    // otherwise is either corrupted or forged.
    return { action: "hold", reason: "DARAJA_DISPUTES_SUCCESS" };
  }
  if (
    query.checkoutRequestId &&
    query.checkoutRequestId !== callback.checkoutRequestId
  ) {
    return { action: "hold", reason: "DARAJA_CHECKOUT_ID_MISMATCH" };
  }

  return {
    action: "complete",
    reason: "VERIFIED",
    fields: {
      status: "completed",
      result_code: 0,
      result_desc: callback.resultDesc || "Confirmed by Safaricom",
      amount: reported,
      mpesa_receipt: callback.receipt,
      transaction_date: callback.transactionDate
        ? String(callback.transactionDate).slice(0, 32)
        : null,
      phone: callback.phone ? String(callback.phone).slice(0, 20) : null,
      merchant_request_id: callback.merchantRequestId,
    },
  };
}

/**
 * Decide what an STK *query* response is allowed to do.
 *
 * A query can prove that Safaricom accepted the push, but its response has
 * no Amount and no MpesaReceiptNumber — so it cannot prove how much was paid
 * or give the receipt an order needs. It may therefore never set
 * status='completed' on its own; only the callback (verified) does that.
 *
 * @returns {{ action: 'paid'|'failed'|'pending', ... }}
 */
export function evaluateQuery({ resultCode, resultDesc } = {}) {
  const code = Number(resultCode);
  if (!Number.isFinite(code)) {
    return { action: "pending", reason: "UNRECOGNISED_RESULT" };
  }
  if (code === 0) {
    return { action: "paid", resultCode: 0, resultDesc: text(resultDesc) };
  }
  if (code === 1032) {
    return { action: "failed", resultCode: 1032, reason: "CANCELLED", resultDesc: text(resultDesc) };
  }
  if (code === 1037) {
    return { action: "failed", resultCode: 1037, reason: "TIMEOUT", resultDesc: text(resultDesc) };
  }
  if (code === 1031) {
    return { action: "failed", resultCode: 1031, reason: "INSUFFICIENT_FUNDS", resultDesc: text(resultDesc) };
  }
  // Anything else (500.001.1001 "still processing", etc.) is not a verdict.
  return { action: "pending", resultCode: code, resultDesc: text(resultDesc) };
}
