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

// POST /api/orders — save a new order after checkout (RLS-enforced)
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

  const { data, error } = await client
    .from("orders")
    .insert({
      user_id: user.id,
      items,
      total,
      delivery_details: deliveryDetails,
      payment_method: paymentMethod,
      checkout_request_id: checkoutRequestId || null,
      status: "Processing",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}