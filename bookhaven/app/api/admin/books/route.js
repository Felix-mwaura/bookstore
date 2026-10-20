import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { SUPABASE_URL } from "../../../lib/supabase-config";

// Only these columns can ever be written from the browser — blocks
// mass-assignment of things like rating/reviews/created_at, and `stock`
// (the text label), which a DB trigger derives from stock_quantity.
const ALLOWED = [
  "title","author","isbn","description","price","original_price","category",
  "format","badge","stock_quantity","low_stock_threshold","is_featured",
  "is_archived","pages","publisher","year","cover","cover_url",
];

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Must match the URL the browser client builds for getPublicUrl(), including
// the env fallback — otherwise every upload would be rejected as "not ours".
function coverPrefix() {
  return `${SUPABASE_URL}/storage/v1/object/public/book-covers/`;
}

// Returns { data } with only whitelisted, validated fields, or { error }.
function sanitize(body, { partial }) {
  const data = {};
  for (const k of ALLOWED) if (body[k] !== undefined) data[k] = body[k];

  const required = ["title", "author", "price", "category", "stock_quantity"];
  if (!partial) for (const k of required) {
    if (data[k] === undefined || data[k] === null || data[k] === "") return { error: `${k} is required` };
  }

  if ("title" in data && (typeof data.title !== "string" || !data.title.trim())) return { error: "title must not be empty" };
  if ("author" in data && (typeof data.author !== "string" || !data.author.trim())) return { error: "author must not be empty" };
  if ("price" in data && (!isNum(data.price) || data.price < 0)) return { error: "price must be a number, 0 or more" };
  if ("original_price" in data && data.original_price !== null && (!isNum(data.original_price) || data.original_price < 0)) return { error: "original_price must be 0 or more" };
  if ("stock_quantity" in data && (!isInt(data.stock_quantity) || data.stock_quantity < 0)) return { error: "stock_quantity must be a whole number, 0 or more" };
  if ("low_stock_threshold" in data && (!isInt(data.low_stock_threshold) || data.low_stock_threshold < 1)) return { error: "low_stock_threshold must be a whole number, 1 or more" };
  if ("pages" in data && data.pages !== null && (!isInt(data.pages) || data.pages < 0)) return { error: "pages must be a whole number" };
  if ("year" in data && data.year !== null && (!isInt(data.year) || data.year < 1000 || data.year > new Date().getFullYear() + 1)) return { error: "year is not valid" };
  if ("cover_url" in data && data.cover_url !== null) {
    // Only images in OUR bucket — never an arbitrary external URL.
    if (typeof data.cover_url !== "string" || !data.cover_url.startsWith(coverPrefix())) return { error: "cover_url must point to the book-covers storage bucket" };
  }
  if (typeof data.title === "string") data.title = data.title.trim();
  if (typeof data.author === "string") data.author = data.author.trim();
  return { data };
}

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
  return NextResponse.json({ books: data }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/books — create
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { data: fields, error: vError } = sanitize(body, { partial: false });
  if (vError) return NextResponse.json({ error: vError }, { status: 400 });

  const { data, error } = await adminClient
    .from("books").insert({ ...fields, rating: 4.5, reviews: 0, tags: [] }).select().single();
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

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: fields, error: vError } = sanitize(body, { partial: true });
  if (vError) return NextResponse.json({ error: vError }, { status: 400 });
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await adminClient.from("books").update(fields).eq("id", body.id).select().maybeSingle();
  if (error) {
    console.error("PATCH /api/admin/books:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  await logActivity(adminClient, user, "book_updated", body.id, { title: data.title, fields: Object.keys(fields) });
  return NextResponse.json({ book: data });
}

// DELETE /api/admin/books — hard delete only if no order references the
// book; otherwise archive, so order history stays intact.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
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