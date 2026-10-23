import { NextResponse } from "next/server";
import { userFromRequest, serviceClient } from "../../../lib/server";
import { mpesaConfig, resolveAccessToken, stkQuery } from "../../../lib/mpesa";
import { evaluateQuery } from "../../../lib/mpesa-verify";
import { readJsonBody, SMALL_BODY } from "../../../lib/request-guard";

// POST /api/mpesa/query — poll the status of the caller's own STK request.
//
// This is the reconciliation path when the callback has not arrived yet. The
// browser's claim of success is never trusted: the server asks Safaricom
// directly, and only the CALLBACK may settle a payment.
//
// Why the query cannot settle a payment by itself:
//   Daraja's stkpushquery response contains ResultCode/ResultDesc but no
//   Amount and no MpesaReceiptNumber. A "0" here proves the transaction
//   completed; it does not prove how much was paid, and it cannot supply the
//   receipt an order is stored against. So a positive query is reported as
//   "confirmed by M-Pesa, waiting for the receipt callback" — never as a
//   completed payment, and never as a paid order.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await userFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await readJsonBody(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body;

  const checkoutRequestId = body?.checkoutRequestId;
  if (typeof checkoutRequestId !== "string" || !checkoutRequestId.trim()) {
    return NextResponse.json({ error: "checkoutRequestId is required" }, { status: 400 });
  }
  if (checkoutRequestId.length > 120) {
    return NextResponse.json({ error: "checkoutRequestId is not valid" }, { status: 400 });
  }

  const config = mpesaConfig();
  if (config.error) {
    return NextResponse.json({ error: "M-Pesa is not configured." }, { status: 503 });
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    console.error("/api/mpesa/query: SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Only the customer who started this payment may query it.
  const { data: payment, error: lookupError } = await db
    .from("mpesa_payments")
    .select("id, status, expected_amount, amount, mpesa_receipt")
    .eq("checkout_request_id", checkoutRequestId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("/api/mpesa/query: lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not check the payment." }, { status: 500 });
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // A completed row is only ever written by the verified callback, so its
  // local state is trustworthy. It also always carries a receipt (the
  // callback refuses to complete without one); if it somehow does not, treat
  // it as unconfirmed rather than handing out a receipt-less success.
  if (payment.status === "completed" && payment.mpesa_receipt) {
    return NextResponse.json({
      success: true,
      pending: false,
      cancelled: false,
      amount: payment.amount ?? payment.expected_amount,
      receipt: payment.mpesa_receipt,
    });
  }

  if (payment.status === "failed") {
    return NextResponse.json({
      success: false,
      pending: false,
      cancelled: true,
      timedOut: false,
      resultDesc: "This payment did not go through.",
    });
  }

  // Same host resolution as the STK push: if that call had to fall back to
  // the other Daraja host, the status query has to follow it there or a paid
  // order would never be confirmed.
  const tokenResult = await resolveAccessToken(config);
  if (tokenResult.error) {
    console.error("/api/mpesa/query: OAuth failed", {
      environment: config.environment,
      environmentAssumed: config.environmentAssumed,
      status: tokenResult.status ?? null,
      code: tokenResult.code ?? null,
      message: tokenResult.message ?? null,
    });
    return NextResponse.json({ error: "We couldn't reach M-Pesa just now." }, { status: 502 });
  }

  const query = await stkQuery({
    config,
    accessToken: tokenResult.token,
    base: tokenResult.base ?? config.base,
    checkoutRequestId,
  });

  if (!query.ok) {
    // No verdict. Stay pending — do not guess in either direction.
    console.error("/api/mpesa/query: no verdict from Safaricom", {
      httpStatus: query.httpStatus ?? null,
      reason: query.reason ?? null,
      resultDesc: query.resultDesc ?? null,
    });
    return NextResponse.json({
      success: false,
      pending: true,
      cancelled: false,
      unverified: true,
      resultDesc: "M-Pesa has not answered yet.",
    });
  }

  const verdict = evaluateQuery({
    resultCode: query.resultCode,
    resultDesc: query.resultDesc,
  });

  if (verdict.action === "failed") {
    const { error } = await db
      .from("mpesa_payments")
      .update({
        status: "failed",
        result_code: verdict.resultCode,
        result_desc: verdict.resultDesc || verdict.reason,
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    if (error) {
      console.error("/api/mpesa/query: could not record a failure:", error.message);
    }

    return NextResponse.json({
      success: false,
      pending: false,
      cancelled: verdict.reason === "CANCELLED",
      timedOut: verdict.reason === "TIMEOUT",
      resultDesc: verdict.resultDesc || verdict.reason,
    });
  }

  if (verdict.action === "paid") {
    // Safaricom confirms the money moved, but this response carries neither
    // the amount nor the receipt, so the payment stays pending until the
    // callback supplies both. Record what we learned — without touching
    // status — so an operator investigating a stuck payment can see that
    // Safaricom said "success".
    const { error } = await db
      .from("mpesa_payments")
      .update({
        result_code: 0,
        result_desc: "Safaricom confirmed success; awaiting receipt callback",
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    if (error) {
      console.error("/api/mpesa/query: could not record confirmation:", error.message);
    }

    return NextResponse.json({
      success: false,
      pending: true,
      confirmedByDaraja: true,
      cancelled: false,
      amount: payment.expected_amount,
      resultDesc: "M-Pesa confirms the payment. Your receipt is still coming through.",
    });
  }

  // Any other code means "still waiting" (the customer may not have entered
  // their PIN yet).
  return NextResponse.json({
    success: false,
    pending: true,
    cancelled: false,
    resultDesc: verdict.resultDesc,
  });
}
