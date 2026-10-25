import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { readJsonBody, isJsonObject, isUuid, ADMIN_BODY } from "../../../../lib/request-guard";
import { queueEmailDispatch } from "../../../../lib/email-dispatch";

const ALLOWED = ["pending", "paid", "failed", "refund_pending", "refunded"];

// PATCH /api/admin/orders/payment — move the payment half of an order.
//
// Deliberately a separate endpoint from the fulfilment status: a refund is
// not a delivery state, and conflating them is how "cancelled" ends up
// counted as revenue.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;

  const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const { id, status, payment_ref: paymentRef } = body;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "A valid order id is required" }, { status: 400 });
  }
  if (!ALLOWED.includes(status)) {
    return NextResponse.json(
      { error: `Payment status must be one of: ${ALLOWED.join(", ")}` },
      { status: 400 }
    );
  }
  if (paymentRef != null && (typeof paymentRef !== "string" || paymentRef.length > 120)) {
    return NextResponse.json(
      { error: "Payment reference is too long" },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.rpc("set_order_payment_status", {
    p_order_id: id,
    p_new_status: status,
    p_admin_id: user.id,
    p_admin_email: user.email,
    p_payment_ref: paymentRef || null,
  });

  if (error) {
    const msg = error.message || "";

    if (msg.includes("ORDER_NOT_FOUND")) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (msg.startsWith("INVALID_PAYMENT_TRANSITION:")) {
      const [, from = "its current state", to = status] = msg.split(":");
      return NextResponse.json(
        {
          error: `A payment cannot move from ${from} to ${to}`,
          code: "INVALID_PAYMENT_TRANSITION",
        },
        { status: 409 }
      );
    }
    if (msg.includes("ORDER_CANCELLED")) {
      return NextResponse.json(
        {
          error:
            "This order was cancelled before payment. Record a refund instead of marking it paid.",
          code: "ORDER_CANCELLED",
        },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/orders/payment:", msg);
    return NextResponse.json(
      { error: "Could not update the payment status" },
      { status: 500 }
    );
  }

  queueEmailDispatch();

  return NextResponse.json({ order: data });
}
