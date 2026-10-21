# Phase 3 — customer experience and launch readiness

Phase 2 made the shop operable. Phase 3 makes it buyable: a customer can now
find a book at a stable URL, check out with the basket they think they have,
and follow the order afterwards.

## 1. Book pages with real URLs (3.2, 3.6)

`/books/<title-slug>-<id>` is a server-rendered page per title:

- title, author, price, format, pages, publisher, year, ISBN and description
  come from the books table — nothing is written into the page by hand;
- stock is read from `stock_quantity`, so "In stock" / "Only N left" /
  "Out of stock" cannot disagree with what checkout will accept;
- `Book` + `BreadcrumbList` JSON-LD, canonical URL, Open Graph and Twitter
  metadata, all derived from the row;
- related titles from the same category, then popular fallbacks;
- the trailing id makes the URL stable. Renaming a title later still resolves
  the old URL and 308-redirects to the new one, so shared links never 404.

Listing pages now link their titles to these pages instead of only opening a
modal, which is what makes the catalogue crawlable at all.

The homepage was a pure client component that shipped an empty shelf to every
crawler. It is now a server component: the catalogue, hero covers and counts
are in the initial HTML, and the client component takes over for the cart,
filters and realtime updates.

## 2. Order tracking (3.5)

`/orders/<id>` shows one order: reference, date, items with covers and unit
prices, subtotal/delivery/total, payment method and M-Pesa receipt, courier and
tracking number, delivery address and instructions, and a five-step progress
timeline.

Authorisation is the RLS policy, not the page. The query runs with the
customer's own JWT, so another customer's order id returns no row and the page
renders a 404 — the response does not confirm that the order exists. Anonymous
visitors are redirected to `/login?next=/orders/<id>` and returned there after
signing in.

The account page now shows both badges (fulfilment and payment), a real
`BH-XXXXXXXX` reference derived from the order id, and a link into the detail
page. Its "Total spent" figure counts paid, non-cancelled orders only — it
previously summed every order ever placed, including unpaid cash-on-delivery
baskets.

## 3. Checkout correctness (3.3)

- **Sign-in happens before payment.** The old flow let a signed-out customer
  fill in details, pay through M-Pesa, and only then discover an account was
  required — the worst possible moment. The checkout now stops at the door
  with the basket intact and a link back.
- **The basket is reconciled against the catalogue on load.** Prices are
  refreshed, quantities clamped to available stock, sold-out and archived
  items removed — each with a sentence explaining what changed. Previously the
  page showed a total from days ago and only failed at submit.
- Quantities can be adjusted or removed on the review screen, and the edit is
  written back to the same storage key the cart drawer uses.
- Delivery maths reads `FREE_DELIVERY_THRESHOLD` / `STANDARD_DELIVERY_FEE`
  instead of repeating `3000`/`300` in three places. The server still prices
  the order; the UI now agrees with it.
- The invented `BH-XXXXX` reference (generated in the browser, never stored)
  is gone. Customers see the real order reference, or the M-Pesa checkout id
  if the order could not be saved.
- The cart caps quantities at `stock_quantity` and refuses to add a sold-out
  title, so the "add 40 copies of a book with 3 in stock" path no longer
  exists.

## 4. Search-engine visibility (3.6)

- `app/sitemap.js` — home, catalogue, the eight category pages and every live
  book, regenerated hourly. It degrades to the static routes if the database
  is unreachable rather than failing.
- `app/robots.js` — allows the shop, disallows `/admin`, `/account`,
  `/checkout`, `/orders/`, `/login`, `/api/`, and points at the sitemap.
- Root layout: `metadataBase`, Open Graph, Twitter card, `OnlineStore` and
  `WebSite` structured data, plus a skip-to-content link.
- Per-route titles and canonicals for `/books`, `/category/<slug>` and every
  book. The earlier attempt used a `title.template`, but a nested layout with a
  plain string title silently breaks the chain, so each page now returns a
  complete title.
- `NEXT_PUBLIC_SITE_URL` is the single place to set the canonical host. Until
  a domain exists it falls back to the production Vercel hostname, which is
  the real address of the shop — better for canonicals than a placeholder.

## 5. Claims the site could not support

The storefront carried content that was not true:

| Was | Now |
|---|---|
| Six named customer testimonials, "4.9/5 · 2,400+ readers" | "How it works" — three steps describing the actual flow |
| "2,000+ titles", "15K+ readers", "6+ years", founder story with named staff | Live counts from the books table, and a description of the shop's actual pricing and tracking |
| "Up to 40% Off Bestselling Titles" | The deepest real discount, calculated from `original_price` |
| "Free delivery in Nairobi over KSh 3,000" | The rule the server actually applies. Delivery is now free on every order, so this says exactly that |
| "30-day return policy" | "Order tracking" — a promise the product keeps |
| Newsletter: "You're in! Check your inbox soon" with no request made | Real insert into `newsletter_subscribers`, honest copy, duplicate-safe |
| 12 hard-coded books in `app/books.js` (unused, but a trap for anyone editing it) | Deleted |

The newsletter list is write-only from the public site: `anon` may insert, and
the absence of a SELECT policy means the addresses cannot be harvested through
PostgREST. Admins can read it via `is_admin()`.

## 6. Structure and hygiene

- `app/lib/site.js` — site identity, delivery constants, contact details.
- `app/lib/orders.js` — one vocabulary for fulfilment and payment states,
  shared by the account page, order page and confirmation screen.
- `app/lib/book-url.js` — slug helpers with no dependencies, so client
  components don't pull the database client into their bundle.
- `app/lib/catalogue.js` — public catalogue reads on a cookie-less client, so
  they stay cacheable.
- `app/lib/supabase-server.js` — cookie-bound client for anything private.
- `app/components/StoreLayout.js` — the header/footer/drawers that used to be
  copy-pasted into each client page.
- `app/components/OrderView.js` — order presentation kept out of the data
  loading, so money and timeline logic exists once.
- `StoreContext.js` and `AppShell.js` were unreferenced duplicates of the cart
  logic; removed rather than left to drift.

## Verification performed

- Production build (`next build --webpack`): passes, 27 routes.
- ESLint: 0 errors, 16 warnings (pre-existing `no-img-element` and unused-var
  notes).
- `/books/the-psychology-of-money-2` → 200 with correct title, canonical, OG,
  `Book` JSON-LD, price, availability and stock label; `/books/2` → 308 to the
  canonical slug; unknown id → 404.
- `/sitemap.xml` includes book URLs when the catalogue is reachable;
  `/robots.txt` has the expected rules.
- Order page rendered from fixtures for three states (paid + dispatched,
  cancelled + refunded, COD pending): reference, timeline, courier, tracking
  and payment blocks all present.
- Anonymous `/orders/<id>` → 307 to `/login?next=…`.
- Newsletter insert as the `anon` role succeeds and the same role reads back
  zero rows.
- Homepage HTML contains real book titles and live counts.

**Not verified:** a signed-in end-to-end purchase (no test account password
available in this environment), and Google Search Console submission, which
requires the owner's account.

## Configuration required

1. `NEXT_PUBLIC_SITE_URL` — set it when a domain is purchased. Everything else
   derives from it.
2. Search Console: add the domain, verify by DNS, submit `/sitemap.xml`. This
   only makes the site *eligible* for indexing; it does not guarantee rankings
   and will not appear immediately.
3. `RESEND_API_KEY` (unchanged from Phase 2) — until it exists, the order pages
   are the customer's record, which is what the confirmation screen now says.

## Remaining defects and known gaps

- `/books` and `/category/<slug>` are still client-rendered listings: their
  pages contain the shell and links, with the grid arriving after hydration.
  Converting them means moving filter state into the URL; worth doing when
  search traffic justifies it.
- Images are plain `<img>` with `loading="lazy"`; moving to `next/image` needs
  `remotePatterns` for the Supabase storage host and would add build-time
  image optimisation.
- No branded 404 page yet (the default one is used).
- The storefront cart is per-page state persisted in localStorage rather than
  a context provider; it survives navigation and reloads, but a second tab
  only picks up changes when a component remounts.
