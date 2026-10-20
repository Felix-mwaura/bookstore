import { NextResponse } from "next/server";
import { serviceClient } from "../../../lib/server";

// POST /api/mpesa/callback — Safaricom's asynchronous result notification.
//
// Trust model:
//   • The callback is unauthenticated (Daraja does not sign payloads), so it
//     must never be able to CREATE a payment. It may only UPDATE the pending
//     row that /api/mpesa/stk created before the prompt was sent.
//   • That row already carries the user id and the server-computed amount,
//     so a forged "success" cannot attach a payment to an order it did not
//     pay for.
//   • Idempotent: a repeated callback finds nothing pending and is a no-op.
//   • It never writes to `orders`. Linking a payment to an order happens
//     only inside place_order(), which re-validates everything.
export async function POST(request) {
  try {
    const body = await request.json();
    const stk = body?.Body?.stkCallback;
    if (!stk?.CheckoutRequestID) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const {
      CheckoutRequestID,
      MerchantRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stk;

    const db = serviceClient();
    const meta = CallbackMetadata?.Item || [];
    const getMeta = (name) => meta.find((i) => i.Name === name)?.Value;

    if (ResultCode === 0 || ResultCode === "0") {
      const amount = Number(getMeta("Amount"));
      const receipt = getMeta("MpesaReceiptNumber");
      const transactionDate = getMeta("TransactionDate");
      const phone = getMeta("PhoneNumber");

      const { data: pending } = await db
        .from("mpesa_payments")
        .select("id, expected_amount, status")
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending")
        .maybeSingle();

      if (!pending) {
        // Already processed, or we never initiated this payment. Ignore.
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      // The amount Safaricom reports must cover what we asked for.
      if (!Number.isFinite(amount) || amount < Number(pending.expected_amount || 0)) {
        await db
          .from("mpesa_payments")
          .update({
            status: "failed",
            result_code: ResultCode,
            result_desc: "Amount did not match the expected total",
            amount: Number.isFinite(amount) ? amount : null,
            mpesa_receipt: receipt || null,
            merchant_request_id: MerchantRequestID,
          })
          .eq("id", pending.id)
          .eq("status", "pending");
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      await db
        .from("mpesa_payments")
        .update({
          status: "completed",
          result_code: ResultCode,
          result_desc: ResultDesc,
          amount,
          mpesa_receipt: receipt || null,
          transaction_date: transactionDate ? String(transactionDate) : null,
          phone: phone ? String(phone) : null,
          merchant_request_id: MerchantRequestID,
        })
        .eq("id", pending.id)
        .eq("status", "pending");

      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await db
      .from("mpesa_payments")
      .update({
        status: "failed",
        result_code: ResultCode,
        result_desc: ResultDesc,
        merchant_request_id: MerchantRequestID,
      })
      .eq("checkout_request_id", CheckoutRequestID)
      .eq("status", "pending");

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    // Always 200 to Safaricom; a 4xx/5xx makes it retry for hours.
    console.error("M-Pesa callback error:", error?.message || error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

export async function GET() {
  return NextResponse.json({ status: "M-Pesa callback endpoint active" });
}
