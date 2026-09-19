import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

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
  return NextResponse.json({ orders: data });
}

// PATCH /api/admin/orders — update order status (admin only)
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  // Read the current status first — only restock on a genuine transition
  // INTO Cancelled, never twice for the same order.
  const { data: existing } = await adminClient.from("orders").select("status").eq("id", id).single();

  const { data, error } = await adminClient
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "Cancelled" && existing?.status !== "Cancelled") {
    const { error: restockError } = await adminClient.rpc("restock_order", { p_order_id: id });
    if (restockError) console.error("Restock failed for order", id, restockError.message);
  }

  await adminClient.from("admin_activity_log").insert({
    admin_id: user.id,
    admin_email: user.email,
    action: "order_status_updated",
    target_type: "order",
    target_id: id,
    details: { from: existing?.status, to: status },
  });

  return NextResponse.json({ order: data });
}