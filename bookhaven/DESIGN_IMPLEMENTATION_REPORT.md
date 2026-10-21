# BookHaven — design research and implementation report

**Scope:** the brief *“BookHaven: AI-driven UI design research and implementation.”*
**Branch:** `arena/5cc61e5a-bookstore` → `main`
**Shipped in:** PR #30, #31, #32, #33 (`a636867` → `fab3560`)
**Live:** <https://bookstore-puce-sigma.vercel.app>

Every figure, test result and file below was produced in this environment. Anything
that could not be checked says so, in place, rather than being smoothed over.

---

## 1. References used

Two kinds of evidence were available: live template demos I could load, and
design imagery I could look at. **Pinterest itself could not be opened** — HTTP 403
on search, on boards, on individual pins and on `/ideas/`, from this environment.
Per the brief I did not attempt to bypass that, and nothing below claims to be
based on a pin I never saw. The pin URLs are in `DESIGN_RESEARCH.md` §6 so you can
open them yourself.

| # | Reference | Type | Source |
| --- | --- | --- | --- |
| R1 | Readster | Live site (paid Webflow template, $79) | <https://readster-template.webflow.io/> |
| R2 | Edition | Live site (paid Webflow template, $79) | <https://edition-template.webflow.io/> |
| R3 | Webflow bookstore template index | Template marketplace listing | <https://webflow.com/list/bookstore> |
| R4 | “Vintage Books — book store website” | Portfolio / concept (image only) | Behance, found via image search |
| R5 | Minimal product grid | Image only | Dribbble, found via image search |
| R6 | Orders list / admin dashboard | Image only | Dribbble, found via image search |
| R7 | StarCode Kh admin | Image only | via image search |
| R8 | BookHaven production build | The real thing | <https://bookstore-puce-sigma.vercel.app> |

Local copies of the images sit outside the repo in `/home/user/design-refs/`
so no third-party asset was committed.

**Not accessible, stated plainly:** Pinterest (403). Dribbble was never fetched as
a browsable listing (its search returns only navigation chrome to a plain fetch);
the Dribbble material above came through image search, so it is evidence of how
those screens look, not a record of inspecting the source files or specs.

---

## 2. Links (original sources)

- Readster — <https://readster-template.webflow.io/> · shop <https://readster-template.webflow.io/shop> · product <https://readster-template.webflow.io/product/the-design-of-everyday-things>
- Edition — <https://edition-template.webflow.io/>
- Template index — <https://webflow.com/list/bookstore>
- Pinterest, for you to open: `/pin/579979258311813008/` (e-commerce admin dashboards), `/pin/inventory-store-management-dashboard-ui--356488126768206787/` (inventory dashboard)

---

## 3. Why these, and why not others

Readster and Edition are the two bookstore templates that actually load, and both
are the same product family, so they set the bar for “competent bookstore
storefront” rather than being two independent ideas. Readster scored **4.2 / 12**
in the evaluation; Edition **3.6**; Vintage Books **3.5**; the minimal grid
**3.6**; the orders-admin screens **4.0**. Full per-criterion scoring, including
the criteria they lost points on, is in `DESIGN_RESEARCH.md` §2–3.

What earned a place in the direction:

- **Readster** — cover-first cards with the price below the fold of the card, and
  very generous vertical rhythm between sections. Adopted: the rhythm, and the
  card hierarchy (cover → category → title → author → stock → price → action).
  Rejected: its star ratings and customer-photo review block, because BookHaven
  has no review data and inventing it would be a lie.
- **Edition** — a wall of covers as the hero, serif display type. Adopted at small
  scale: three rotated covers in the hero, not nine. Rejected: the entrance
  animations on every section, the lorem-ipsum copy, and the press quote.
- **Vintage Books (concept)** — the closest palette match to BookHaven's cream,
  navy and sienna. Adopted: the uppercase eyebrow with a hairline rule beside it,
  oversized serif headline, hairline dividers between blocks. That eyebrow + rule
  is now one component used on every homepage band and every catalogue header.
- **Minimal product grid** — name left, price right, one hairline between them,
  single action. Adopted exactly that row. Rejected: hover-only “Add”, which is
  undiscoverable on touch and invisible to keyboard users, and its ~3:1 grey.
- **Orders-admin screens** — counters as the first thing on the dashboard, status
  pills, grouped sidebar. Adopted as *bands* of linked counters. Rejected:
  “counters + deltas” as the whole overview, and any percentage that was not in
  the database — a small shop needs “what do I have to do today”, not a
  week-over-week chart.

**Inspiration only, no template purchased, no code or asset copied.** Nothing here
required a licence, and no other company's branding, logo or imagery was used.

---

## 4. Components redesigned

**Storefront**

1. `SectionHeading` — the one section pattern: sienna eyebrow + `w-6` rule,
   Playfair title, one optional sentence, at most one action link, light or dark
   tone. Six homepage bands now share it.
2. Hero — display type stepped down to `1.75rem` below `sm` so “Books worth
   keeping,” holds on one line at 320 px; three rotated covers kept as the only
   3D moment; one search field, two actions.
3. Genre strip — emoji replaced by real covers from the catalogue, with the first
   letter as fallback for a genre with no cover; counts retained.
4. `ProductCard` — cream cover stage, category, two-line title, stock as dot +
   word, price on a hairline with the single action. Price is `KSh 1,399` visible
   as `KSh1,399` compact with the full string in `aria-label`.
5. Catalogue (`/books`, `/category/[slug]`) — eyebrow + hairline toolbar, H1 with
   the count, filter and sort on one baseline.
6. Book page — price, stock, quantity, Add to basket, Buy now and the delivery
   note in one white panel; description and a `<dl>` of format, pages, publisher,
   year, ISBN below it.
7. Basket drawer — 56 px covers, unit price when quantity > 1, delivery line,
   empty state with two real routes back.
8. States — a new storefront error boundary, a book-page skeleton, a grid
   skeleton shaped like the new card, and the existing loading/empty states.

**Admin**

9. Overview — twelve equal tiles became three bands: *Today's work* (awaiting
   processing, awaiting dispatch, shipped, delivered with “% of orders”,
   cancelled), *Money* (net revenue, gross order value, awaiting payment,
   refunded), *Catalogue* (titles, low stock, out of stock). Pipeline counts open
   the order list; catalogue counts open inventory.
10. Admin chrome — one drawn stroke-icon set for stats and navigation (emoji
    removed), a badge for `Packed` that was missing, recent orders and the
    activity log get phone lists instead of horizontal scroll.

Every number on the dashboard is a field that already existed. Nothing was
derived, extrapolated or invented.

---

## 5. Files changed

20 files, +923 / −363, across the four PRs.

```
app/components/SectionHeading.js       new  the one heading pattern
app/components/HomeClient.js                hero, genre tiles, six bands
app/components/ProductCard.js               card hierarchy, stock, price row
app/components/BookGrid.js                  skeleton + empty state
app/components/StoreShell.js                drawer line items, empty state
app/books/page.js                           catalogue toolbar
app/category/[slug]/page.js                 catalogue toolbar, emoji removed
app/books/[slug]/page.js                    buy panel, definition list
app/books/[slug]/loading.js            new  book-page skeleton
app/books/loading.js                        header skeleton
app/category/[slug]/loading.js              header skeleton
app/error.js                           new  storefront error boundary
app/globals.css                             quieter card tilt
app/admin/admin-client.js                   bands, icons, Packed badge,
                                            phone lists, contrast
app/admin/error.js                          contrast
app/checkout/page.js                        contrast
app/components/OrderView.js                 contrast
app/access-denied/page.js                   contrast
DESIGN_RESEARCH.md                          research, direction, record
AUDIT_PHASE4.md                             audit updated with this pass
```

Not touched: Supabase schema, RLS policies, auth callbacks, cart storage keys,
order creation, M-Pesa routes, `place_order()`, any environment secret.

---

## 6. Tests performed

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npx next build --webpack` | compiled, **28/28** static pages |
| Lint | `npx eslint .` | **0 errors**, 7 warnings (all pre-existing) |
| HTTP smoke | `node scripts/smoke.mjs http://127.0.0.1:3143` | **24 passed, 9 skipped** (skips need the service-role key) |
| Cart arithmetic | `node scripts/cart-smoke.mjs` | pass — add, cap, out-of-stock, totals, qty, reconcile |
| Price formatting | `node scripts/price-smoke.mjs` | pass — compact prices exact, full price for screen readers |
| Store wiring | `node scripts/store-wiring.mjs` | pass — one store behind grid, header badge, drawer |
| Card markup | `react-dom/server` probe | “In stock” / “Out of stock”, disabled “Sold out” with an accessible name, price `aria-label`, “Was …” |
| Genre tiles | rendered production HTML | monogram fallback, no emoji, name is the genre + count |
| Deployed pages | `fetch_page` on prod | `/`, `/books`, `/books/deep-work-4` render; `/admin` returns 307 to login |
| Deploy status | `gh api …/deployments/<id>/statuses` | **success**, `fab3560`, `2026-10-21T20:56:23Z` |
| Contrast | computed from the tokens | eyebrow 7.95/4.59/4.95, muted 5.69/6.13, sky 5.57, white-on-sienna 5.00 — all ≥ 4.5 |

**Not tested, and I will not pretend otherwise:** no browser render at any width,
no device, no screen reader, no axe run. No headless browser can be installed in
this environment. Responsive behaviour was reasoned from the markup and the
Tailwind classes and verified only as far as server-rendered HTML allows.

---

## 7. Regressions found and fixed

- **Clipped 3D tilt** — the card needed `position: relative` for the stretched
  link but `overflow: hidden` was cutting the tilt and its shadow. The cream
  cover stage carries the rounding instead.
- **Duplicated accessible names** — genre tile links would have read each cover's
  `alt` text; the cover cluster is now `aria-hidden`, so the name is
  “Self-Help · 2 books”.
- **`Packed` had no badge** — a real fulfilment stage (the status RPC supports it)
  was rendering as a generic grey pill. Added a sky badge at 5.57:1 with a `▪`
  mark so it is not colour-only.
- **Low-contrast admin text** — `stone-400` (≈2.5:1) on white across the admin,
  checkout, order tracking and access-denied screens moved to the muted token
  (6.1:1). Disabled states were left alone, since disabled text is exempt.
- **Pipeline counts implied a filter that does not exist** — “awaiting
  processing” spans two statuses, so the tiles open the full order list and the
  band description says exactly that.
- **320 px hero line break** — the headline broke awkwardly at 320 px and the
  book-page `<dl>` pushed wide on long publisher names; both fixed and rebuilt.

No behavioural regression is known: basket, prices, stock caps, checkout totals,
auth guards and RLS were not modified.

---

## 8. Remaining issues

1. **A real device pass is still owed** at 320 / 360 / 390 / 768 / 1024 / 1440 px.
   This is the check that would catch anything my reading of the classes missed.
2. **The admin was never rendered signed in** — the bands and lists were built and
   linted, not looked at.
3. **No screen-reader or axe pass.**
4. **Pinterest was never opened** (403); §3 is built on what could be loaded.
5. **Launch items from the security audit, unchanged by this pass:**
   apply `20261020030000_profile_role_hardening.sql` (D8, High), set
   `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_MPESA_ENABLED`, replace the
   placeholder contact details in `app/lib/site.js`, and test M-Pesa in the
   Daraja sandbox as part of going live.
6. **Admin customer/user/notification tables** still use `overflow-x-auto`; they
   are usable but not converted to the phone-card pattern the orders table now has.
