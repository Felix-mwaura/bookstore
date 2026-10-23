import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { queueEmailDispatch } from "../../../lib/email-dispatch";

const ALLOWED_STATUSES = ["Pending", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"];

// GET /api/admin/orders — fetch ALL orders (admin only)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth; // 401 or 403

  const { adminClient } = auth;

  const { data, error } = await adminClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { orders: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// PATCH /api/admin/orders — update one order's status (admin only)
//
// All of the work happens inside the set_order_status() Postgres function:
//   • the order row is locked (FOR UPDATE), so two admins clicking at the
//     same time cannot both restock the same cancelled order;
//   • only valid transitions are accepted (Processing → Shipped/Cancelled,
//     Shipped → Delivered/Cancelled; Delivered and Cancelled are terminal);
//   • stock is restored exactly once, only on the transition to Cancelled;
//   • the admin action is written to admin_activity_log in the same
//     transaction.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, status, courier, tracking_ref: trackingRef } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (courier != null && (typeof courier !== "string" || courier.length > 80)) {
    return NextResponse.json({ error: "Invalid courier name" }, { status: 400 });
  }
  if (trackingRef != null && (typeof trackingRef !== "string" || trackingRef.length > 120)) {
    return NextResponse.json({ error: "Invalid tracking reference" }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("set_order_status", {
    p_order_id: id,
    p_new_status: status,
    p_admin_id: user.id,
    p_admin_email: user.email,
    p_courier: courier || null,
    p_tracking_ref: trackingRef || null,
  });

  if (error) {
    const msg = error.message || "";

    if (msg.includes("ORDER_NOT_FOUND")) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (msg.includes("INVALID_TRANSITION")) {
      const [, from = "its current state", to = status] = msg.split(":");
      return NextResponse.json(
        {
          error:
            from === "Delivered" || from === "Cancelled"
              ? `This order is already ${from.toLowerCase()} and cannot be changed.`
              : `An order cannot move from ${from} to ${to}.`,
          code: "INVALID_TRANSITION",
        },
        { status: 409 }
      );
    }
    if (msg.includes("INVALID_STATUS")) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }
    if (msg.startsWith("PAYMENT_NOT_CLEARED")) {
      return NextResponse.json(
        {
          error:
            "This order has not been paid for. Confirm the payment before dispatching it.",
          code: "PAYMENT_NOT_CLEARED",
        },
        { status: 409 }
      );
    }
    if (msg.includes("PAYMENT_FAILED")) {
      return NextResponse.json(
        {
          error:
            "The payment for this order failed. Resolve the payment before dispatching it.",
          code: "PAYMENT_FAILED",
        },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/orders:", msg);
    return NextResponse.json({ error: "Could not update the order" }, { status: 500 });
  }

  // Marking an order Delivered can unlock the "Verified purchase" badge on
  // reviews that customer already left for books in it. The badge itself is
  // always derived in the database from order history; this call only makes
  // the affected rows be recomputed now rather than on their next edit.
  // A failure here must never fail the order update, so it is awaited and
  // logged rather than thrown.
  if (status === "Delivered" && data?.user_id) {
    const { error: refreshError } = await adminClient.rpc("refresh_review_verification", {
      p_user_id: data.user_id,
    });
    if (refreshError) console.error("review badge refresh:", refreshError.message);
  }

  // The confirmation email was queued inside the same transaction; this only
  // nudges delivery along. A failure here leaves the row queued.
  queueEmailDispatch();

  return NextResponse.json({ order: data });
}
