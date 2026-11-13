import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";
import { attachRatings } from "./reviews";
import { toPublicBook } from "./book-shape";

// Catalogue reads are public (the `books` table has a read policy for
// everyone), so they run on a cookie-less anon client. That keeps the
// catalogue pages cacheable — a per-visitor cookie would force every request
// to be rendered from scratch.
function catalogueClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The columns a listing renders.
//
// `description` is deliberately absent: it is the one unbounded column on the
// table, no card reads it, and the detail page selects it itself. At today's
// 17 titles this saves about a kilobyte per shelf — nothing. It is here so
// that at 500 titles the listing does not start shipping every blurb to the
// browser and to the server render.
// `rating` and `reviews` are absent on purpose too: they hold invented
// numbers (see book-shape.js) and the real figures come from
// book_rating_summary.
export const LISTING_COLUMNS =
  "id, title, author, price, original_price, category, format, isbn, badge, " +
  "is_featured, stock, stock_quantity, cover, cover_url, pages, publisher, year, tags";

// ── caching ────────────────────────────────────────────────────────────
//
// Everything cached here is PUBLIC catalogue data: rows any signed-out
// visitor can read. Nothing customer-scoped — no cart, no account, no order,
// no payment state — passes through unstable_cache, and the clients below are
// cookie-less anon clients, so a cached result can never be someone else's.
//
// 60 seconds matches the homepage's own `revalidate`, so the shelf a visitor
// sees on /books is no staler than the one on /. It is what turns a repeat
// navigation from "two round trips to another continent" into "no round trips
// at all" — the database disappears from the critical path.
//
// `revalidateTag("catalogue")` clears it immediately when the admin changes a
// book, so the 60 seconds is a ceiling, not a delay in practice.
export const CATALOGUE_CACHE_TAG = "catalogue";
const CATALOGUE_REVALIDATE_SECONDS = 60;

// Book URL helpers live in ./book-url so client components can import them
// without bundling the Supabase client.
export { slugifyTitle, bookSlug, bookPath, parseBookSlug } from "./book-url";

// The row→public mapping lives in ./book-shape so it can be unit-tested
// without the Supabase client (Node ESM cannot resolve the extensionless
// import below).
export { toPublicBook } from "./book-shape";

/** Rows for the storefront: never archived, never the internal fields. */
async function readStorefrontBooks(limit = 60) {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from("books")
    .select(LISTING_COLUMNS)
    .eq("is_archived", false)
    .order("id")
    .limit(limit);

  if (error) return [];
  return attachRatings((data || []).map(toPublicBook));
}

export const getStorefrontBooks = unstable_cache(
  readStorefrontBooks,
  ["storefront-books"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_CACHE_TAG] }
);

async function readBookById(id) {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .eq("is_archived", false)
    .maybeSingle();

  if (error || !data) return null;
  // No star ratings attached here, on purpose. The only caller is the book
  // page, and it reads the richer summary — average, count and the 1-to-5
  // distribution — from getBookRating(). Attaching them here meant querying
  // book_rating_summary twice for the same book, one round trip apart, with
  // the first result thrown away.
  return toPublicBook(data);
}

export const getBookById = unstable_cache(
  readBookById,
  ["book-by-id"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_CACHE_TAG] }
);

/** Other titles in the same category, falling back to popular picks. */
async function readRelatedBooks(category, excludeId, limit) {
  const book = { category, id: excludeId };
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select(LISTING_COLUMNS)
    .eq("is_archived", false)
    .eq("category", book.category)
    .neq("id", book.id)
    // Featured first, then newest. This used to order by books.rating —
    // a column of invented numbers — so "related" was ranked by fiction.
    .order("is_featured", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const related = (data || []).map(toPublicBook);
  if (related.length >= limit) return related;

  const { data: extra } = await supabase
    .from("books")
    .select(LISTING_COLUMNS)
    .eq("is_archived", false)
    .neq("id", book.id)
    .order("is_featured", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const seen = new Set(related.map((b) => b.id));
  for (const row of (extra || []).map(toPublicBook)) {
    if (related.length >= limit) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    related.push(row);
  }
  return attachRatings(related);
}

export function getRelatedBooks(book, limit = 4) {
  return cachedRelatedBooks(book?.category || "", book?.id ?? 0, limit);
}

const cachedRelatedBooks = unstable_cache(
  readRelatedBooks,
  ["related-books"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_CACHE_TAG] }
);

/** Real catalogue statistics — never invented marketing numbers. */
export async function getCatalogueStats() {
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select("category, stock_quantity")
    .eq("is_archived", false);

  const rows = data || [];

  // Counts per genre. The homepage used to derive these from the first page
  // of books it had fetched, which quietly under-counted any genre whose
  // titles did not make that page. This query reads the whole shelf.
  const byCategory = {};
  for (const row of rows) {
    if (!row.category) continue;
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  }

  return {
    titles: rows.length,
    categories: new Set(rows.map((r) => r.category)).size,
    inStock: rows.filter((r) => (r.stock_quantity ?? 0) > 0).length,
    byCategory,
  };
}

/* ─────────────────────────────────────────────────────────────
   Catalogue queries for the storefront grid
   Everything is filtered in the database, not in the browser, so
   the HTML a crawler receives already matches the URL.
   ───────────────────────────────────────────────────────────── */

export const CATALOGUE_PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "title", label: "Title A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export const PRICE_BANDS = [
  { value: "under-1000", label: "Under KSh 1,000", min: 0, max: 999 },
  { value: "1000-2000", label: "KSh 1,000 – 2,000", min: 1000, max: 2000 },
  { value: "2000-3500", label: "KSh 2,000 – 3,500", min: 2001, max: 3500 },
  { value: "over-3500", label: "Over KSh 3,500", min: 3501, max: null },
];

export function isSort(value) {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function priceBand(value) {
  return PRICE_BANDS.find((band) => band.value === value) || null;
}

/**
 * @param {object} options
 * @param {string} [options.q]         free-text search across title and author
 * @param {string} [options.category]  exact category name
 * @param {string} [options.sort]      one of SORT_OPTIONS
 * @param {string} [options.price]     one of PRICE_BANDS
 * @param {string} [options.availability] "in-stock" to hide sold-out titles
 * @param {number} [options.page]      1-based page number
 */
async function readCataloguePage(q, category, sort, price, availability, page, pageSize) {
  const supabase = catalogueClient();
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;

  let query = supabase
    .from("books")
    .select(LISTING_COLUMNS, { count: "exact" })
    .eq("is_archived", false);

  const term = String(q || "").trim().replace(/[,%()]/g, " ").trim();
  if (term) {
    query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%`);
  }
  if (category) query = query.eq("category", category);
  if (availability === "in-stock") query = query.gt("stock_quantity", 0);

  const band = priceBand(price);
  if (band) {
    query = query.gte("price", band.min);
    if (band.max !== null) query = query.lte("price", band.max);
  }

  if (sort === "price-asc") query = query.order("price", { ascending: true });
  else if (sort === "price-desc") query = query.order("price", { ascending: false });
  else if (sort === "title") query = query.order("title", { ascending: true });
  else query = query.order("id", { ascending: false });

  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    return { books: [], total: 0, pages: 0, page: 1, error: true };
  }

  const total = count ?? (data || []).length;
  return {
    books: await attachRatings((data || []).map(toPublicBook)),
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    page: currentPage,
    error: false,
  };
}

/** Live category counts for the filter panel. */
async function readCategoryCounts() {
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select("category")
    .eq("is_archived", false);

  // A plain object, not a Map: this value goes through the cache, which
  // serialises its result. A Map would come back as an empty object and every
  // filter count would silently read zero. CatalogueControls already accepts
  // either shape, so the object is the one that survives the round trip.
  const counts = {};
  for (const row of data || []) {
    if (!row.category) continue;
    counts[row.category] = (counts[row.category] || 0) + 1;
  }
  return counts;
}

// The public catalogue, cached for a minute. Both functions take primitives so
// the cache key is exact: the same filters, sort and page always hit the same
// entry, and two different searches can never collide.
export function queryCatalogue({
  q = "",
  category = "",
  sort = "newest",
  price = "",
  availability = "",
  page = 1,
  pageSize = CATALOGUE_PAGE_SIZE,
} = {}) {
  return cachedCataloguePage(q, category, sort, price, availability, page, pageSize);
}

const cachedCataloguePage = unstable_cache(
  readCataloguePage,
  ["catalogue-page"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_CACHE_TAG] }
);

export const getCategoryCounts = unstable_cache(
  readCategoryCounts,
  ["category-counts"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_CACHE_TAG] }
);
