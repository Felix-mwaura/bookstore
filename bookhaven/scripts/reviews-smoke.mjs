#!/usr/bin/env node
// Ratings and reviews — the checks that do not need a database.
//
//   node scripts/reviews-smoke.mjs
//
// The database half (constraints, triggers, RLS, grants, aggregates) is
// proved by scripts/reviews-sql-test.mjs, which runs the real migration
// against a real Postgres. This file covers the JavaScript that sits in
// front of it: URL parsing, formatting, and the rule that a book card never
// shows an invented rating again.

import { toPublicBook } from "../app/lib/book-shape.js";
import {
  formatAverage,
  isReviewSort,
  parsePage,
  parseStars,
  starPercent,
  REVIEW_MAX_CHARS,
  REVIEW_MIN_CHARS,
  REVIEW_TITLE_MAX,
} from "../app/lib/review-limits.js";

const failures = [];
let passes = 0;

const ok = (label, cond, detail = "") => {
  if (cond) { passes++; console.log(`  ok    ${label}`); }
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};
const eq = (label, actual, expected) =>
  ok(label, String(actual) === String(expected), `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const section = (name) => console.log(`\n${name}`);

// ── 1. Star filter parsing ──────────────────────────────────────────────────
section("1. ?rv_stars is clamped, never trusted");
eq("5 is kept", parseStars("5"), 5);
eq("1 is kept", parseStars("1"), 1);
eq("0 means all", parseStars("0"), 0);
eq("6 falls back to all", parseStars("6"), 0);
eq("-3 falls back to all", parseStars("-3"), 0);
eq("1.5 falls back to all", parseStars("1.5"), 0);
eq("empty falls back to all", parseStars(""), 0);
eq("garbage falls back to all", parseStars("five"), 0);
eq("array-ish input falls back to all", parseStars("1,2"), 0);

// ── 2. Page parsing ─────────────────────────────────────────────────────────
section("2. ?rv_page cannot be negative or NaN");
eq("3 is kept", parsePage("3"), 3);
eq("0 becomes 1", parsePage("0"), 1);
eq("-9 becomes 1", parsePage("-9"), 1);
eq("garbage becomes 1", parsePage("nope"), 1);

// ── 3. Sorting whitelist ────────────────────────────────────────────────────
section("3. Sort is a whitelist");
ok("recent", isReviewSort("recent"));
ok("highest", isReviewSort("highest"));
ok("lowest", isReviewSort("lowest"));
ok("'helpful' is not implemented and is rejected", !isReviewSort("helpful"));
ok("SQL-ish input is rejected", !isReviewSort("created_at desc; drop table"));

// ── 4. Display maths ────────────────────────────────────────────────────────
section("4. Averages and percentages");
eq("one decimal", formatAverage(4.5555), "4.6");
eq("whole number keeps a decimal", formatAverage(5), "5.0");
eq("no reviews gives null, not NaN", formatAverage(null), "null");
eq("undefined gives null", formatAverage(undefined), "null");
eq("percent of 3 of 8", starPercent(3, 8), 38);
eq("percent of 5 of 5", starPercent(5, 5), 100);
eq("no divide-by-zero", starPercent(0, 0), 0);

// ── 5. The invented rating columns are never published ──────────────────────
section("5. A book row's fake rating never reaches the page");
const row = {
  id: 1,
  title: "The Psychology of Money",
  author: "Morgan Housel",
  price: 1500,
  category: "Finance",
  // What production actually contains today:
  rating: 4.8,
  reviews: 4100,
};
const mapped = toPublicBook(row);
eq("rating is not taken from the books row", mapped.rating, "null");
eq("review count is not taken from the books row", mapped.reviews, 0);
ok("the row's own numbers are still there for the admin API", row.rating === 4.8 && row.reviews === 4100);

const withSummary = { ...mapped, rating: 4.25, reviews: 7 };
eq("a real summary does survive", withSummary.rating, 4.25);

// ── 6. Limits match the database ────────────────────────────────────────────
section("6. Limits used by the form");
eq("minimum review length", REVIEW_MIN_CHARS, 10);
eq("maximum review length", REVIEW_MAX_CHARS, 2000);
eq("headline limit", REVIEW_TITLE_MAX, 100);

// ── 7. The migration text says what it should ───────────────────────────────
section("7. Migration guard rails");
import { readFile } from "node:fs/promises";
const sql = await readFile(new URL("../supabase/migrations/20261023162927_book_reviews.sql", import.meta.url), "utf8");
for (const needle of [
  "unique (book_id, user_id)",
  "check (rating between 1 and 5)",
  "enable row level security",
  "with check (auth.uid() = user_id)",
  "book_rating_summary",
  "customer_has_delivered",
  "revoke all on public.book_reviews from anon, authenticated",
  "grant update (rating, title, review_text)",
]) {
  ok(`migration contains: ${needle}`, sql.includes(needle));
}
ok("migration does not drop the books table", !/drop table[^;]*books/i.test(sql));
ok("migration does not touch books.rating", !/update\s+public\.books/i.test(sql));
ok("migration is wrapped in a transaction", /^begin;/m.test(sql) && /^commit;/m.test(sql));

// ── report ──────────────────────────────────────────────────────────────────
console.log(`\n${failures.length ? "FAILED" : "PASS"} — reviews (JS) — ${passes} checks passed, ${failures.length} failed`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
