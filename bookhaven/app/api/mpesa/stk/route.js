import { NextResponse } from "next/server";
import { userFromRequest, serviceClient } from "../../../lib/server";
import {
  mpesaConfig,
  mpesaAccessToken,
  mpesaTimestamp,
  mpesaPassword,
  normalisePhone,
} from "../../../lib/mpesa";

// POST /api/mpesa/stk
//
// Initiates an STK push for a signed-in customer.
//
// The amount is NOT taken from the request body. It is recomputed from the
// books table with quote_cart(), so a client cannot pay KSh 1 for a KSh 4,950
// order. The resulting mpesa_payments row is what place_order() later
// verifies, so an attacker cannot forge a successful payment either.
export async function POST(request) {
  const auth = await userFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in to pay." }, { status: 401 });

  const { user } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { phone, items } = body || {};

  const formattedPhone = normalisePhone(phone);
  if (!/^254(7|1)\d{8}$/.test(formattedPhone)) {
    return NextResponse.json({ error: "Enter a valid Safaricom number (07XX or 01XX)." }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const cleanItems = items.map((i) => ({
    id: Number(i?.id),
    quantity: Number(i?.quantity),
  }));
  if (cleanItems.some((i) => !Number.isInteger(i.id) || i.id <= 0 || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 50)) {
    return NextResponse.json({ error: "Your cart contains an invalid item." }, { status: 400 });
  }

  const config = mpesaConfig();
  if (config.error) {
    console.error("/api/mpesa/stk:", config.error);
    return NextResponse.json(
      { error: "M-Pesa is not available right now. Please choose cash on delivery instead." },
      { status: 503 }
    );
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    console.error("/api/mpesa/stk: SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ error: "Server misconfigured — please contact support." }, { status: 500 });
  }

  // Light abuse guard: cap how many pushes one account can trigger.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentAttempts } = await db
    .from("mpesa_payments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", tenMinutesAgo);

  if ((recentAttempts || 0) >= 5) {
    return NextResponse.json(
      { error: "Too many M-Pesa attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  // Refuse to take money for books that cannot be fulfilled. Stock is
  // re-checked atomically again in place_order() after payment.
  const { data: catalogue, error: catalogueError } = await db
    .from("books")
    .select("id, title, stock_quantity, is_archived")
    .in("id", cleanItems.map((i) => i.id));

  if (catalogueError) {
    console.error("/api/mpesa/stk: catalogue lookup failed:", catalogueError.message);
    return NextResponse.json({ error: "Could not check stock. Please try again." }, { status: 500 });
  }

  for (const item of cleanItems) {
    const book = (catalogue || []).find((b) => b.id === item.id);
    if (!book || book.is_archived) {
      return NextResponse.json(
        { error: "One of the books in your cart is no longer available." },
        { status: 409 }
      );
    }
    if (book.stock_quantity < item.quantity) {
      return NextResponse.json(
        { error: `Only ${book.stock_quantity} left of "${book.title}" — please update your cart.` },
        { status: 409 }
      );
    }
  }

  // Server-authoritative price (subtotal + delivery).
  const { data: amount, error: quoteError } = await db.rpc("quote_cart", {
    p_items: cleanItems,
  });

  if (quoteError) {
    const msg = quoteError.message || "";
    if (msg.includes("INSUFFICIENT") || msg.includes("BOOK_NOT_FOUND") || msg.includes("INVALID")) {
      return NextResponse.json({ error: "Some items in your cart are no longer available." }, { status: 409 });
    }
    console.error("/api/mpesa/stk quote_cart:", msg);
    return NextResponse.json({ error: "Could not price your cart. Please try again." }, { status: 500 });
  }

  const tokenResult = await mpesaAccessToken(config);
  if (tokenResult.error) {
    console.error("/api/mpesa/stk: OAuth failed");
    return NextResponse.json({ error: "M-Pesa is temporarily unavailable. Please try again." }, { status: 502 });
  }

  const timestamp = mpesaTimestamp();
  const password = mpesaPassword(config.shortcode, config.passkey, timestamp);

  const stkRes = await fetch(`${config.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: formattedPhone,
      PartyB: config.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: config.callbackUrl,
      AccountReference: `BookHaven-${user.id.slice(0, 8)}`,
      TransactionDesc: "Book Haven order",
    }),
    cache: "no-store",
  });

  const stkData = await stkRes.json().catch(() => ({}));

  if (stkData.ResponseCode !== "0" || !stkData.CheckoutRequestID) {
    console.error("/api/mpesa/stk: STK rejected", {
      code: stkData.errorCode || stkData.ResponseCode,
      message: stkData.errorMessage || stkData.ResponseDescription,
    });
    return NextResponse.json(
      { error: stkData.errorMessage || "M-Pesa could not send the payment prompt. Please try again." },
      { status: 502 }
    );
  }

  // Record the expectation BEFORE any callback can arrive. The callback may
  // only update this row — it can never insert one. If this write fails we
  // must not hand the customer a payment prompt we cannot reconcile.
  const { error: insertError } = await db.from("mpesa_payments").insert({
    checkout_request_id: stkData.CheckoutRequestID,
    merchant_request_id: stkData.MerchantRequestID,
    user_id: user.id,
    expected_amount: Math.ceil(Number(amount)),
    status: "pending",
  });

  if (insertError) {
    console.error("/api/mpesa/stk: could not record payment intent:", insertError.message);
    return NextResponse.json(
      { error: "Could not start the payment safely. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    checkoutRequestId: stkData.CheckoutRequestID,
    amount: Math.ceil(Number(amount)),
    message: "STK push sent",
  });
}
