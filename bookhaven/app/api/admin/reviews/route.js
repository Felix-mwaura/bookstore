import { NextResponse } from "next/server";

import { requireAdmin } from "../../../lib/admin-auth";
import { readJsonBody, isJsonObject, isUuid, ADMIN_BODY } from "../../../lib/request-guard";

// Review moderation.
//
// Reads and writes both go through requireAdmin(), which verifies the bearer
// token with the Auth server and re-reads profiles.role with the service
// client. Nothing here trusts a role, an email or an id that came from the
// browser.
//
// The service role is used deliberately: an administrator must be able to
// read and unpublish somebody else's review, which the customer-facing RLS
// policies rightly forbid. Every write is recorded in admin_activity_log,
// the same trail the rest of the dashboard uses.

const PAGE_SIZE = 25;

function logActivity(adminClient, user, action, reviewId, details) {
  return adminClient
    .from("admin_activity_log")
    .insert({
      admin_id: user.id,
      admin_email: user.email,
      action,
      target_type: "review",
      target_id: String(reviewId),
      details,
    })
    .then(({ error }) => {
      if (error) console.error("review activity log failed:", error.message);
    });
}

// GET /api/admin/reviews?status=all|published|hidden&stars=0-5&q=&page=
//
// One page at a time, joined to the book title. The filter is applied in the
// database (not in JavaScript over a full table) so this stays usable as the
// review count grows.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const url = new URL(request.url);

  const status = url.searchParams.get("status") || "all";
  const stars = Number(url.searchParams.get("stars")) || 0;
  const term = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = adminClient
    .from("book_reviews")
    .select(
      "id, book_id, user_id, rating, title, review_text, is_published, verified_purchase, reviewer_name, created_at, updated_at, books(title, author)",
      { count: "exact" }
    );

  if (status === "published") query = query.eq("is_published", true);
  if (status === "hidden") query = query.eq("is_published", false);
  if (stars >= 1 && stars <= 5) query = query.eq("rating", stars);

  // PostgREST cannot OR across a joined table, so a text search covers the
  // review itself and the reviewer. Searching by book title is handled by
  // resolving matching books first.
  if (term) {
    const safe = term.replace(/[,%()]/g, " ").trim();
    const { data: matchingBooks } = await adminClient
      .from("books")
      .select("id")
      .ilike("title", `%${safe}%`)
      .limit(50);
    const bookIds = (matchingBooks || []).map((b) => b.id);

    const ors = [`title.ilike.%${safe}%`, `review_text.ilike.%${safe}%`, `reviewer_name.ilike.%${safe}%`];
    if (bookIds.length > 0) ors.push(`book_id.in.(${bookIds.join(",")})`);
    query = query.or(ors.join(","));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error("GET /api/admin/reviews:", error.message);
    return NextResponse.json({ error: "Could not load reviews" }, { status: 500 });
  }

  // Summary metrics, computed from the whole table rather than the page.
  const [total, published, hidden] = await Promise.all([
    adminClient.from("book_reviews").select("id", { count: "exact", head: true }),
    adminClient.from("book_reviews").select("id", { count: "exact", head: true }).eq("is_published", true),
    adminClient.from("book_reviews").select("id", { count: "exact", head: true }).eq("is_published", false),
  ]);

  const totalCount = count ?? 0;

  return NextResponse.json(
    {
      reviews: (data || []).map((row) => ({
        id: row.id,
        book_id: row.book_id,
        book_title: row.books?.title || `Book #${row.book_id}`,
        book_author: row.books?.author || "",
        rating: row.rating,
        title: row.title,
        review_text: row.review_text,
        is_published: row.is_published,
        verified_purchase: row.verified_purchase,
        reviewer_name: row.reviewer_name,
        // The customer id is present for the admin API only, and the client
        // shows a short prefix rather than the whole identifier.
        reviewer_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      total: totalCount,
      pages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      page,
      counts: {
        all: total.count ?? 0,
        published: published.count ?? 0,
        hidden: hidden.count ?? 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// PATCH /api/admin/reviews — publish or hide a review.
//
// Deliberately does NOT allow editing rating or text. Rewriting a customer's
// words and presenting them as the customer's own is the one thing the
// brief forbids outright; moderation here is visibility only, plus removal.
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

  const { id, is_published: isPublished } = body;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "A valid review id is required" }, { status: 400 });
  }
  if (typeof isPublished !== "boolean") {
    return NextResponse.json({ error: "is_published must be true or false" }, { status: 400 });
  }

  const { data: existing, error: readError } = await adminClient
    .from("book_reviews")
    .select("id, book_id, is_published")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("PATCH /api/admin/reviews (read):", readError.message);
    return NextResponse.json({ error: "Could not load that review" }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const { data, error } = await adminClient
    .from("book_reviews")
    .update({ is_published: isPublished })
    .eq("id", id)
    .select("id, book_id, is_published")
    .single();

  if (error) {
    console.error("PATCH /api/admin/reviews:", error.message);
    return NextResponse.json({ error: "Could not update that review" }, { status: 500 });
  }

  await logActivity(
    adminClient,
    user,
    isPublished ? "review.published" : "review.hidden",
    id,
    { book_id: existing.book_id, was: existing.is_published }
  );

  return NextResponse.json({ review: data });
}

// DELETE /api/admin/reviews?id=… — remove a review that breaks the rules.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const id = new URL(request.url).searchParams.get("id");

  if (!isUuid(id)) {
    return NextResponse.json({ error: "A valid review id is required" }, { status: 400 });
  }

  const { data: existing, error: readError } = await adminClient
    .from("book_reviews")
    .select("id, book_id, rating, reviewer_name")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("DELETE /api/admin/reviews (read):", readError.message);
    return NextResponse.json({ error: "Could not load that review" }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const { error } = await adminClient.from("book_reviews").delete().eq("id", id);
  if (error) {
    console.error("DELETE /api/admin/reviews:", error.message);
    return NextResponse.json({ error: "Could not remove that review" }, { status: 500 });
  }

  await logActivity(adminClient, user, "review.deleted", id, {
    book_id: existing.book_id,
    rating: existing.rating,
    reviewer_name: existing.reviewer_name,
    // The text itself is not copied into the log: a removed review stays
    // removed, not archived somewhere else.
  });

  return NextResponse.json({ ok: true });
}

// POST is not a thing here. Keep the method honest rather than silent.
export async function POST() {
  return NextResponse.json(
    { error: "Use PATCH to publish or hide a review, or DELETE to remove one." },
    { status: 405, headers: { Allow: "GET, PATCH, DELETE" } }
  );
}
