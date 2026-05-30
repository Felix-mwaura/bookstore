import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  "https://luniopceavtkljywukyi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmlvcGNlYXZ0a2xqeXd1a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk1NTUsImV4cCI6MjA5NDc1NTU1NX0.zmZcxS2uxyon8Est9l3feYLuYy02hgcIpCNKAqKWtCE"
);

async function getUser(request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// GET /api/wishlist — fetch user's wishlist book IDs
export async function GET(request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wishlists")
    .select("book_id")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookIds: data.map((r) => r.book_id) });
}

// POST /api/wishlist — add a book
export async function POST(request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId } = await request.json();

  const { error } = await supabase
    .from("wishlists")
    .upsert({ user_id: user.id, book_id: bookId }, { onConflict: "user_id,book_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/wishlist — remove a book
export async function DELETE(request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId } = await request.json();

  const { error } = await supabase
    .from("wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", bookId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}