#!/usr/bin/env node
// Owner-review test.
//
//   node scripts/owner-review-smoke.mjs
//
// Five defects came back from the owner as screenshots of the live shop. Each
// is a behaviour that no existing test covered, so each gets a check here:
//
//   1. the Add button painted over the price on a narrow card;
//   2. the category dropdown in the search bar did nothing until Enter;
//   3. the header showed three genres out of nine;
//   4. checkout asked for an email the shopper had already signed in with;
//   5. order history listed titles without their covers.
//
// Three of these are provable from source (2, 3 and the shape of 1 and 5).
// Two are data paths — the order email and the cover lookup — and those are
// checked by running the real functions rather than by grepping for the line
// that calls them. What this cannot do is look at the page: a clean run means
// the behaviour is in the shipped source, not that the card is beautiful.

import { readFileSync, existsSync } from "node:fs";
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

/* ── 1. price and Add button cannot overlap ─────────────────────────── */

const card = read("app/components/ProductCard.js");

// The card was redesigned after this complaint: the add control now owns a
// full-width row of its own, so it cannot be painted over the digits at any
// price length. The checks below assert that separation, not the wrapping
// that used to paper over the overlap.
check(
  "the add control is full-width in its own block",
  /<div className="mt-auto pt-3\.5">[\s\S]{0,600}?h-11 w-full items-center justify-center/.test(card)
);
// No row may hold the price and the button side by side again.
check(
  "no row puts the price and the button on one line",
  !/justify-between[^"]*border-t border-line/.test(card)
);
// The price itself must not be a nowrap island wider than its column.
check(
  "the price line wraps internally (no single-line island)",
  /aria-label=\{`Price \$\{formatKsh\(book\.price\)\}`\}\s*\n?\s*className="flex flex-wrap/.test(card)
);
check(
  "the original price sits beside it without forcing a single line",
  /className="[^"]*flex flex-wrap items-baseline gap-x-2 gap-y-0\.5"/.test(card) &&
    /aria-label=\{`Was [^`]+`\}\s*\n?\s*className="flex flex-wrap/.test(card)
);
// Long action labels must stay whole.
check("the sold-out label does not break mid-word", /whitespace-nowrap">Sold out</.test(card));

/* ── 2. the category dropdown navigates on selection ────────────────── */

const header = read("app/components/StoreHeader.js");

check(
  "choosing a category pushes a /books URL",
  /const chooseCategory = \(value\) => \{[\s\S]{0,400}router\.push\(`\/books/.test(header)
);
check(
  "the select is wired to it, not to a submit-only handler",
  /onChange=\{\(e\) => chooseCategory\(e\.target\.value\)\}/.test(header)
);
check(
  "the dropdown value survives as a filter after navigating",
  /params\.set\("category", value\)/.test(header)
);
check(
  "the decorative arrow does not swallow the change event",
  !/pointer-events-none[^>]*>\s*<select/.test(header)
);

/* ── 3. every genre reaches the header ──────────────────────────────── */

check("the header reads the genre list from the provider", /useGenres\(\)/.test(header));
check(
  "genres are mapped into the nav, not hard-coded",
  /genres\.map\(\(genre\) => \{[\s\S]{0,300}href = `\/category\/\$\{genre\.slug\}`/.test(header)
);
// The regression was a fixed array of three names. Anything genre-shaped in
// NAV_LINKS is a genre that will one day be renamed in the admin and leave a
// dead link here.
const navBlock = header.slice(header.indexOf("const NAV_LINKS"), header.indexOf("];", header.indexOf("const NAV_LINKS")));
check("NAV_LINKS carries destinations only, no genre names", !/category\//.test(navBlock), navBlock.slice(0, 120));
check(
  "the genre strip can scroll when nine of them do not fit",
  /scrollbar-none[^"]*overflow-x-auto/.test(header) && /\.scrollbar-none/.test(read("app/globals.css"))
);
check(
  "the help link stays outside the scrolling list",
  /<\/ul>\s*\n\s*\{?\/?\*?[\s\S]{0,600}?href="\/help"/.test(header) &&
    header.indexOf('href="/help"') > header.indexOf("</ul>")
);

/* ── 4. checkout email is the account email ─────────────────────────── */

const checkout = read("app/checkout/page.js");

check("checkout tracks the signed-in address", /const \[accountEmail, setAccountEmail\] = useState\(""\)/.test(checkout));
check(
  "the field is read-only once an account address is known",
  /readOnly=\{Boolean\(accountEmail\)\}/.test(checkout)
);
check(
  "the read-only field explains itself to a screen reader",
  /hint=\{accountEmail \? "[^"]+" : undefined\}/.test(checkout)
);
check(
  "a signed-in address is prefilled when the form is still empty",
  /setDetails\(\(prev\) => \(\{ \.\.\.prev, email: prev\.email \|\| email \}\)\)/.test(checkout)
);
check("the session is re-checked on auth changes", /onAuthStateChange/.test(checkout));

const ordersRoute = read("app/api/orders/route.js");
check(
  "the server overwrites the submitted email with the JWT's",
  /if \(user\.email\) cleanDetails\.email = user\.email;/.test(ordersRoute)
);
// Order of operations: the pin has to run after the body is parsed and before
// anything is written, or the client value survives into the row.
check(
  "the pin runs before the order is created",
  ordersRoute.indexOf("cleanDetails.email = user.email") < ordersRoute.indexOf('rpc("place_order"')
);

/* ── 5. order history shows covers ──────────────────────────────────── */

const coversPath = "app/lib/order-covers.js";
check("the cover helper exists", existsSync(join(root, coversPath)));

const covers = read(coversPath);
check("covers are looked up by book id, not guessed from the title", /\.in\(\s*"id",/.test(covers));
check("the lookup is one query for the whole page", (covers.match(/\.from\("books"\)/g) || []).length === 1);
check("a failed lookup returns the orders unchanged", /catch[\s\S]{0,80}return orders/.test(covers));

// Run it. A stub client is enough: the function's contract is "merge what you
// find, keep what you have, never throw".
const { attachOrderItemCovers } = await import(join(root, coversPath));

const rows = [
  { id: "o1", items: [{ id: 7, title: "A", quantity: 1, price: 100 }, { id: 8, title: "B", quantity: 2, price: 200 }] },
  { id: "o2", items: [{ id: 7, title: "A", quantity: 1, price: 100 }] },
];
const stub = (rowsBack) => ({
  from: () => ({ select: () => ({ in: async () => ({ data: rowsBack, error: null }) }) }),
});

const merged = await attachOrderItemCovers(
  stub([{ id: 7, cover_url: "https://example.test/7.jpg", cover: null }]),
  rows
);
check("covers attach to every order that carries the book", merged[0].items[0].cover_url === "https://example.test/7.jpg" && merged[1].items[0].cover_url === "https://example.test/7.jpg");
check("a book with no cover is left as it was", merged[0].items[1].cover_url === undefined);
check("stored prices are not rewritten by a presentation helper", merged[0].items[1].price === 200);
check("the caller's array is not mutated in place", rows[0].items[0].cover_url === undefined);

const failed = await attachOrderItemCovers(
  { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "boom" } }) }) }) },
  rows
);
check("a failed lookup fails open (orders still render)", failed.length === 2 && failed[0].items.length === 2);

const empty = await attachOrderItemCovers(stub([]), [{ id: "o3", items: [] }]);
check("an order with no items does not query or throw", empty[0].items.length === 0);

const both = read("app/account/page.js");
const detail = read("app/orders/[id]/page.js");
check("the account list uses the helper", /attachOrderItemCovers\(/.test(both));
check("the account list renders a cover per item", /<BookCover book=\{item\}/.test(both));
check("the order detail page uses the helper", /attachOrderItemCovers\(/.test(detail));

/* ── report ─────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll owner-review checks passed.");
