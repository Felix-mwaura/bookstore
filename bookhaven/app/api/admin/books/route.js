import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { readJsonObject, ORDER_BODY } from "../../../lib/request-guard";
import { sanitize, coverPrefix } from "../../../lib/book-admin.js";

function logActivity(adminClient, user, action, id, details) {
  return adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action, target_type: "book", target_id: String(id), details,
  }).then(({ error }) => { if (error) console.error("activity log failed:", error.message); });
}

// GET /api/admin/books — all books incl. archived (the storefront filters
// is_archived itself).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient } = auth;

  const { data, error } = await adminClient.from("books").select("*").order("id");
  if (error) {
    console.error("GET /api/admin/books:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Real ratings, from real reviews. The `rating` and `reviews` columns on
  // `books` hold invented numbers (4.5 by default) and are never displayed;
  // this overwrites them in the response so the Products table shows the
  // truth, or nothing at all.
  const ids = (data || []).map((book) => book.id);
  const summaries = new Map();
  if (ids.length > 0) {
    const { data: rows } = await adminClient
      .from("book_rating_summary")
      .select("book_id, average_rating, review_count")
      .in("book_id", ids);
    for (const row of rows || []) {
      summaries.set(Number(row.book_id), {
        rating: Number(row.average_rating),
        reviews: Number(row.review_count),
      });
    }
  }
  const books = (data || []).map((book) => {
    const summary = summaries.get(Number(book.id));
    return { ...book, rating: summary ? summary.rating : null, reviews: summary ? summary.reviews : 0 };
  });

  return NextResponse.json({ books }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/books — create
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: ORDER_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;

  const { data: fields, error: vError } = sanitize(body, { partial: false });
  if (vError) return NextResponse.json({ error: vError }, { status: 400 });

  const { data, error } = await adminClient
    // `rating` is written as null, not 4.5: a brand-new book has no reviews,
    // and seeding it with a flattering default is exactly the invented
    // number this change set removes. Real figures come from book_reviews.
    .from("books").insert({ ...fields, rating: null, reviews: 0, tags: [] }).select().single();
  if (error) {
    console.error("POST /api/admin/books:", error.message);
    return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 500 });
  }

  await logActivity(adminClient, user, "book_added", data.id, { title: data.title });
  return NextResponse.json({ book: data }, { status: 201 });
}

// PATCH /api/admin/books — update
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: ORDER_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: fields, error: vError } = sanitize(body, { partial: true });
  if (vError) return NextResponse.json({ error: vError }, { status: 400 });

  // A stock number typed into the book form is still an inventory movement,
  // so it goes through adjust_book_stock() rather than a blind column write.
  // Otherwise editing a book would silently bypass the movement history that
  // the Inventory tab depends on.
  const stockTarget = fields.stock_quantity;
  const hasStockChange = stockTarget !== undefined;
  if (hasStockChange) delete fields.stock_quantity;

  if (Object.keys(fields).length === 0 && !hasStockChange) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  let data;
  if (Object.keys(fields).length > 0) {
    const { data: updated, error } = await adminClient
      .from("books").update(fields).eq("id", body.id).select().maybeSingle();
    if (error) {
      console.error("PATCH /api/admin/books:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    data = updated;
  }

  if (hasStockChange) {
    const stockReason = typeof body.stock_reason === "string" ? body.stock_reason : "manual_adjustment";
    const allowedReasons = ["restock", "correction", "damage", "return", "manual_adjustment"];
    if (!allowedReasons.includes(stockReason)) {
      return NextResponse.json({ error: "Invalid stock reason" }, { status: 400 });
    }
    const stockNote =
      typeof body.stock_note === "string" && body.stock_note.trim().length >= 3
        ? body.stock_note.trim().slice(0, 300)
        : "Stock edited from the book form";

    const { data: adjusted, error: stockError } = await adminClient.rpc("adjust_book_stock", {
      p_book_id: body.id,
      p_new_quantity: stockTarget,
      p_reason: stockReason,
      p_note: stockNote,
      p_admin_id: user.id,
      p_admin_email: user.email,
    });

    if (stockError) {
      const msg = stockError.message || "";
      if (msg.includes("BOOK_NOT_FOUND")) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }
      console.error("PATCH /api/admin/books (stock):", msg);
      return NextResponse.json({ error: "Could not update stock" }, { status: 500 });
    }
    data = adjusted;
  }

  await logActivity(adminClient, user, "book_updated", body.id, {
    title: data.title,
    fields: Object.keys(fields).concat(hasStockChange ? ["stock_quantity"] : []),
  });
  return NextResponse.json({ book: data });
}

// DELETE /api/admin/books — hard delete only if no order references the
// book; otherwise archive, so order history stays intact.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: ORDER_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: book } = await adminClient.from("books").select("title,cover_url").eq("id", id).maybeSingle();
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const { data: hasOrders, error: checkError } = await adminClient.rpc("book_has_orders", { p_book_id: id });
  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  if (hasOrders) {
    const { error } = await adminClient.from("books").update({ is_archived: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logActivity(adminClient, user, "book_archived", id, { title: book.title, reason: "referenced by existing orders" });
    return NextResponse.json({ archived: true, deleted: false });
  }

  const { error } = await adminClient.from("books").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: remove the now-orphaned cover file. Failure here must not
  // fail the delete — the book row is already gone.
  if (book.cover_url?.startsWith(coverPrefix())) {
    const path = book.cover_url.slice(coverPrefix().length);
    const { error: rmError } = await adminClient.storage.from("book-covers").remove([path]);
    if (rmError) console.error("cover cleanup failed:", rmError.message);
  }

  await logActivity(adminClient, user, "book_deleted", id, { title: book.title });
  return NextResponse.json({ archived: false, deleted: true });
}