import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

// GET /api/admin/books — fetch all books (including archived, for the
// admin list; the customer-facing catalogue filters is_archived itself)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { data, error } = await adminClient.from("books").select("*").order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ books: data });
}

// POST /api/admin/books — add a book
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const body = await request.json();
  // `stock` is derived automatically from stock_quantity by a DB trigger —
  // never accept it directly, so it can never drift out of sync.
  const { stock, ...payload } = body;

  const { data, error } = await adminClient
    .from("books")
    .insert({ ...payload, rating: 4.5, reviews: 0, tags: [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action: "book_added", target_type: "book", target_id: String(data.id),
    details: { title: data.title },
  });

  return NextResponse.json({ book: data });
}

// PATCH /api/admin/books — update a book (price, stock_quantity, is_featured,
// is_archived, or any other editable field)
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const { id, stock, ...updates } = await request.json();

  const { data, error } = await adminClient
    .from("books")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action: "book_updated", target_type: "book", target_id: String(id),
    details: { fields: Object.keys(updates) },
  });

  return NextResponse.json({ book: data });
}

// DELETE /api/admin/books — delete a book, UNLESS it's referenced by an
// existing order, in which case archive it instead so order history stays
// intact. Never silently do the wrong one — the response tells the caller
// which action actually happened.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const { id } = await request.json();

  const { data: hasOrders, error: checkError } = await adminClient.rpc("book_has_orders", { p_book_id: id });
  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  if (hasOrders) {
    const { error } = await adminClient.from("books").update({ is_archived: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from("admin_activity_log").insert({
      admin_id: user.id, admin_email: user.email,
      action: "book_archived", target_type: "book", target_id: String(id),
      details: { reason: "referenced by existing orders" },
    });

    return NextResponse.json({ archived: true, deleted: false });
  }

  const { error } = await adminClient.from("books").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action: "book_deleted", target_type: "book", target_id: String(id),
  });

  return NextResponse.json({ archived: false, deleted: true });
}