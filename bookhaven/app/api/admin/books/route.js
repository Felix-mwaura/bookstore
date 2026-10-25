import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { SUPABASE_URL } from "../../../lib/supabase-config";
import { readJsonBody, isJsonObject, ADMIN_BODY } from "../../../lib/request-guard";

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

// Text fields and their maximum lengths.
//
// There were no caps before: a 10 MB title (or a description containing a
// "</script>" payload for the JSON-LD tag) was accepted and stored. Book rows
// are rendered on public pages, sent to Supabase, indexed by search engines
// and streamed to the admin table, so "how long can this be" is a security
// property, not a cosmetic one. These are limits on what the form can
// sensibly produce, not a replacement for database constraints.
const TEXT_LIMITS = {
  title: 200,
  author: 160,
  isbn: 32,
  description: 5000,
  category: 80,
  format: 60,
  badge: 60,
  publisher: 160,
};

// `cover` is a small JSONB style object ({ bg, accent, pattern }), not text.
// It is bounded so it cannot become a storage dump.
const COVER_KEYS = ["bg", "accent", "pattern"];
const COVER_VALUE_MAX = 64;
const COVER_MAX_KEYS = 8;

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

  // Text: type, emptiness (for the fields that are required) and length.
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (!(field in data)) continue;
    const value = data[field];

    if (value === null) {
      if (field === "title" || field === "author" || field === "category") {
        return { error: `${field} must not be empty` };
      }
      continue;
    }
    if (typeof value !== "string") return { error: `${field} must be text` };

    const trimmed = value.trim();
    if ((field === "title" || field === "author" || field === "category") && !trimmed) {
      return { error: `${field} must not be empty` };
    }
    if (trimmed.length > max) {
      return { error: `${field} must be ${max} characters or fewer` };
    }
    data[field] = trimmed;
  }

  if ("cover" in data && data.cover !== null) {
    const cover = data.cover;
    if (typeof cover !== "object" || Array.isArray(cover)) {
      return { error: "cover must be an object" };
    }
    const keys = Object.keys(cover);
    if (keys.length > COVER_MAX_KEYS) return { error: "cover has too many fields" };
    for (const key of keys) {
      if (!COVER_KEYS.includes(key)) return { error: `cover.${key} is not allowed` };
      if (typeof cover[key] !== "string" || cover[key].length > COVER_VALUE_MAX) {
        return { error: `cover.${key} must be text of ${COVER_VALUE_MAX} characters or fewer` };
      }
    }
  }

  if ("cover_url" in data && data.cover_url !== null && typeof data.cover_url === "string" && data.cover_url.length > 500) {
    return { error: "cover_url is too long" };
  }

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

  const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

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

  const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "A valid book id is required" }, { status: 400 });
  }

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
      .from("books").update(fields).eq("id", id).select().maybeSingle();
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
      p_book_id: id,
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

  await logActivity(adminClient, user, "book_updated", id, {
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

  const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "A valid book id is required" }, { status: 400 });
  }

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