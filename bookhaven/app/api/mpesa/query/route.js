import { NextResponse } from "next/server";
import { userFromRequest, serviceClient } from "../../../lib/server";
import { mpesaConfig, resolveAccessToken, mpesaTimestamp, mpesaPassword } from "../../../lib/mpesa";

// POST /api/mpesa/query — poll the status of the caller's own STK request.
//
// This is the reconciliation path when the callback has not arrived yet.
// The browser's claim of success is never trusted: the server asks Safaricom
// directly, and only a ResultCode of 0 marks the stored payment completed.
export async function POST(request) {
  const auth = await userFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const checkoutRequestId = body?.checkoutRequestId;
  if (typeof checkoutRequestId !== "string" || !checkoutRequestId) {
    return NextResponse.json({ error: "checkoutRequestId is required" }, { status: 400 });
  }

  const config = mpesaConfig();
  if (config.error) {
    return NextResponse.json({ error: "M-Pesa is not configured." }, { status: 503 });
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Only the customer who started this payment may query it.
  const { data: payment } = await db
    .from("mpesa_payments")
    .select("id, status, expected_amount, amount, mpesa_receipt")
    .eq("checkout_request_id", checkoutRequestId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status === "completed") {
    return NextResponse.json({
      success: true,
      pending: false,
      cancelled: false,
      amount: payment.amount ?? payment.expected_amount,
      receipt: payment.mpesa_receipt,
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

  const timestamp = mpesaTimestamp();
  const password = mpesaPassword(config.shortcode, config.passkey, timestamp);

  const queryRes = await fetch(`${tokenResult.base ?? config.base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });

  const data = await queryRes.json().catch(() => ({}));
  const code = String(data.ResultCode ?? "");

  if (code === "0") {
    // Safaricom confirms the payment. Reconcile locally so place_order()
    // can verify it even if the callback is delayed.
    await db
      .from("mpesa_payments")
      .update({
        status: "completed",
        result_code: 0,
        result_desc: data.ResultDesc || "Confirmed via STK query",
        amount: payment.amount ?? payment.expected_amount,
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    return NextResponse.json({
      success: true,
      pending: false,
      cancelled: false,
      amount: payment.amount ?? payment.expected_amount,
    });
  }

  if (code === "1032" || code === "1037") {
    // 1032 = cancelled by user, 1037 = timeout / unreachable.
    await db
      .from("mpesa_payments")
      .update({
        status: "failed",
        result_code: Number(code),
        result_desc: data.ResultDesc || (code === "1032" ? "Cancelled" : "Timed out"),
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    return NextResponse.json({
      success: false,
      pending: false,
      cancelled: code === "1032",
      timedOut: code === "1037",
      resultDesc: data.ResultDesc,
    });
  }

  // Any other code means "still waiting" (the customer may not have entered
  // their PIN yet) unless Safaricom returned an explicit error.
  return NextResponse.json({
    success: false,
    pending: true,
    cancelled: false,
    resultDesc: data.ResultDesc,
  });
}
