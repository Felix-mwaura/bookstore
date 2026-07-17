import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";

// GET /api/admin/books — fetch all books
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

  const { adminClient } = auth;
  const body = await request.json();

  const { data, error } = await adminClient
    .from("books")
    .insert({ ...body, rating: 4.5, reviews: 0, tags: [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ book: data });
}

// PATCH /api/admin/books — update a book
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { id, ...updates } = await request.json();

  const { data, error } = await adminClient
    .from("books")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ book: data });
}

// DELETE /api/admin/books — delete a book
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { id } = await request.json();

  const { error } = await adminClient.from("books").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}