import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { readJsonObject, SMALL_BODY } from "../../../../lib/request-guard";
import { queueEmailDispatch } from "../../../../lib/email-dispatch";

const ALLOWED_STATUSES = [
  "Pending",
  "Processing",
  "Packed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/orders/bulk — apply one status to several orders.
//
// The database validates each order independently and returns which ones
// succeeded and why the others failed. The response is deliberately 200 even
// when some orders fail: a partial result is a real outcome that the UI has
// to show, not an error that hides the successes.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;

  const { ids, status, courier } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one order" },
      { status: 400 }
    );
  }
  if (ids.length > 100) {
    return NextResponse.json(
      { error: "You can update at most 100 orders at once" },
      { status: 400 }
    );
  }
  if (!ids.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json(
      { error: "One or more order ids are not valid" },
      { status: 400 }
    );
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

  const { data, error } = await adminClient.rpc("bulk_set_order_status", {
    p_order_ids: ids,
    p_new_status: status,
    p_admin_id: user.id,
    p_admin_email: user.email,
    p_courier: courier || null,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("NO_ORDERS_SELECTED")) {
      return NextResponse.json({ error: "Select at least one order" }, { status: 400 });
    }
    if (msg.includes("TOO_MANY_ORDERS")) {
      return NextResponse.json(
        { error: "You can update at most 100 orders at once" },
        { status: 400 }
      );
    }
    console.error("POST /api/admin/orders/bulk:", msg);
    return NextResponse.json(
      { error: "Could not process the batch" },
      { status: 500 }
    );
  }

  queueEmailDispatch();

  return NextResponse.json({
    requested: data?.requested ?? ids.length,
    succeeded: data?.succeeded ?? [],
    failed: (data?.failed ?? []).map((f) => ({
      id: f.id,
      reason: humanise(f.reason),
    })),
  });
}

// Turn "INVALID_TRANSITION:Delivered:Shipped" into something an admin can act
// on. Anything unrecognised is passed through rather than swallowed.
function humanise(raw = "") {
  if (raw.includes("ORDER_NOT_FOUND")) return "Order not found";
  if (raw.startsWith("INVALID_TRANSITION:")) {
    const [, from = "its current state", to = "that state"] = raw.split(":");
    return `Cannot move from ${from} to ${to}`;
  }
  if (raw.startsWith("PAYMENT_NOT_CLEARED")) {
    return "Payment has not been confirmed for this order";
  }
  if (raw.includes("PAYMENT_FAILED")) return "Payment failed for this order";
  if (raw.startsWith("INVALID_STATUS")) return "Invalid status";
  return raw || "Failed";
}
