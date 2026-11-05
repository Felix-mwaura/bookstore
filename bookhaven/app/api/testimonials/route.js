import { NextResponse } from "next/server";

import { clientForToken, bearerToken } from "../../lib/server";
import { readJsonBody, SMALL_BODY } from "../../lib/request-guard";
import { checkRateLimit } from "../../lib/rate-limit";
import { logRouteError } from "../../lib/api-error";
import { validateTestimonial } from "../../lib/testimonials";

// POST /api/testimonials — leave a testimonial for the homepage.
//
// Every testimonial is written unpublished. Publishing is a decision the shop
// makes in /admin after reading the words, because the section carries the
// shop's name: a quote that appears by itself is an endorsement nobody checked.
//
// Signed-in only. The request carries the caller's own token, so the insert
// runs as that reader — the RLS policy checks `user_id = auth.uid()` and
// refuses a row that is already published. The id in the body is ignored; it
// comes from the verified token, never from the browser.
//
// A recommended book is optional. When one is sent, its title is read from the
// catalogue rather than taken from the request, so a quote cannot be made to
// attribute an invented book to a real reader.

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Please sign in to leave a testimonial." },
      { status: 401 }
    );
  }

  const client = clientForToken(token);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Please sign in again to leave a testimonial." }, { status: 401 });
  }

  const parsed = await readJsonBody(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body || {};

  // Same speed bump as the newsletter: a field only a bot fills in.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true, pending: true });
  }

  const checked = validateTestimonial({
    authorName: body.authorName,
    body: body.body,
    rating: body.rating,
  });
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = await checkRateLimit({ scope: "testimonial", identifier: `${user.id}:${ip}` });
  if (limit.limited) {
    return NextResponse.json(
      { error: "That is a few testimonials in a short time. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds || 60) } }
    );
  }

  // Optional recommendation. The id must point at a real, unarchived book.
  let bookId = null;
  let bookTitle = null;
  if (body.bookId !== undefined && body.bookId !== null && body.bookId !== "") {
    const id = Number(body.bookId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "That book could not be found." }, { status: 400 });
    }
    const { data: book, error: bookError } = await client
      .from("books")
      .select("id, title, is_archived")
      .eq("id", id)
      .maybeSingle();

    if (bookError) {
      logRouteError("POST /api/testimonials (book lookup)", bookError);
      return NextResponse.json({ error: "We could not check that book. Please try again." }, { status: 500 });
    }
    if (!book || book.is_archived) {
      return NextResponse.json({ error: "That book could not be found." }, { status: 404 });
    }
    bookId = book.id;
    bookTitle = book.title;
  }

  const { data: inserted, error: insertError } = await client
    .from("testimonials")
    .insert({
      user_id: user.id,
      author_name: checked.value.author_name,
      body: checked.value.body,
      rating: checked.value.rating,
      book_id: bookId,
      book_title: bookTitle,
      is_published: false,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // 23505 = unique violation: one testimonial per account.
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You have already left a testimonial. Please contact us if you would like it changed." },
        { status: 409 }
      );
    }
    // 42P01 = undefined_table: the migration has not been run on this project.
    if (insertError.code === "42P01") {
      return NextResponse.json(
        { error: "Testimonials are not open just yet. Please try again soon." },
        { status: 503 }
      );
    }
    logRouteError("POST /api/testimonials", insertError);
    return NextResponse.json({ error: "We could not save that. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pending: true,
    id: inserted?.id || null,
    message: "Thank you — your testimonial is with us for a read before it goes up.",
  });
}
