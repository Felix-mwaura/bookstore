// Validation for the admin book form.
//
// Lives here rather than inside the route so it can be unit-tested without a
// Next.js request context. The route still owns the auth check and the
// database calls; this module only decides which fields may be written and
// what shape they must have.
//
// Whitelisting is the first line of defence: `rating`, `reviews`, `stock`
// (the text label a trigger derives) and `created_at` can never be set from
// the browser, so a "PATCH my own book" request cannot invent a rating or a
// review count.

import { SUPABASE_URL } from "./supabase-config.js";

// Only these columns can ever be written from the browser — blocks
// mass-assignment of things like rating/reviews/created_at, and `stock`
// (the text label), which a DB trigger derives from stock_quantity.
const ALLOWED = [
  "title","author","isbn","description","price","original_price","category",
  "format","badge","stock_quantity","low_stock_threshold","is_featured",
  "is_archived","pages","publisher","year","cover","cover_url",
];

// Longest accepted value per free-text column (see sanitize()).
export const MAX_TEXT_LENGTH = {
  title: 200,
  author: 120,
  isbn: 20,
  description: 5000,
  category: 60,
  format: 40,
  badge: 40,
  publisher: 120,
  cover_url: 2048,
};

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Must match the URL the browser client builds for getPublicUrl(), including
// the env fallback — otherwise every upload would be rejected as "not ours".
export function coverPrefix() {
  return `${SUPABASE_URL}/storage/v1/object/public/book-covers/`;
}

// Returns { data } with only whitelisted, validated fields, or { error }.
export function sanitize(body, { partial }) {
  const data = {};
  for (const k of ALLOWED) if (body[k] !== undefined) data[k] = body[k];

  const required = ["title", "author", "price", "category", "stock_quantity"];
  if (!partial) for (const k of required) {
    if (data[k] === undefined || data[k] === null || data[k] === "") return { error: `${k} is required` };
  }

  if ("title" in data && (typeof data.title !== "string" || !data.title.trim())) return { error: "title must not be empty" };
  if ("author" in data && (typeof data.author !== "string" || !data.author.trim())) return { error: "author must not be empty" };
  if ("price" in data && (!isNum(data.price) || data.price < 0)) return { error: "price must be a number, 0 or more" };
  if ("original_price" in data && data.original_price !== null && (!isNum(data.original_price) || data.original_price < 0)) return { error: "original_price must be 0 or more" };
  if ("stock_quantity" in data && (!isInt(data.stock_quantity) || data.stock_quantity < 0)) return { error: "stock_quantity must be a whole number, 0 or more" };
  if ("low_stock_threshold" in data && (!isInt(data.low_stock_threshold) || data.low_stock_threshold < 1)) return { error: "low_stock_threshold must be a whole number, 1 or more" };
  if ("pages" in data && data.pages !== null && (!isInt(data.pages) || data.pages < 0)) return { error: "pages must be a whole number" };
  if ("year" in data && data.year !== null && (!isInt(data.year) || data.year < 1000 || data.year > new Date().getFullYear() + 1)) return { error: "year is not valid" };
  if ("cover_url" in data && data.cover_url !== null) {
    // Only images in OUR bucket — never an arbitrary external URL.
    if (typeof data.cover_url !== "string" || !data.cover_url.startsWith(coverPrefix())) return { error: "cover_url must point to the book-covers storage bucket" };
  }
  // Length ceilings. A 2 MB title is not a book; it is an unbounded string
  // that ends up in the storefront, in JSON-LD, in confirmation emails and in
  // the admin table. The caps are generous enough for real catalogue data
  // (the longest description in the live catalogue is under 1,000 chars).
  for (const [key, max] of Object.entries(MAX_TEXT_LENGTH)) {
    if (!(key in data) || data[key] === null) continue;
    if (typeof data[key] !== "string") return { error: `${key} must be text` };
    if (data[key].length > max) return { error: `${key} must be ${max} characters or fewer` };
  }

  if (typeof data.title === "string") data.title = data.title.trim();
  if (typeof data.author === "string") data.author = data.author.trim();
  if (typeof data.category === "string") data.category = data.category.trim();
  if (typeof data.format === "string") data.format = data.format.trim();
  if (typeof data.badge === "string") data.badge = data.badge.trim();
  if (typeof data.publisher === "string") data.publisher = data.publisher.trim();
  if (typeof data.isbn === "string") data.isbn = data.isbn.trim();
  if (typeof data.cover_url === "string") data.cover_url = data.cover_url.trim();

  return { data };
}
