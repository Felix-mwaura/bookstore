# BookHaven — design research and implementation plan

**Status: research complete, plan awaiting your approval.**
Nothing in the redesign has been implemented yet. Two small defects were fixed
under the brief's "minor fixes without approval" rule — they are listed at the
end.

---

## 0. What I could and could not access

Being precise about this, because a design report is worthless if it hides where
the pictures came from.

| Source | Result |
| --- | --- |
| `pinterest.com/search/pins/?q=…` | **HTTP 403.** Not opened. |
| `pinterest.com/ideas/books-website-design/…` | **HTTP 403.** Not opened. |
| `ar.pinterest.com/akubeymachine/ui-bookstore/` | **HTTP 403.** Not opened. |
| `pinterest.com/pin/…` links found by search | **HTTP 403.** Not opened. |
| Search engines (Brave-backed) | Worked. Pins and source sites found via search results. |
| `webflow.com/list/bookstore` | Opened. |
| `readster-template.webflow.io` (home, /shop, /product) | Opened and read. |
| `edition-template.webflow.io` | Opened and read. |
| `dribbble.com/search/bookstore-website` | Search page opened; individual shots were not opened as pages. |
| Dribbble / Behance / 99designs shot images | Retrieved through image search and viewed as images. |

**So:** no Pinterest pin was opened and no Pinterest screenshot was captured. The
shortlist is built from Pinterest-adjacent material that I *could* verify — live
template demos, the Dribbble search surface, and design images — plus the
Pinterest pin URLs are recorded in §6 for you to open yourself. I have not
claimed a reference was inspected when it was only seen as an image.

I also cannot screenshot BookHaven itself: no headless browser can be installed
in this environment (Playwright download fails). Every judgement below about the
current site comes from reading its markup and CSS, not from looking at a render.
That limitation carries into the test plan in §7.

---

## 1. What BookHaven already does well (Phase 1 review)

Worth stating before proposing changes, because a lot of this should survive:

- **A real identity.** Cream paper, navy ink, sienna action colour, Playfair
  headings, Inter body. That is an independent-bookshop voice, not a generic
  Tailwind demo, and every colour pair is measured for contrast.
- **Honest product data.** Real shelf counts ("Only 3 left"), no invented
  ratings, no review counts, no fake urgency. Several of the references below
  sell with exactly the things we must not copy.
- **Server-rendered catalogue and book pages**, with metadata and JSON-LD.
- **A working, tested basket** (store context, caps, totals) and a three-step
  checkout with a sticky summary.
- **Admin: order pipeline, inventory, activity log, email queue**, all behind
  server-side role checks.

The gaps are composition and hierarchy, not foundations:

1. **Catalogue container width is inconsistent.** `/books` and `/category/*`
   used a 1400 px container while the header, footer and every other page use
   1280 px, so the grid sat ~60 px outside the header on a 1440 px screen.
   **Fixed** (see §8).
2. **Homepage sections all look the same.** Six stacked bands, each a heading
   plus a grid. There is no rhythm between quiet and dense, no eyebrow, no
   editorial moment.
3. **Genre tiles use emoji** where a photograph or a real cover would do the
   work; emoji also render inconsistently across Android and iOS.
4. **Product cards carry four competing lines** (category, title, author, stock
   badge, price) at similar weight; the reference cards win by having one
   dominant element — the cover — and one quiet line beneath it.
5. **Twelve equal KPI tiles in the admin overview.** Money, order pipeline and
   inventory all shout at the same volume, and none of them is a link.
6. **Two admin tabs still overflow on a phone**: the activity log forced a
   nowrap email and timestamp onto one row. **Fixed** for the activity log (§8).
7. Loading / empty / error states exist but are plain grey blocks; the brief asks
   for them to be designed, not only present.

---

## 2. Evaluation criteria, applied honestly

Scoring 1–5 per criterion. "Suitability" is weighted towards: can a phone user
on a slow Kenyan connection still find, price and buy a book in three taps?

| # | Criterion | Readster | Edition | Vintage Books | Dribbble grid | Orders-admin |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Visual appeal | 5 | 5 | 5 | 4 | 4 |
| 2 | Bookstore suitability | 5 | 5 | 4 | 3 | n/a (admin) |
| 3 | Ease of navigation | 4 | 3 | 3 | 4 | 5 |
| 4 | Product discoverability | 4 | 3 | 2 | 3 | 5 |
| 5 | Mobile responsiveness | 4 | 3 | 4 | 4 | 3 |
| 6 | Accessibility / readability | 4 | 3 | 3 | 2 | 3 |
| 7 | Checkout UX shown | 3 | 3 | 1 | 3 | n/a |
| 8 | Performance | 4 | 2 (heavy motion) | 4 | 4 | 4 |
| 9 | Fits BookHaven's identity | 4 | 4 | 5 | 3 | 4 |
| 10 | Fits Next.js + Tailwind v4 | 4 | 4 | 4 | 5 | 5 |
| 11 | Maintainability | 4 | 4 | 4 | 4 | 4 |
| 12 | Right for a small MVP | 4 | 3 | 3 | 4 | 5 |

Readster and Edition lose points on 2/12 for the same reason: both sell with
content we do not have — star ratings, review photos, press quotes, "free
shipping" claims. Those blocks would have to become empty space or invented
content, and invented content is the one thing this project has consistently
refused.

---

## 3. The shortlist

### R1 — Readster (Webflow template, live demo)
- Live demo: <https://readster-template.webflow.io/> · shop: `/shop` · product: `/product/the-alchemist`
- Template listing (paid, $79): <https://webflow.com/templates/html/readster-book-website-template>
- **What I actually saw:** a two-cover hero with a category chip row; "Explore
  Categories" as large image tiles; a four-up "Popular Books" rail; a full-bleed
  free-shipping band; a "Featured Book of the Week" with a large cover, author
  and blurb; a twelve-card shop grid; a product page with cover left, price and
  quantity right, and the details as a definition list.
- **Adopt:** the cover-first card with one quiet meta line; generous section
  spacing; the "featured title" band (driven by a real book, not a mock).
- **Reject:** star ratings, review photos, the free-shipping band (we have a
  delivery threshold, but it belongs in the header and basket, not a full-bleed
  claim), and the paid template's code — inspiration only.
- **Weakness for us:** its cards show no stock and no format, which is exactly
  the information a pay-on-delivery customer needs.

### R2 — Edition (Webflow ecommerce template, live demo)
- Demo: <https://edition-template.webflow.io/>
- **What I saw:** a floating wall of covers behind a large serif headline, cover
  mosaics between sections, featured titles with author and category chip.
- **Adopt:** the wall-of-covers idea at *small scale* (3–5 covers, the hero
  already does this); a category chip on the card; serif display type (we have it).
- **Reject:** the full mosaic (chaotic below 400 px), the parallax-ish motion,
  the lorem ipsum and the press quote — placeholder content that would have to
  be faked.
- **Weakness:** it is a demo store, not a shop optimised for one city and COD.

### R3 — Vintage Books concept (design image)
- Source page: <https://www.behance.net/search/projects/bookstore%20website> ·
  saved in the workspace as `design-refs/editorial-online-bookstore-website-homep-3.png`
- **What I saw:** warm sand ground, dark brown serif headline, a thin uppercase
  eyebrow with a rule ("— Collections"), a circular illustration, an arrow
  affordance for the next slide.
- **Adopt:** the eyebrow + Playfair headline rhythm; hairline rules instead of
  boxed borders; the arrow affordance on rails. This is the closest reference to
  BookHaven's own palette.
- **Reject:** it is a mood piece with no product, price, or buy affordance.
- **Status:** design inspiration image only, not a template; no code exists.

### R4 — Minimal product grid (Dribbble shot)
- Tag surface: <https://dribbble.com/tags/product-grid> · saved in the workspace as
  `design-refs/minimal-ecommerce-product-card-design-bo-2.webp`
- **What I saw:** an airy three-column grid; each product floats on white; a
  hairline separates the meta row; name left, price right; "Add to cart"
  appears as a pill on hover.
- **Adopt:** the hairline above the price row and the left/right alignment of
  name and price — the card reads in one glance.
- **Reject:** hover-only actions. Our traffic is phone-first; a button that
  appears on hover does not exist on touch. The current always-visible 44 px
  target must stay.
- **Weakness:** the small grey text in that shot is around 3:1 contrast — below
  AA. Ours must stay at muted/#5B6270 on white (5.7:1).

### R5 — Orders List (Dribbble e-commerce admin shot)
- Tag surface: <https://dribbble.com/tags/order-management> · saved in the workspace as
  `design-refs/ecommerce-admin-dashboard-orders-table-u-1.webp`
- **What I saw:** four counters across the top (Total / New / Completed /
  Cancelled), a filter row (search, status, date range, columns), then a table
  with status pills and a sidebar grouped into "Main Menu" and "Shop Management".
- **Adopt:** the *grouping* principle for our overview — money, pipeline,
  catalogue as three labelled bands instead of twelve equal tiles — and making
  each pipeline count a link into the filtered order list.
- **Reject:** four counters replacing revenue (a shop that only sees "new
  orders" cannot see whether it is making money), and the very small type.
- **Status:** inspiration only.

### Supporting references (found, not opened)
- Pinterest pin: "E-Commerce Admin Panel Dashboards UI Design" —
  <https://cl.pinterest.com/pin/579979258311813008/> (403)
- Pinterest pin: "Inventory Store Management Dashboard UI" —
  <https://au.pinterest.com/pin/inventory-store-management-dashboard-ui--356488126768206787/> (403)
- Pinterest board: "ui bookstore" — <https://ar.pinterest.com/akubeymachine/ui-bookstore/> (403)
- Pinterest topic: "Books website design" — <https://www.pinterest.com/ideas/books-website-design/907829676498/> (403)

These are listed because you asked for Pinterest specifically. I could not
verify their content, so nothing in the plan depends on them.

---

## 4. Recommended direction: "warm editorial shelf"

Not a new brand — a stricter use of the one you have.

- **Keep** cream / navy / sienna, Playfair + Inter, the 8 px control radius, the
  measured contrast pairs, and every honest-copy rule.
- **Borrow from R3 and R1:** an uppercase sienna eyebrow above each section
  heading, a hairline rule, and a single "action" link at the right of the rail
  instead of a second heading.
- **Borrow from R1 and R4:** one dominant element per card (the cover), then one
  quiet line (author + format), then the price row on a hairline. Stock stays —
  it answers a real question — but as a small dot + word, not a pill competing
  with the price.
- **Borrow from R5:** the dashboard reads in bands — *Today's work* (pipeline
  counts, each a link), *Money* (revenue, AOV, awaiting payment), *Catalogue*
  (titles, low stock, out of stock). Twelve tiles become three groups of three
  or four.
- **Reject everywhere:** carousels, hover-only controls, invented reviews,
  countdown timers, gradients, glass. The 3D hover from the last task stays but
  gets quieter (it is already reduced-motion aware).

What this is **not**: a rebuild. No new dependency, no TypeScript, no framework
change, no touch to auth, RLS, order creation or payment code.

---

## 5. Implementation plan (six increments)

Each increment is independently shippable and testable. I would do 1–2 first and
show you the result before continuing.

**1 · Section rhythm (storefront)** — new `SectionHeading` component (eyebrow,
title, action link, hairline); apply to the six homepage bands; unify the
container width so every page aligns to the header.
Files: `app/components/SectionHeading.js` (new), `app/components/HomeClient.js`,
`app/globals.css`.

**2 · Genre tiles and the hero** — replace emoji tiles with a small cluster of
real covers from that genre (pulled from the books already fetched — no new
content, no invented imagery); tighten the hero to one headline, one sentence,
two actions and the cover cluster.
Files: `app/components/HomeClient.js`, `app/components/BookCover.js` (sizes only).

**3 · Product cards and the catalogue toolbar** — hairline above the price row,
name left / price right, format line, stock reduced to dot + word, discount badge
kept on the cover; filter row becomes one line on desktop and a single sheet on
mobile.
Files: `app/components/ProductCard.js`, `app/components/CatalogueControls.js`,
`app/books/page.js`, `app/category/[slug]/page.js`.

**4 · Book page and basket** — two-column with a sticky buy panel on desktop;
details as a quiet definition list; drawer line items at 48 px covers with the
existing free-delivery bar; empty basket with a real path back to the shelf.
Files: `app/books/[slug]/page.js`, `app/components/BuyBar.js`,
`app/components/StoreShell.js`.

**5 · Admin** — three labelled bands and clickable pipeline counts on the
overview; a "needs action" list (awaiting processing / low stock); consistent
status vocabulary; activity-log and email-queue mobile lists.
Files: `app/admin/admin-client.js`.

**6 · States and polish** — designed empty / loading / error states for
catalogue, basket, orders and inventory; 320 → 1920 px pass; focus order;
contrast re-measure; reduced-motion re-check.
Files: several, small diffs.

**Verification for every increment:** `npx eslint .` (must stay at 0 errors),
`npx next build`, `node scripts/smoke.mjs` against a local `next start`, plus
`cart:smoke`, `price:smoke`, `store:wiring`. Then a device check by you — I
cannot drive a browser here, so I will not claim a visual pass I did not do.

---

## 6. Pinterest links to open yourself

If you want the Pinterest material specifically, these are the pins/pages the
search engine returned. They will load in your browser even though they refuse
this sandbox:

1. <https://www.pinterest.com/ideas/books-website-design/907829676498/>
2. <https://ar.pinterest.com/akubeymachine/ui-bookstore/>
3. <https://cl.pinterest.com/pin/579979258311813008/>
4. <https://au.pinterest.com/pin/inventory-store-management-dashboard-ui--356488126768206787/>
5. <https://www.pinterest.com/pin/579979258311813008/> (same pin, global domain)

If one of them shows you something you prefer over the shortlist, send me a
screenshot and I will fold it into the plan.

---

## 7. What is still unverified

- No browser render of BookHaven, desktop or mobile. The 320 px claims in the
  plan come from reading Tailwind classes, not from looking.
- No screen-reader run, no automated axe pass.
- The references were judged from live text, images and page structure — not
  from interacting with their demos.
- Nothing was copied from any template; no licence was needed because no code
  or asset was reused.

---

## 8. Fixed in this pass (no approval needed)

1. **Container mismatch.** `/books`, `/category/*` and both loading skeletons
   used `max-w-[1400px]` while the header, footer and homepage use
   `max-w-7xl` (1280 px). On wide screens the grid sat outside the header's
   edges. All four now use `max-w-7xl`.
2. **Activity log overflowed on a phone.** Its three columns used nowrap for the
   admin email and the timestamp, pushing the row past 320 px. Phones now get a
   two-line list (what happened, then who and when); the table is unchanged from
   `lg` up, matching how Orders and Books already handle small screens.

Neither touches data, auth, prices or checkout.

---

## 9. Decision needed

The brief asks me to wait before major visual changes. So:

- **Approve the "warm editorial shelf" direction** and I start with increments 1
  and 2 (homepage rhythm + genre tiles), show you the diff, then continue.
- **Or pick a different direction** — say which of R1–R5 you liked and I will
  re-plan around it.
- **Or tell me to proceed autonomously** through all six increments and I will
  ship them as reviewed PRs with the test results attached.

If you say nothing, I have not touched the design.
