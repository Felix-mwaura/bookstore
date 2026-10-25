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

// Book URL helpers live in ./book-url so client components can import them
// without bundling the Supabase client.
export { slugifyTitle, bookSlug, bookPath, parseBookSlug } from "./book-url";

// The row→public mapping lives in ./book-shape so it can be unit-tested
// without the Supabase client (Node ESM cannot resolve the extensionless
// import below).
export { toPublicBook } from "./book-shape";

/** Rows for the storefront: never archived, never the internal fields. */
export async function getStorefrontBooks(limit = 60) {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("is_archived", false)
    .order("id")
    .limit(limit);

  if (error) return [];
  return attachRatings((data || []).map(toPublicBook));
}

export async function getBookById(id) {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .eq("is_archived", false)
    .maybeSingle();

  if (error || !data) return null;
  const [book] = await attachRatings([toPublicBook(data)]);
  return book || null;
}

/** Other titles in the same category, falling back to popular picks. */
export async function getRelatedBooks(book, limit = 4) {
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select("*")
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
    .select("*")
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
export async function queryCatalogue({
  q = "",
  category = "",
  sort = "newest",
  price = "",
  availability = "",
  page = 1,
  pageSize = CATALOGUE_PAGE_SIZE,
} = {}) {
  const supabase = catalogueClient();
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;

  let query = supabase
    .from("books")
    .select("*", { count: "exact" })
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
export async function getCategoryCounts() {
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select("category")
    .eq("is_archived", false);

  const counts = new Map();
  for (const row of data || []) {
    counts.set(row.category, (counts.get(row.category) || 0) + 1);
  }
  return counts;
}
