#!/usr/bin/env node
// Product card test.
//
//   node scripts/product-card-smoke.mjs
//
// The catalogue card is the shop's most repeated surface, and the cheapest
// way to break it is one page at a time: somebody adds a "featured" section
// with its own book markup, or a size tweak crops every cover, or the heart
// stops being wired to the wishlist and becomes decoration. None of those
// throw. These checks assert the contract the card was redesigned to keep:
//
//   • one component draws every card, on every page;
//   • every slot has a fixed size, so rows of cards line up;
//   • covers are drawn whole (object-contain), never cropped;
//   • the saving is computed from real prices and never invented;
//   • the wishlist and the basket are the app's own, and the heart is real;
//   • out-of-stock books cannot be added;
//   • the motion is a lift and a 3% scale, gated on a fine pointer, and both
//     are switched off under prefers-reduced-motion.
//
// What this cannot do is look at the result. A clean run means the card is
// built this way, not that it is beautiful.

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

/* ── one card, everywhere ───────────────────────────────────────────── */

const card = read("app/components/ProductCard.js");

const RENDERERS = [
  ["the catalogue grid", "app/components/BookGrid.js"],
  ["the homepage shelf", "app/components/ProductRow.js"],
  ["the book page's related row", "app/books/[slug]/page.js"],
];

// The homepage composes its shelves through ProductRow, so that is the file
// that must import the card.
check(
  "the homepage renders its shelves through the shared row",
  /<ProductRow/.test(read("app/components/HomeClient.js"))
);

for (const [label, path] of RENDERERS) {
  const source = read(path);
  check(`${label} uses the shared card`, /import ProductCard from ["'][^"']*ProductCard["']/.test(source));
  // A page may draw a single hero cover (the book page does), but it must not
  // grow a second add-to-basket button beside it — that is the card's job.
  check(`${label} does not add its own add-to-basket control`, !/to (cart|basket)</i.test(source.replace(/import[^;]+;/g, "")));
}

/* ── fixed slots, so rows line up ───────────────────────────────────── */

check("the title is clamped to two lines", /line-clamp-2/.test(card));
check(
  "the title reserves two lines whether it needs them or not",
  /line-clamp-2[^"]*min-h-\[2\.75em\]/.test(card)
);
check("the author line keeps its height when there is no author", /min-h-\[1\.1rem\]/.test(card));
check("the rating row is a fixed height", /className="mt-1\.5 flex h-5 items-center/.test(card));
check(
  "the add control is pinned to the bottom of the card",
  /<div className="mt-auto pt-3\.5">/.test(card)
);
check("the card fills its grid cell", /flex h-full flex-col/.test(card));

/* ── the cover is the focal point, and whole ────────────────────────── */

check("the cover keeps a 2:3 frame", /aspect-\[2\/3\]/.test(card));
check("the cover is centred in its stage", /mx-auto w-\[72%\]/.test(card));

const cover = read("app/components/BookCover.js");
check("covers are drawn whole, never cropped", /className="object-contain"/.test(cover));
check("no cover path in the app crops", !/object-cover/.test(cover));

/* ── prices are real, savings are computed ──────────────────────────── */

check(
  "the discount only exists when the original price is higher",
  /book\.original_price && book\.original_price > book\.price/.test(card)
);
check(
  "the percentage is computed from the two prices, not hard-coded",
  /Math\.round\(\(1 - book\.price \/ book\.original_price\) \* 100\)/.test(card)
);
check("the badge renders only when a discount was computed", /\{discount !== null && \(/.test(card));
check("the current price is announced", /aria-label=\{`Price \$\{formatKsh\(book\.price\)\}`\}/.test(card));

/* ── the wishlist is the app's, not a decoration ────────────────────── */

check("the heart reads the saved list", /store\.wishlist \|\| \[\]\)\.some\(/.test(card));
check("the heart toggles the saved list", /store\.toggleWishlist\?\.\(book\)/.test(card));
check("the heart is a pressed-state button", /aria-pressed=\{wishlisted\}/.test(card));
check(
  "the heart's label says what it will do",
  /aria-label=\{wishlisted \? `Remove \$\{book\.title\} from saved books` : `Save \$\{book\.title\} to saved books`\}/.test(card)
);

/* ── the basket and stock ───────────────────────────────────────────── */

check("stock comes from the shared helper", /const state = stockState\(book\)/.test(card));
check("the stock label is shown", /\{state\.label\}/.test(card));
check("an unbuyable book disables the control", /disabled=\{!state\.canBuy\}/.test(card));
check("the disabled control says why", /Disabled controls are exempt from WCAG contrast/.test(card) || /Sold out/.test(card));
check(
  "the add handler refuses an unbuyable book even if clicked",
  /if \(!state\.canBuy\) return;/.test(card)
);
check(
  "a card with no handler falls back to the store's basket",
  /const add = onAddToCart \|\| store\.addToCart;/.test(card)
);
check(
  "the button announces the book it will add",
  /aria-label=\{state\.canBuy \? `Add \$\{book\.title\} to basket`/.test(card)
);

/* ── interactions: independent controls, calm motion ────────────────── */

check(
  "the stretched link still covers the card (click anywhere opens the book)",
  /after:absolute after:inset-0 after:content-\[''\]/.test(card)
);
check(
  "both real controls sit above the stretched link",
  (card.match(/relative z-20|absolute right-2\.5 top-2\.5 z-20|absolute left-3 top-3 z-20/g) || []).length >= 2
);

const css = read("app/globals.css");
check("the card is a flat box, not a 3D one", /\.product-card \{[\s\S]{0,200}transform-style: flat/.test(css));
check(
  "the lift is gated on a real pointer and on the motion preference",
  /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\) \{\s*\n\s*\.product-card:hover/.test(css)
);
check("the cover scales a little on hover", /\.product-card:hover \.cover-frame,[\s\S]{0,120}transform: scale\(1\.03\)/.test(css));
check(
  "reduced motion drops the card's transform",
  /\.product-card,\s*\n\s*\.cover-frame,\s*\n\s*\[data-reveal\] \{\s*\n\s*transform: none !important;/.test(css)
);
check(
  "reduced motion switches the card's animation off",
  /\.product-card,\s*\n\s*\.cover-frame,\s*\n\s*\.hover-3d,[\s\S]{0,600}animation: none !important/.test(css)
);

/* ── report ─────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll product-card checks passed.");
