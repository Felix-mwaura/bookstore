import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmlvcGNlYXZ0a2xqeXd1a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk1NTUsImV4cCI6MjA5NDc1NTU1NX0.zmZcxS2uxyon8Est9l3feYLuYy02hgcIpCNKAqKWtCE";

// Builds a client that carries the CALLER'S OWN JWT on every request.
// This is the missing piece: supabase.auth.getUser(token) only verifies
// a token — it does NOT attach it to later .from() calls on a plain
// createClient(url, anonKey) instance. Without this, every .from("orders")
// query below would run as the anon Postgres role, so
// `auth.uid() = user_id` RLS policies correctly (and silently) block
// both the SELECT (customer sees zero orders) and the INSERT (order
// never gets created), even though the API route itself reports success.
function clientForToken(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

function getToken(request) {
  return request.headers.get("authorization")?.replace("Bearer ", "") || null;
}

// GET /api/orders — fetch the logged-in user's own orders (RLS-enforced)
export async function GET(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = clientForToken(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data || [] });
}

// POST /api/orders — save a new order after checkout (RLS-enforced, stock-safe)
export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = clientForToken(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { items, total, deliveryDetails, paymentMethod, checkoutRequestId } = body;

  if (!items || !total || !deliveryDetails || !paymentMethod) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Cash on delivery isn't paid yet; M-Pesa/card orders only ever reach this
  // point after the payment step already succeeded, so they count as paid.
  const paymentStatus = /cod|cash/i.test(paymentMethod) ? "pending" : "paid";

  // place_order() is an atomic Postgres function: it locks each book row,
  // verifies enough stock exists, decrements it, and inserts the order in
  // one transaction — so two customers buying the last copy at the same
  // moment can't both succeed, and an order is never created for stock that
  // doesn't exist. user_id is always the SERVER-VERIFIED user — never taken
  // from the request body — so nobody can place an order as someone else.
  const { data, error } = await client.rpc("place_order", {
    p_user_id: user.id,
    p_items: items,
    p_total: total,
    p_delivery_details: deliveryDetails,
    p_payment_method: paymentMethod,
    p_payment_status: paymentStatus,
    p_checkout_request_id: checkoutRequestId || null,
  });

  if (error) {
    // Turn the RPC's raised exception into a clear, customer-facing message
    const msg = error.message || "";
    if (msg.includes("INSUFFICIENT_STOCK")) {
      const [, , title, available] = msg.split(":");
      return NextResponse.json(
        { error: `Only ${available} left of "${title}" — please update your cart.`, code: "INSUFFICIENT_STOCK" },
        { status: 409 }
      );
    }
    if (msg.includes("BOOK_NOT_FOUND")) {
      return NextResponse.json({ error: "One of the items in your cart is no longer available." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}