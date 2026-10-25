import { NextResponse } from "next/server";
import { clientForToken, bearerToken } from "../../lib/server";
import { readJsonBody, isJsonObject, SMALL_BODY } from "../../lib/request-guard";

// The wishlist routes were broken: they built a plain anon client and never
// attached the caller's JWT, so every `.from("wishlists")` query ran as the
// `anon` role and `auth.uid() = user_id` matched nothing. Reads returned an
// empty list and writes were silently rejected. clientForToken() attaches
// the verified token so Row Level Security behaves as intended.

async function requireUser(request) {
  const token = bearerToken(request);
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const client = clientForToken(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  return { client, user };
}

function validBookId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  const { data, error: dbError } = await client
    .from("wishlists")
    .select("book_id")
    .eq("user_id", user.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ bookIds: (data || []).map((r) => r.book_id) });
}

export async function POST(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  const parsed = await readJsonBody(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const bookId = validBookId(body.bookId);
  if (!bookId) return NextResponse.json({ error: "A valid bookId is required" }, { status: 400 });

  const { error: dbError } = await client
    .from("wishlists")
    .upsert({ user_id: user.id, book_id: bookId }, { onConflict: "user_id,book_id" });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  const parsed = await readJsonBody(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const bookId = validBookId(body.bookId);
  if (!bookId) return NextResponse.json({ error: "A valid bookId is required" }, { status: 400 });

  const { error: dbError } = await client
    .from("wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", bookId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
