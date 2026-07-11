import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for server-side DB writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("M-Pesa Callback received:", JSON.stringify(body, null, 2));

    const { Body } = body;
    const { stkCallback } = Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    if (ResultCode === 0) {
      // Payment successful
      const items = CallbackMetadata?.Item || [];
      const getMeta = (name) => items.find((i) => i.Name === name)?.Value;

      const amount = getMeta("Amount");
      const mpesaReceiptNumber = getMeta("MpesaReceiptNumber");
      const transactionDate = getMeta("TransactionDate");
      const phoneNumber = getMeta("PhoneNumber");

      // Extract order ID from AccountReference
      // AccountReference format: "BookHaven-{orderId}"
      // We store the CheckoutRequestID to match with the order later

      // Save payment record to Supabase
      await supabase.from("mpesa_payments").insert({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: MerchantRequestID,
        result_code: ResultCode,
        result_desc: ResultDesc,
        amount,
        mpesa_receipt: mpesaReceiptNumber,
        transaction_date: transactionDate?.toString(),
        phone: phoneNumber?.toString(),
        status: "completed",
      });

      // Update order status if we can find it
      await supabase
        .from("orders")
        .update({ status: "Processing", payment_ref: mpesaReceiptNumber })
        .eq("checkout_request_id", CheckoutRequestID);

      console.log(`✅ Payment successful: ${mpesaReceiptNumber} for KSh ${amount}`);
    } else {
      // Payment failed or cancelled
      await supabase.from("mpesa_payments").insert({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: MerchantRequestID,
        result_code: ResultCode,
        result_desc: ResultDesc,
        status: "failed",
      });

      console.log(`❌ Payment failed: ${ResultDesc}`);
    }

    // Always return 200 to Safaricom — they retry if they get non-200
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

// Safaricom sometimes sends GET to verify the URL
export async function GET() {
  return NextResponse.json({ status: "M-Pesa callback endpoint active" });
}