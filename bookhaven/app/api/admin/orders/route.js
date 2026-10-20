import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

const ALLOWED_STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"];

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

  const { id, status } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.rpc("set_order_status", {
    p_order_id: id,
    p_new_status: status,
    p_admin_id: user.id,
    p_admin_email: user.email,
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

    console.error("PATCH /api/admin/orders:", msg);
    return NextResponse.json({ error: "Could not update the order" }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}
