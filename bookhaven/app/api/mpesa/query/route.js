import { NextResponse } from "next/server";

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
}

export async function POST(request) {
  try {
    const { checkoutRequestId } = await request.json();

    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const passkey = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

    // Get token
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const { access_token } = await tokenRes.json();

    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    // Query STK status
    const queryRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });

    const data = await queryRes.json();

    // ResultCode 0 = success, 1032 = cancelled, 1037 = timeout
    return NextResponse.json({
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc,
      success: data.ResultCode === "0",
      cancelled: data.ResultCode === "1032",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}