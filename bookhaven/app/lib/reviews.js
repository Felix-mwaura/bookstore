import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";

// Reads for ratings and reviews.
//
// Everything here runs on the public (anon) connection, so it is subject to
// Row Level Security exactly like a signed-out visitor: only published rows
// come back, and `user_id` is not even readable (see the migration's
// column-level grants). Nothing in this module needs the service role.
//
// The column lists are explicit on purpose. `select *` on book_reviews is
// REFUSED for anon and authenticated, because `user_id` is not granted — a
// deliberate failure mode: forgetting to be careful here produces an error,
// not a leak.

function reviewsClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The only columns a browser is allowed to see on a review. */
export const PUBLIC_REVIEW_COLUMNS =
  "id, book_id, rating, title, review_text, reviewer_name, verified_purchase, is_published, created_at, updated_at";

// Limits and pure helpers live in ./review-limits so client components can
// import them without dragging the Supabase client into their bundle.
export {
  REVIEW_MIN_CHARS,
  REVIEW_MAX_CHARS,
  REVIEW_TITLE_MAX,
  REVIEWS_PER_PAGE,
  REVIEW_SORTS,
  isReviewSort,
  parseStars,
  parsePage,
  formatAverage,
  starPercent,
} from "./review-limits";

import { REVIEWS_PER_PAGE, parseStars } from "./review-limits";

/* ── card ratings ─────────────────────────────────────────────────────────
   One query for every book on the page, not one per book. Sixteen titles
   would otherwise be sixteen round-trips to render the homepage. */

/**
 * @param {Array<number|string>} bookIds
 * @returns {Promise<Map<number, { average: number, count: number }>>}
 */
export async function ratingSummariesFor(bookIds) {
  const ids = [...new Set((bookIds || []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return new Map();

  const supabase = reviewsClient();
  const { data, error } = await supabase
    .from("book_rating_summary")
    .select("book_id, average_rating, review_count")
    .in("book_id", ids);

  // A failed ratings lookup must not take the catalogue down with it: the
  // cards render without stars rather than the page throwing.
  if (error) return new Map();

  const map = new Map();
  for (const row of data || []) {
    map.set(Number(row.book_id), {
      average: Number(row.average_rating),
      count: Number(row.review_count),
    });
  }
  return map;
}

/** Attach `rating` / `reviews` to already-mapped public book objects. */
export async function attachRatings(books) {
  if (!books || books.length === 0) return books || [];
  const summaries = await ratingSummariesFor(books.map((b) => b.id));
  return books.map((book) => {
    const summary = summaries.get(Number(book.id));
    return {
      ...book,
      rating: summary ? summary.average : null,
      reviews: summary ? summary.count : 0,
    };
  });
}

/**
 * The signed-in customer's own review id for one book, or null.
 *
 * Used so the public list can label the customer's own row "Your review"
 * without exposing every review's `user_id` to the browser: the RPC returns
 * only the caller's row, and only their id is read here. Anonymous visitors
 * get null and the list renders exactly as before.
 */
export async function getViewerReviewId(bookId, client) {
  if (!client || !Number.isFinite(Number(bookId))) return null;
  const { data, error } = await client.rpc("my_book_review", { p_book_id: Number(bookId) });
  if (error) return null;
  const mine = Array.isArray(data) ? data[0] : data;
  return mine?.id ?? null;
}

/** Full summary for one book: average, count and the 5→1 distribution. */
export async function getBookRating(bookId) {
  const empty = {
    average: null,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  const supabase = reviewsClient();
  const { data, error } = await supabase
    .from("book_rating_summary")
    .select("book_id, average_rating, review_count, five, four, three, two, one")
    .eq("book_id", bookId)
    .maybeSingle();

  if (error || !data) return empty;

  return {
    average: Number(data.average_rating),
    count: Number(data.review_count),
    distribution: {
      5: Number(data.five) || 0,
      4: Number(data.four) || 0,
      3: Number(data.three) || 0,
      2: Number(data.two) || 0,
      1: Number(data.one) || 0,
    },
  };
}

/**
 * One page of published reviews for a book.
 *
 * Sorting, filtering and pagination all happen in the database. Nothing
 * fetches "all reviews and slice it in the browser".
 */
export async function getBookReviews({
  bookId,
  sort = "recent",
  stars = 0,
  page = 1,
  pageSize = REVIEWS_PER_PAGE,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;
  const supabase = reviewsClient();

  let query = supabase
    .from("book_reviews")
    .select(PUBLIC_REVIEW_COLUMNS, { count: "exact" })
    .eq("book_id", bookId)
    .eq("is_published", true);

  const starFilter = parseStars(stars);
  if (starFilter) query = query.eq("rating", starFilter);

  // `id` is the final tiebreaker on every sort. Without it, two reviews with
  // the same rating and the same timestamp have no defined order, so a row
  // posted between two page loads can slide across a page boundary and appear
  // twice or not at all. The id is unique and never changes, so the ordering
  // is stable for a given dataset.
  if (sort === "highest") {
    query = query
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else if (sort === "lowest") {
    query = query
      .order("rating", { ascending: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    return { reviews: [], total: 0, pages: 0, page: 1, error: true };
  }

  const total = count ?? (data || []).length;
  return {
    reviews: data || [],
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    page: currentPage,
    error: false,
  };
}
