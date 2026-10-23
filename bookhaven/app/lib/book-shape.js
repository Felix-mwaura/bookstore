// The public shape of a book row.
//
// Pure and import-free: no Supabase client, no process.env. That makes it
// testable on its own (scripts/reviews-smoke.mjs) and safe to import from a
// client component without dragging server code into the bundle.

/**
 * A row shape safe to hand to client components (no server-only fields).
 *
 * `rating` and `reviews` are NOT copied from the row. Those columns contain
 * invented numbers in production — `rating` defaults to 4.5 and `reviews`
 * has been seeded with thousands of reviews nobody wrote. Real figures are
 * attached afterwards from book_rating_summary (see lib/reviews.js), so an
 * unmapped book honestly reads as "no rating yet".
 */
export function toPublicBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    price: row.price,
    original_price: row.original_price ?? null,
    rating: null,
    reviews: 0,
    category: row.category,
    format: row.format,
    isbn: row.isbn ?? null,
    badge: row.badge ?? null,
    stock: row.stock ?? null,
    stock_quantity: row.stock_quantity ?? 0,
    cover: row.cover ?? null,
    cover_url: row.cover_url ?? null,
    description: row.description ?? "",
    pages: row.pages ?? null,
    publisher: row.publisher ?? null,
    year: row.year ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}
