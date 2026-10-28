import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { readJsonObject, SMALL_BODY } from "../../../lib/request-guard";

const REASONS = [
  "restock",
  "correction",
  "damage",
  "return",
  "manual_adjustment",
];

// GET /api/admin/inventory?book_id=12 — stock movement history.
//
// Without a book_id it returns the latest movements across the catalogue,
// which is what the Inventory tab shows before anything is selected.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("book_id");

  let query = adminClient
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(bookId ? 100 : 50);

  if (bookId) {
    const id = Number(bookId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
    }
    query = query.eq("book_id", id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/admin/inventory:", error.message);
    return NextResponse.json(
      { error: "Could not load stock history" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { movements: data || [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// POST /api/admin/inventory — set a book's stock to an absolute quantity.
//
// An absolute target (rather than "+5") is what a shopkeeper actually knows
// after counting a shelf; the database stores the resulting delta and the
// reason, so the history explains every unit.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;

  const { book_id: bookId, quantity, reason, note } = body;

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json(
      { error: "Quantity must be a whole number, 0 or more" },
      { status: 400 }
    );
  }
  if (!REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `Reason must be one of: ${REASONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof note !== "string" || note.trim().length < 3) {
    return NextResponse.json(
      { error: "Add a short note explaining the change" },
      { status: 400 }
    );
  }
  if (note.length > 300) {
    return NextResponse.json({ error: "Note is too long" }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("adjust_book_stock", {
    p_book_id: bookId,
    p_new_quantity: quantity,
    p_reason: reason,
    p_note: note.trim(),
    p_admin_id: user.id,
    p_admin_email: user.email,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("BOOK_NOT_FOUND")) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (msg.includes("NOTE_REQUIRED")) {
      return NextResponse.json(
        { error: "Add a short note explaining the change" },
        { status: 400 }
      );
    }
    if (msg.includes("INVALID_REASON")) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }
    console.error("POST /api/admin/inventory:", msg);
    return NextResponse.json(
      { error: "Could not update stock" },
      { status: 500 }
    );
  }

  return NextResponse.json({ book: data });
}
