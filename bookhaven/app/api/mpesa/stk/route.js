import { NextResponse } from "next/server";

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function getPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, amount, orderId } = body;

    // Validate inputs
    if (!phone || !amount || !orderId) {
      return NextResponse.json({ error: "Missing phone, amount, or orderId" }, { status: 400 });
    }

    // Normalise phone to 254XXXXXXXXX
    const normalisePhone = (raw) => {
      const digits = raw.replace(/\D/g, "");
      if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
      if (digits.startsWith("254") && digits.length === 12) return digits;
      if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
      return digits;
    };

    const formattedPhone = normalisePhone(phone);
    if (formattedPhone.length !== 12) {
      return NextResponse.json({ error: "Invalid Safaricom phone number" }, { status: 400 });
    }

    // Round amount to whole number (M-Pesa doesn't accept decimals)
    const roundedAmount = Math.ceil(Number(amount));

    // Get OAuth token
    const key = process.env.MPESA_CONSUMER_KEY 
    const secret = process.env.MPESA_CONSUMER_SECRET ;
    const shortcode = process.env.MPESA_SHORTCODE ;
    const passkey = process.env.MPESA_PASSKEY ;
    const callbackUrl = process.env.MPESA_CALLBACK_URL ;

    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json();
    console.log("🔑 Token response:", tokenData.access_token ? "Token received ✓" : `Token failed: ${JSON.stringify(tokenData)}`);

    if (!tokenData.access_token) {
      return NextResponse.json({ error: "Failed to get M-Pesa token", details: tokenData }, { status: 500 });
    }

    const timestamp = getTimestamp();
    const password = getPassword(shortcode, passkey, timestamp);

    // Initiate STK Push
    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: roundedAmount,
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: callbackUrl,
          AccountReference: `BookHaven-${orderId}`,
          TransactionDesc: `Book Haven Order ${orderId}`,
        }),
      }
    );

    const stkData = await stkRes.json();
    console.log("📱 Safaricom STK Response:", JSON.stringify(stkData, null, 2));

    if (stkData.ResponseCode === "0") {
      // Success — STK push sent to phone
      return NextResponse.json({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
        message: "STK push sent successfully",
      });
    } else {
      return NextResponse.json({
        error: stkData.errorMessage || stkData.ResponseDescription || "STK push failed",
        details: stkData,
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}