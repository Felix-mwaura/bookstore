import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";

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

/** A row shape safe to hand to client components (no server-only fields). */
export function toPublicBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    price: row.price,
    original_price: row.original_price ?? null,
    rating: row.rating ?? null,
    reviews: row.reviews ?? 0,
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
  return (data || []).map(toPublicBook);
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
  return toPublicBook(data);
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
    .order("rating", { ascending: false })
    .limit(limit);

  const related = (data || []).map(toPublicBook);
  if (related.length >= limit) return related;

  const { data: extra } = await supabase
    .from("books")
    .select("*")
    .eq("is_archived", false)
    .neq("id", book.id)
    .order("reviews", { ascending: false })
    .limit(limit);

  const seen = new Set(related.map((b) => b.id));
  for (const row of (extra || []).map(toPublicBook)) {
    if (related.length >= limit) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    related.push(row);
  }
  return related;
}

/** Real catalogue statistics — never invented marketing numbers. */
export async function getCatalogueStats() {
  const supabase = catalogueClient();
  const { data } = await supabase
    .from("books")
    .select("category, stock_quantity")
    .eq("is_archived", false);

  const rows = data || [];
  return {
    titles: rows.length,
    categories: new Set(rows.map((r) => r.category)).size,
    inStock: rows.filter((r) => (r.stock_quantity ?? 0) > 0).length,
  };
}
