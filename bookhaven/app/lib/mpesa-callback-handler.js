// The M-Pesa callback decision, with its inputs injected.
//
// Kept apart from the route so the money path can be exercised with a fake
// store and a fake Safaricom (scripts/mpesa-callback-smoke.mjs), including
// the cases that are impossible to arrange against production: a database
// write failure, two callbacks racing, a forged success.
//
// app/api/mpesa/callback/route.js is a thin wrapper: it builds the store
// from the service-role client and the Daraja query from the real API.

import { parseCallback, evaluateCallback } from "./mpesa-verify.js";

export const ACCEPTED = { ResultCode: 0, ResultDesc: "Accepted" };
export const RETRY = { ResultCode: 1, ResultDesc: "Temporarily unavailable" };

/**
 * Store adapter for a Supabase service-role client.
 *
 * Every method returns `{ error }` on failure and never throws, so the
 * handler has exactly one place to decide "this did not happen".
 */
export function supabaseStore(db) {
  return {
    async findIntent(checkoutRequestId) {
      const { data, error } = await db
        .from("mpesa_payments")
        .select(
          "id, status, user_id, order_id, expected_amount, merchant_request_id, checkout_request_id, mpesa_receipt"
        )
        .eq("checkout_request_id", checkoutRequestId)
        .maybeSingle();
      return { intent: data || null, error };
    },

    async findReceiptOwner(receipt, exceptId) {
      const { data, error } = await db
        .from("mpesa_payments")
        .select("id")
        .eq("mpesa_receipt", receipt)
        .neq("id", exceptId)
        .maybeSingle();
      return { paymentId: data?.id || null, error };
    },

    async completePending(id, fields) {
      const { data, error } = await db
        .from("mpesa_payments")
        .update(fields)
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      return { won: Array.isArray(data) && data.length === 1, error };
    },

    async failPending(id, fields) {
      const { error } = await db
        .from("mpesa_payments")
        .update(fields)
        .eq("id", id)
        .eq("status", "pending");
      return { error };
    },

    async holdPending(id, fields) {
      const { error } = await db
        .from("mpesa_payments")
        .update(fields)
        .eq("id", id)
        .eq("status", "pending");
      return { error };
    },

    async recordCallback(row) {
      const { error } = await db.from("mpesa_callbacks").insert(row);
      if (!error) return { error: null, missingTable: false };
      const code = error.code || "";
      const message = error.message || "";
      const missingTable =
        code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message);
      return { error, missingTable };
    },
  };
}

function holdFields(reason, merchantRequestId) {
  return {
    result_desc: `HELD: ${reason}`.slice(0, 500),
    ...(merchantRequestId ? { merchant_request_id: merchantRequestId } : {}),
  };
}

/**
 * @param {object} args
 * @param {unknown} args.body        the parsed JSON body Safaricom posted
 * @param {ReturnType<typeof supabaseStore>} args.store
 * @param {{ query: (checkoutRequestId: string) => Promise<object> }} [args.daraja]
 *        `query` resolves to `{ ok: true, resultCode, resultDesc }` or
 *        `{ ok: false, reason }`.
 * @param {(msg: string, meta?: object) => void} [args.log]
 * @returns {Promise<{ status: number, payload: object }>}
 */
export async function handleMpesaCallback({ body, store, daraja, log = () => {} }) {
  const callback = parseCallback(body);
  if (!callback.ok) {
    log("M-Pesa callback ignored", { reason: callback.reason });
    return { status: 200, payload: ACCEPTED };
  }

  const lookup = await store.findIntent(callback.checkoutRequestId);
  if (lookup.error) {
    log("M-Pesa callback: intent lookup failed", { error: lookup.error.message });
    // Ask Safaricom to retry; we could not read our own records.
    return { status: 500, payload: RETRY };
  }

  if (!lookup.intent) {
    // We never created this payment, or it was created after Safaricom already
    // called back. Preserve the evidence; change nothing.
    const recorded = await store.recordCallback({
      checkout_request_id: callback.checkoutRequestId,
      merchant_request_id: callback.merchantRequestId,
      result_code: callback.resultCode,
      result_desc: callback.resultDesc,
      payload: callback.raw,
      matched_payment_id: null,
      outcome: "unmatched",
      reason: "NO_INTENT",
    });
    if (recorded.missingTable) {
      log("M-Pesa callback: mpesa_callbacks is missing; unmatched callback not preserved", {
        checkoutRequestId: callback.checkoutRequestId,
      });
    }
    return { status: 200, payload: ACCEPTED };
  }

  const intent = lookup.intent;

  // ── replay: one receipt, one payment ───────────────────────────────────
  if (callback.resultCode === 0 && callback.receipt) {
    const reuse = await store.findReceiptOwner(callback.receipt, intent.id);
    if (reuse.error) {
      log("M-Pesa callback: receipt lookup failed", { error: reuse.error.message });
      return { status: 500, payload: RETRY };
    }
    if (reuse.paymentId) {
      log("M-Pesa callback: receipt already settled another payment", {
        paymentId: intent.id,
        existingPaymentId: reuse.paymentId,
      });
      await store.holdPending(intent.id, holdFields("RECEIPT_REUSED", callback.merchantRequestId));
      await store.recordCallback({
        checkout_request_id: callback.checkoutRequestId,
        merchant_request_id: callback.merchantRequestId,
        result_code: callback.resultCode,
        result_desc: callback.resultDesc,
        payload: callback.raw,
        matched_payment_id: intent.id,
        outcome: "rejected",
        reason: "RECEIPT_REUSED",
      });
      return { status: 200, payload: ACCEPTED };
    }
  }

  // ── ask Safaricom before believing a success ───────────────────────────
  let query = null;
  if (callback.resultCode === 0) {
    if (!daraja?.query) {
      query = { ok: false, reason: "NO_DARAJA_CLIENT" };
    } else {
      query = await daraja.query(callback.checkoutRequestId);
    }
  }

  const verdict = evaluateCallback({ callback, intent, query });

  const baseRecord = {
    checkout_request_id: callback.checkoutRequestId,
    merchant_request_id: callback.merchantRequestId,
    result_code: callback.resultCode,
    result_desc: callback.resultDesc,
    payload: callback.raw,
    matched_payment_id: intent.id,
  };

  if (verdict.action === "ignore") {
    await store.recordCallback({ ...baseRecord, outcome: "ignored", reason: verdict.reason });
    return { status: 200, payload: ACCEPTED };
  }

  if (verdict.action === "complete") {
    const write = await store.completePending(intent.id, verdict.fields);
    if (write.error) {
      log("M-Pesa callback: could not store a verified payment", {
        paymentId: intent.id,
        error: write.error.message,
      });
      await store.recordCallback({ ...baseRecord, outcome: "error", reason: "DB_WRITE_FAILED" });
      // The only notification of a real payment. Let Safaricom send it again.
      return { status: 500, payload: RETRY };
    }

    await store.recordCallback({
      ...baseRecord,
      outcome: write.won ? "completed" : "duplicate",
      reason: write.won ? "VERIFIED" : "ALREADY_SETTLED",
    });

    if (!write.won) {
      log("M-Pesa callback: duplicate delivery ignored", { paymentId: intent.id });
    }
    return { status: 200, payload: ACCEPTED };
  }

  if (verdict.action === "fail") {
    const write = await store.failPending(intent.id, verdict.fields);
    if (write.error) {
      log("M-Pesa callback: could not record a failed payment", {
        paymentId: intent.id,
        error: write.error.message,
      });
      return { status: 500, payload: RETRY };
    }
    await store.recordCallback({ ...baseRecord, outcome: "failed", reason: verdict.reason });
    return { status: 200, payload: ACCEPTED };
  }

  // ── hold: an ambiguity, recorded, never acted on ───────────────────────
  await store.holdPending(intent.id, holdFields(verdict.reason, callback.merchantRequestId));
  await store.recordCallback({ ...baseRecord, outcome: "held", reason: verdict.reason });

  if (verdict.retryable) {
    // Safaricom says success, we could not confirm it. Ask for another
    // delivery rather than accepting the body on trust or dropping it.
    return { status: 500, payload: { ResultCode: 1, ResultDesc: "Could not verify yet" } };
  }

  return { status: 200, payload: ACCEPTED };
}
