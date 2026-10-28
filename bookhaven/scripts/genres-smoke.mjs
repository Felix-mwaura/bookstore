#!/usr/bin/env node
// Genres test.
//
//   node scripts/genres-smoke.mjs
//
// Genres used to be an array in the bundle. They are rows now, which means
// three things can go wrong that a type-checker would not notice:
//
//   • the storefront renders nothing when the table is empty or unreachable
//     (the October preview bug, one layer down: navigation must not depend on
//     a query succeeding);
//   • a genre can be deleted while books still point at it;
//   • a name can arrive that produces a duplicate shelf, an empty slug, or
//     the reserved "All".
//
// This checks the pure naming rules for real, and the invariants of the data
// path by reading the source — the same way motion-smoke.mjs checks rules it
// cannot see painted.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { planGenreName, genreSlug, MAX_GENRE_NAME } from "../app/lib/genre-admin.js";
import { categories, categorySlug } from "../app/lib/categories.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ── names ─────────────────────────────────────────────── */

check("trims and collapses spacing", planGenreName("  Self   Help  ")?.name === "Self Help");
check("produces a URL-safe slug", planGenreName("Art & Design")?.slug === "art-design");
check("accepts an ampersand and an apostrophe", planGenreName("Children's & YA").ok === true);
check(
  "explains why a name with no Latin letter cannot be a genre",
  planGenreName("الإدارة").ok === false && /Latin/.test(planGenreName("الإدارة").error)
);

check("rejects an empty name", planGenreName("   ").ok === false, planGenreName("   ").error);
check("rejects a non-string", planGenreName(42).ok === false);
check("rejects the reserved word All", planGenreName("All").ok === false, planGenreName("All").error);
check("rejects All in another case", planGenreName("ALL").ok === false);

check(
  `rejects names over ${MAX_GENRE_NAME} characters`,
  planGenreName("x".repeat(MAX_GENRE_NAME + 1)).ok === false
);
check("accepts a name at the limit", planGenreName("x".repeat(MAX_GENRE_NAME)).ok === true);

for (const bad of ["<script>", "Self/Help", "A\"B", "100% Hip-Hop"]) {
  check(`rejects ${JSON.stringify(bad)}`, planGenreName(bad).ok === false);
}

// The eight genres the shop launched with must keep the addresses they
// already have: /category/self-help is indexed. genreSlug is the newer rule,
// so it has to agree with the old one on every name that existed before it.
for (const name of categories.filter((c) => c !== "All")) {
  check(`keeps the existing address for ${name}`, genreSlug(name) === categorySlug(name), genreSlug(name));
}

check("a slug never ends in a hyphen", planGenreName("History - ").slug === "history");

/* ── the read path cannot take the shop down ───────────── */

const genresData = read("app/lib/genres-data.js");
check("the genre reader falls back instead of throwing", /catch\s*\(/.test(genresData));
check("the genre reader returns the built-in list on failure", /fallback\(\)/.test(genresData));
check("reads time out rather than hanging a page", /AbortSignal\.timeout/.test(genresData));
check("a failed read is not retried on every request", /RETRY_AFTER_FAILURE_MS/.test(genresData));
check("an empty table is treated as a failure, not as 'no genres'", /rows\.length === 0/.test(genresData));

const layout = read("app/layout.js");
check("the layout provides genres to the whole tree", /<GenreProvider genres=\{genres\}>/.test(layout));
check("the layout awaits the reader", /await getGenres\(\)/.test(layout));

const provider = read("app/components/GenreProvider.js");
check("the provider defaults to a non-empty list", /createContext\(FALLBACK\)/.test(provider));
check("an empty array is not accepted as the value", /genres\.length > 0 \? genres : FALLBACK/.test(provider));

const home = read("app/components/HomeClient.js");
check("the homepage deck reads genres from the provider", /useGenres\(\)/.test(home));
check("the homepage no longer imports the frozen list", !/import \{ categories \}/.test(home));

const header = read("app/components/StoreHeader.js");
check("the header nav reads genres from the provider", /useGenres\(\)/.test(header));

const categoryPage = read("app/category/[slug]/page.js");
check("category pages resolve the slug against the database", /findGenre\(await getGenres\(\), slug\)/.test(categoryPage));
check("an unknown slug is still a 404", /if \(!genre\) notFound\(\)/.test(categoryPage));

/* ── the deck's clicks ─────────────────────────────────── */

const carousel = read("app/components/GenreCarousel.js");
check(
  "a press on the arrows or dots never arms a swipe",
  /closest\?\.\("\.genre-controls"\)/.test(carousel)
);
check("a new press clears the previous gesture's suppression", /suppressClick\.current = false;/.test(carousel));
check("there is no zero-delay timer deciding whether a tap counts", !/resetTimer/.test(carousel));
check("the deck clamps its index to the list", /Math\.min\(active, length - 1\)/.test(carousel));

/* ── the write path ────────────────────────────────────── */

const route = read("app/api/admin/genres/route.js");
for (const method of ["GET", "POST", "DELETE"]) {
  const body = route.split(`export async function ${method}`)[1] || "";
  check(`${method} checks for an admin first`, body.slice(0, 400).includes("requireAdmin(request)"));
}
check("the route rejects duplicate names with 409", /status: 409/.test(route));
check("the route refuses to delete a genre that has books", /used > 0/.test(route));
check("the route logs genre changes", /target_type: "genre"/.test(route));

const admin = read("app/admin/admin-client.js");
check("the dashboard has a Genres tab", /id:"genres", label:"Genres"/.test(admin));
check("the tab is rendered", /activeTab==="genres"&&<GenresTab/.test(admin));
check("the book form asks the database for genres", /fetch\("\/api\/admin\/genres"/.test(admin));
check("the book form still has a list before that resolves", /BUILT_IN_GENRES\.filter/.test(admin));

const sql = read("supabase/migrations/20261028120000_genres.sql");
check("the migration is idempotent (table)", /create table if not exists public\.genres/.test(sql));
check("the migration is idempotent (seed)", /on conflict do nothing/.test(sql));
check("the migration is idempotent (policy)", /drop policy if exists "genres are readable by everyone"/.test(sql));
check("case-insensitive uniqueness", /unique index if not exists genres_name_key on public\.genres \(lower\(btrim\(name\)\)\)/.test(sql));
check("RLS is on", /alter table public\.genres enable row level security/.test(sql));
check("only the service role may write", /revoke all on public\.genres from anon, authenticated/.test(sql) && !/for insert|for update|for delete/.test(sql));
check("the database refuses to orphan books", /create trigger genres_refuse_delete_when_used/.test(sql));
check("existing book categories are seeded", /from public\.books b/.test(sql));

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll genres checks passed.");
