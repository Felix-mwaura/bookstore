#!/usr/bin/env node
// Homepage test.
//
//   node scripts/home-smoke.mjs            (needs no server)
//
// The homepage is the one page that has to sell the shop without telling a
// lie. Its sections are easy to get wrong in two directions: a section can be
// fed invented data (a "bestseller" the shop never measured, a discount that
// exists only in the markup), or it can quietly disappear when the real data
// it depends on is missing. Both are checked here, on the source and on the
// pure functions, because this environment has no browser.
//
// What a clean run does NOT mean: that the page looks right. Nothing here can
// see the layout.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const home = read("app/components/HomeClient.js");
const hero = read("app/components/HomeHero.js");
const bands = read("app/components/HomeBands.js");
const strip = read("app/components/CategoryStrip.js");
const row = read("app/components/ProductRow.js");

/* ── the page is composed, not hand-rolled ──────────────────────────── */

// HomeBands exports two components, so the page is checked against the names
// it actually renders rather than the file they live in.
for (const [label, tag] of [
  ["the hero", "HomeHero"],
  ["the shelves", "ProductRow"],
  ["the genre strip", "CategoryStrip"],
  ["the promo band", "PromoBanner"],
  ["the discovery band", "DiscoverySearch"],
]) {
  check(`the homepage renders ${label}`, new RegExp(`<${tag}[\\s/>]`).test(home));
}

/* ── every section is fed real data ─────────────────────────────────── */

// "New" is the newest ids. "Picked" is the admin's featured flag — not a
// sales ranking, which this app cannot measure and must not invent. "Offers"
// is a book whose original price is genuinely above its price.
check("new arrivals sort by newest id", /Number\(b\.id\) - Number\(a\.id\)/.test(home));
check("picks read the admin's featured flag", /books\.filter\(\(book\) => book\.is_featured\)/.test(home));
check(
  "offers require a real original price above the price",
  /book\.original_price && Number\(book\.original_price\) > Number\(book\.price\)/.test(home)
);
check(
  "the offers shelf only renders when there are offers",
  /\{offers\.length > 0 && \(/.test(home)
);
check("the featured flag comes from the row, not a guess", /is_featured: Boolean\(row\.is_featured\)/.test(read("app/lib/book-shape.js")));

// The word the shop has no data for.
check("nothing claims to be a bestseller", !/bestsell/i.test(home + hero + bands + strip + row));

/* ── genres come from the database list ─────────────────────────────── */

check("the strip is fed the live genre list", /<CategoryStrip genres=\{genres\}/.test(home));
check("that list is the provider's", /const genres = useGenres\(\)/.test(home));
check("each card links to its own category page", /href=\{`\/category\/\$\{genre\.slug\}`\}/.test(strip));
check("the count shown is the counted one", /counts\[genre\.name\] \|\| 0/.test(strip));
check(
  "a genre with no artwork gets a plain panel, not another genre's photo",
  /art && !broken \?/.test(strip) && /\{genre\.name\}\s*\n?\s*<\/span>/.test(strip)
);

/* ── the claims on the page are the shop's actual policy ────────────── */

check("the delivery figure is the shared constant", /DELIVERY_PERCENT/.test(hero) && /DELIVERY_PERCENT/.test(home));
check("no hard-coded delivery percentage in the copy", !/20% of the book total/.test(hero));

// Payment is named only when it is configured; otherwise the strip says cash
// on delivery. Both are real, and the branch is on the server's flag.
check(
  "payment claims follow the server's M-Pesa flag",
  /mpesaEnabled\s*\?\s*\{[\s\S]{0,200}Pay with M-Pesa/.test(home) && /Pay on delivery/.test(home)
);
check("the newsletter still refuses to collect without a contact address", /STORE_CONTACT\.reachable/.test(home));
check("contact details are still conditional", /STORE_CONTACT\.reachable/.test(home));

/* ── the hero is honest about its photograph ────────────────────────── */

check("the hero headline is the brief's", /Every great story/.test(hero) && /starts with a/.test(hero));
check("the hero supporting line is the brief's", /Discover stories, ideas and inspiration/.test(hero));
check("both hero actions exist", /Explore books/.test(hero) && /Browse categories/.test(hero));
check(
  "the hero image is the shop's own photograph",
  /src="\/genres\/fiction-1200\.webp"/.test(hero)
);
check("the hero image is above the fold and prioritised", /priority/.test(hero));
check(
  "the featured book uses the shared cover component, not a stand-in photo",
  /<BookCover book=\{cover\}/.test(hero)
);

/* ── navigation and search keep working ─────────────────────────────── */

check("the discovery search is a plain GET to the catalogue", /<form action="\/books" method="get" role="search"/.test(bands));
check("search keeps the query in the URL", /name="q"/.test(bands));
check("the genre chips are real links", /href=\{`\/category\/\$\{genre\.slug\}`\}/.test(bands));

/* ── shelves are real lists, and scroll by hand ─────────────────────── */

check("a shelf is an ordered list of books", /<ul[\s\S]{0,200}role="list"/.test(row));
check("a shelf scrolls horizontally", /overflow-x-auto/.test(row));
check("the scrollbar is hidden but the scroll remains", /scrollbar-none/.test(row));
check("the arrows are labelled buttons", /aria-label=\{`Scroll \$\{title\} backwards`\}/.test(row));
check("nothing advances on its own", !/setInterval|setTimeout/.test(row));
check("the shelf renders the shared card", /<ProductCard book=\{book\}/.test(row));
check("an empty shelf renders nothing at all", /if \(!books\?\.length\) return null;/.test(row));

/* ── motion is gated ────────────────────────────────────────────────── */

check("hover motion is disabled for reduced-motion readers", /motion-reduce:/.test(strip));
check("reveal markers are static attributes", !/data-reveal=\{/.test(home + row + strip));

/* ── report ─────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll homepage checks passed.");
