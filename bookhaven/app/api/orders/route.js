import { NextResponse } from "next/server";
import { clientForToken, bearerToken, serviceClient } from "../../lib/server";
import { queueEmailDispatch } from "../../lib/email-dispatch";
import { DELIVERY_FEE } from "../../lib/site";

// GET /api/orders — the signed-in customer's own orders (RLS-enforced)
export async function GET(request) {
  const token = bearerToken(request);
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

// Normalise to exactly what place_order() understands: [{ id, quantity }].
// Prices, titles and totals in the request body are ignored on purpose —
// the database re-reads them, so a tampered client cannot set its own price.
function cleanItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;

  const merged = new Map();
  for (const item of raw) {
    const id = Number(item?.id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;
    merged.set(id, (merged.get(id) || 0) + quantity);
  }

  const items = [...merged.entries()].map(([id, quantity]) => ({ id, quantity }));
  if (items.some((i) => i.quantity > 50)) return null;
  return items;
}

function cleanDeliveryDetails(raw) {
  if (!raw || typeof raw !== "object") return null;
  const str = (v, max) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const details = {
    firstName: str(raw.firstName, 80),
    lastName: str(raw.lastName, 80),
    email: str(raw.email, 160),
    phone: str(raw.phone, 32),
    address: str(raw.address, 240),
    city: str(raw.city, 80),
    notes: str(raw.notes, 500),
  };

  if (!details.firstName || !details.lastName || !details.phone || !details.address || !details.city) {
    return null;
  }
  return details;
}

// POST /api/orders — save a new order after checkout
//
// Security / integrity properties:
//   • the caller is identified by the verified JWT, never by the body;
//   • prices and the total are recomputed by place_order() from the books
//     table — the client's `total` is not accepted at all;
//   • stock is locked and decremented atomically inside that function;
//   • M-Pesa orders only succeed when a completed mpesa_payments row exists
//     for this user, for this checkout id, that has not already been used;
//   • the same idempotency key returns the original order instead of
//     creating a duplicate (double-click / retry safe).
export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = clientForToken(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, deliveryDetails, paymentMethod, checkoutRequestId, idempotencyKey } = body || {};

  const cleanItemList = cleanItems(items);
  if (!cleanItemList) {
    return NextResponse.json(
      { error: "Your cart is empty or contains an invalid quantity." },
      { status: 400 }
    );
  }

  const cleanDetails = cleanDeliveryDetails(deliveryDetails);
  if (!cleanDetails) {
    return NextResponse.json(
      { error: "Please provide a name, phone number, delivery address and town." },
      { status: 400 }
    );
  }

  if (typeof paymentMethod !== "string" || !paymentMethod.trim()) {
    return NextResponse.json({ error: "A payment method is required." }, { status: 400 });
  }

  const method = paymentMethod.trim().toLowerCase();
  if (!["mpesa", "cod"].includes(method)) {
    return NextResponse.json(
      { error: "That payment method is not available yet." },
      { status: 400 }
    );
  }

  if (method === "mpesa" && (typeof checkoutRequestId !== "string" || !checkoutRequestId)) {
    return NextResponse.json(
      { error: "We could not verify this M-Pesa payment. Please try again." },
      { status: 402 }
    );
  }

  const idem =
    typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim().slice(0, 100)
      : null;

  let serverClient;
  try {
    serverClient = serviceClient();
  } catch {
    console.error("/api/orders: SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfigured — please contact support" },
      { status: 500 }
    );
  }

  // Cheap per-account throttle: a real customer does not place eight orders
  // in ten minutes, but a script that has stolen a session would. This runs
  // against the database so it holds across serverless instances.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentOrders } = await serverClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", tenMinutesAgo);

  if ((recentOrders || 0) >= 8) {
    return NextResponse.json(
      { error: "That is a lot of orders in a short time. Please wait a few minutes or contact us." },
      { status: 429 }
    );
  }

  // The order writer must agree with what the customer was shown. If the
  // database still carries the old delivery charge (the free-delivery
  // migration has not been applied), place_order() would add KSh 300 that the
  // checkout never displayed. Refuse the order instead of taking money for a
  // total the customer did not agree to.
  const { data: rule, error: ruleError } = await serverClient.rpc("delivery_fee_rule");
  if (ruleError || Number(rule) !== DELIVERY_FEE) {
    console.error(
      "/api/orders: delivery pricing is out of step with the app —",
      ruleError ? ruleError.message : `database charges ${rule}, app expects ${DELIVERY_FEE}`,
      "— apply supabase/migrations/20261021090000_free_delivery.sql"
    );
    return NextResponse.json(
      {
        error: "Checkout is being updated. Please try again in a few minutes — you have not been charged.",
        code: "PRICING_NOT_READY",
      },
      { status: 503 }
    );
  }

  const { data, error } = await serverClient.rpc("place_order", {
    p_user_id: user.id,
    p_items: cleanItemList,
    p_delivery_details: cleanDetails,
    p_payment_method: method,
    p_checkout_request_id: method === "mpesa" ? checkoutRequestId : null,
    p_idempotency_key: idem,
  });

  if (error) {
    const msg = error.message || "";

    if (msg.includes("INSUFFICIENT_STOCK")) {
      // Message shape: INSUFFICIENT_STOCK:{"id":..,"title":..,"available":..}
      const payload = msg.slice(msg.indexOf(":") + 1);
      let detail = null;
      try {
        detail = JSON.parse(payload);
      } catch {
        // Fall through to a generic message.
      }
      return NextResponse.json(
        {
          error: detail
            ? `Only ${detail.available} left of "${detail.title}" — please update your cart.`
            : "One of the books in your cart no longer has enough stock.",
          code: "INSUFFICIENT_STOCK",
          detail,
        },
        { status: 409 }
      );
    }

    if (msg.includes("BOOK_NOT_FOUND")) {
      return NextResponse.json(
        { error: "One of the items in your cart is no longer available.", code: "BOOK_NOT_FOUND" },
        { status: 409 }
      );
    }

    if (msg.includes("PAYMENT_NOT_VERIFIED")) {
      return NextResponse.json(
        {
          error:
            "We could not confirm this M-Pesa payment. If you were charged, contact support with your M-Pesa receipt number — do not pay again.",
          code: "PAYMENT_NOT_VERIFIED",
        },
        { status: 402 }
      );
    }

    if (msg.includes("INVALID_DELIVERY_DETAILS")) {
      return NextResponse.json(
        { error: "Please provide a name, phone number, delivery address and town." },
        { status: 400 }
      );
    }

    if (msg.includes("INVALID_ITEMS") || msg.includes("INVALID_QUANTITY")) {
      return NextResponse.json(
        { error: "Your cart contains an invalid item or quantity." },
        { status: 400 }
      );
    }

    console.error("/api/orders place_order failed:", msg);
    return NextResponse.json(
      { error: "We could not save your order. Please try again." },
      { status: 500 }
    );
  }

  // The confirmation email is already queued in the same transaction that
  // created the order. This only starts delivery; it cannot fail the order.
  queueEmailDispatch();

  return NextResponse.json({ order: data });
}
