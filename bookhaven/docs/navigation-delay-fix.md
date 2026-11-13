# Navigation delay — what was wrong and what changed

Companion to [`navigation-performance-audit.md`](./navigation-performance-audit.md), which
diagnosed the problem. This is the fix, the evidence, and what is still open.

Branch: `arena/987b289b-bookstore` (cut from `ce7dcb7`).

---

## The short version

Every internal navigation re-fetched the same public catalogue rows from
Supabase, one query wave after another, and showed nothing at all while it
waited. Two of those delays were fixed by caching public reads, one by moving
work off the critical path, and the "nothing at all" part by streaming a
skeleton and hoisting the store chrome into layouts.

Measured on a local production build against a fixture with a deliberately
slow database (**90 ms per query wave**, standing in for one transatlantic
round trip), median of five distinct URLs per route:

| Route | Before (every visit) | After — first visit | After — repeat visit |
| --- | --- | --- | --- |
| `/books?…` | 212 ms | 214 ms | **24 ms** |
| `/category/<slug>` | 201 ms | 202 ms | **15 ms** |
| `/books/<slug>` | 488 ms | 490 ms (full page) | **115 ms** |
| `/books/<slug>` — first byte | **483 ms** | **14 ms** | 14 ms |
| `/books/<slug>` — `<h1>` painted | 483 ms | **207 ms** | 207 ms |

The important column is the middle one for the last two rows: a book page still
costs ~0.49 s to render completely on a cold cache, but the reader now sees
chrome and a skeleton after **14 ms** instead of staring at the old page for
**483 ms**. On a repeat visit there is no database work at all left in the
page's first wave.

Caveat, stated up front: these are **modelled** numbers from a fixture, not
readings from your dashboard. The sandbox cannot reach the live site, and the
Vercel connector refused every read. The *direction* is measured; the absolute
milliseconds on your visitors' phones are not.

---

## Root cause

Four things, in descending order of how much of the delay they owned.

### 1. The function region was on the wrong continent — confirmed by configuration

Supabase project `luniopceavtkljywukyi` is in `eu-central-1` (Frankfurt). The
repo had no `vercel.json` and no region setting anywhere, so Vercel ran the
functions in its default `iad1` (Washington DC). Every database read crossed
the Atlantic twice.

This is the one fix that is configuration rather than code — `vercel.json` with
`{"regions": ["fra1"]}`. **It only takes effect on the next deployment.** I
could not verify the deployed region from here (connector access denied), so
treat the production half of this as unverified until you redeploy and look at
the function region in the dashboard.

### 2. Nothing was cached, so every visit repeated every query — confirmed by measurement

`/books`, `/category/[slug]` and `/books/[slug]` are all `force-dynamic`-style
server renders. Each visit re-ran the same `select` against `books`, plus a
second query for ratings. Two sequential waves per page, ~180 ms of pure
waiting at 90 ms a hop, and the same rows were fetched again by the next page
the visitor opened.

### 3. The book page had a three-wave waterfall — confirmed by measurement

`getBookById` → then `getBookRating` + reviews → then `getRelatedBooks`, with
the session lookup in series as well. Four dependent round trips to paint one
page.

### 4. There was no loading state — confirmed by measurement

No `loading.js` anywhere under `/books` or `/category`, no Suspense boundary,
and no progress feedback of any kind. The old page simply sat there. That is
what turned a 0.5 s server render into something that felt like 2–3 s: nothing
told the reader the click had registered.

### Suspected, not confirmed

- **Client-side JS weight.** The audit measured ~312 kB of JS before the
  homepage is interactive. I did not touch it, so it is unchanged. If the site
  still feels slow on a phone *after* the region fix, that is the next lever —
  not another database change.
- **Vercel function cold starts.** A cold serverless instance adds its own
  boot time on the first request after an idle period. Nothing in the repo can
  fix that; the cache below makes the second and subsequent requests cheap.

---

## What changed

| File | Change |
| --- | --- |
| `vercel.json` | **new** — `regions: ["fra1"]`, so functions run beside the database |
| `app/lib/catalogue.js` | `unstable_cache` (60 s, tag `catalogue`) around storefront books, one book, related books, catalogue pages and category counts; explicit column list for listings |
| `app/books/[slug]/page.js` | session and book fetched in one wave; related shelf moved behind Suspense; ratings no longer fetched twice |
| `app/books/layout.js`, `app/category/layout.js` | **new** — store chrome hoisted out of the three pages, so the header, cart drawer and footer survive a navigation instead of being rebuilt |
| `app/books/loading.js`, `app/category/[slug]/loading.js`, `app/books/[slug]/loading.js` | **new** — skeletons in the same grid geometry as the real content |
| `app/components/NavProgress.js` | **new** — 3 px terracotta bar at the top of the viewport while a navigation is in flight |
| `app/layout.js` | mounts the bar inside a Suspense boundary |
| `app/globals.css` | bar styling, including the reduced-motion branch |
| `app/api/admin/books/route.js` | clears the catalogue cache after every add / edit / archive / delete |
| `app/api/orders/route.js` | clears the catalogue cache after an order, because `place_order()` decrements stock |

Nothing else was touched. `git diff --stat` will confirm: no checkout, payment,
M-Pesa, cart, auth, RLS, schema or environment changes.

### The cache, precisely

- **What is cached:** public catalogue reads only — book rows, listing pages,
  related titles, category counts. Nothing customer-scoped goes near it. The
  cache key is made of primitives (search term, category, sort, price band,
  availability, page number, limit), so two different searches can never
  collide.
- **Who can read it:** the same anonymous Supabase client the signed-out site
  has always used, with no cookie access at all. Row Level Security still
  applies exactly as before. The book page's viewer-specific bits (the "your
  review" marker, the review form) are fetched outside the cache, per request.
- **How stale it can be:** 60 s ceiling, matching the homepage's own
  `revalidate`. Admin saves and completed orders clear it immediately, so the
  minute is a fallback, not the expected delay.
- **Why 60 s and not forever:** prices and stock change. A minute is short
  enough that an admin mistake self-corrects, long enough that repeat
  navigation is free.

### Why the related shelf streams

"More in …" was the last of four dependent queries on a page about *one* book.
It is now inside a Suspense boundary that renders after the title, price and
buy button are already sent. If that query fails, the shelf renders nothing and
the rest of the page is unaffected.

Note one honest behaviour change: the shelf tops itself up with popular titles
from other categories when the category is thin, so its heading now says
"More in X" only when every card really is in X, and "You might also like"
otherwise. It used to claim "More in X" unconditionally.

### The progress bar

Deliberately conservative, because a stuck bar is worse than no bar:

- appears only after **120 ms**, so a fast navigation shows nothing at all;
- ignores Ctrl/Cmd/Shift/Alt-clicks, middle clicks, `target="_blank"`,
  `download` links and external links;
- ignores links to the page you are already on, and in-page fragments;
- completes on any URL change, including search-param-only changes such as
  pagination;
- resets on back/forward;
- gives up after 10 s regardless;
- 3 px, `#B95735`, `pointer-events: none`;
- reduced motion: no crawl, no fades — the line appears at full width and
  waits.

It is a click listener plus a URL comparison, not `router.events`: the App
Router has no route-change event, and the Pages Router API throws here.

---

## Measurements

**Method.** Production build (`next build` + `next start`), same machine, same
fixture data (16 books), same fixture latency (**90 ms per query wave**), same
`curl` loop. `.next/cache` cleared and the server restarted before each
"before"/"after" series so that "first visit" really is a cache miss. Each
figure is the median of five distinct URLs in that route family.

The "before" series was measured from a worktree at `ce7dcb7` (the commit this
branch was cut from), built with the same toolchain, so both columns are the
same harness rather than a memory of an earlier run.

| | Before | After |
| --- | --- | --- |
| `/books?page=…` cold | 217 ms | 214 ms |
| `/books?page=…` repeat | 212 ms | **24 ms** |
| `/category/<slug>` cold | 202 ms | 202 ms |
| `/category/<slug>` repeat | 201 ms | **15 ms** |
| `/books/<slug>` cold | 488 ms | 490 ms |
| `/books/<slug>` repeat | 488 ms | **115 ms** |
| book page first byte | 483 ms | **14 ms** |
| book page `<h1>` | 483 ms | **207 ms** |

Reading it honestly:

- **A cold cache is not faster.** The first visitor after a deploy still waits
  for the same queries. That is physics, not code.
- **A repeat visit is 4–14× faster**, and that is the common case: a reader who
  clicks a book, goes back, filters, clicks another.
- **The book page's cold start now *looks* different even though it is not
  shorter.** 14 ms to first byte, 207 ms to a painted heading, with the reviews
  and the related shelf filling in underneath. Before, 483 ms of nothing.

### What this fixture does not prove

- **Production timings.** Unreachable from here.
- **The region fix's effect.** Modelled at 90 ms per wave; real `fra1` →
  Frankfurt hops should be single-digit milliseconds, which would shrink even
  the cold numbers substantially. That is an expectation, not a measurement.
- **Mobile and reduced-motion behaviour.** No browser in this environment. See
  the checklist below.

---

## Regression checklist

| Area | Result | Evidence |
| --- | --- | --- |
| Production build | **passed** | `next build --webpack` exit 0, all three routes still `ƒ` (dynamic) |
| Unit / integration suite | **passed** | `npm test` — 888 checks, 0 failures |
| Render + a11y crawl | **passed** | `npm run ui:audit` — 784 passed, 0 failed, 60 pages |
| Lint on touched files | **passed** | `eslint` exit 0 |
| Motion rules | **passed** | `motion-smoke` — every duration on a token, no linear fade, no infinite animation |
| M-Pesa STK / query / callback | **passed** | `mpesa-smoke`, `mpesa-callback-smoke`, `security-mpesa-limits-smoke`, `security-callback-token-smoke` — unchanged and green |
| Cash on delivery | **passed** | `security-cod-smoke` — green, no file touched |
| Auth / admin / role checks | **passed** | `security-smoke`, `security-admin-bodies-smoke`, `ui-audit` `/admin`, `/account`, `/orders` — green |
| Cart / checkout totals | **passed** | `cart-smoke`, `price-smoke`, `delivery-smoke` — green |
| Reviews & moderation | **passed** | `reviews-smoke`, `reviews-sql-test` — green; the list itself is not cached, so a published review still appears immediately |
| Search, filters, sort, pagination | **passed** | `ui-audit` crawl + fixture spot checks; cache keys include all filter parameters |
| Category counts after the Map→object change | **passed** | filter panel renders `Fiction (4)`, `Psychology (2)`, … from the cached object |
| No cross-session data leak | **passed (limited)** | cached modules import no `next/headers` and cannot read cookies; two requests with different cookie jars produced byte-identical HTML after nonce stripping; `/books` sends no `Set-Cookie`. A true two-user test needs a real Supabase session, which this fixture cannot mint. |
| Detail page JSON-LD rating | **passed** | still built from `getBookRating`, not from the removed `getBookById` ratings |
| Mobile layout | **not run** | no browser in this environment. Structurally the skeletons reuse `BookGrid`'s own grid classes and the bar is `position: fixed; inset-inline: 0; height: 3px; pointer-events: none`, so neither introduces a new width. |
| Reduced motion | **partially verified** | CSS branch and the JS branch are covered by `motion-smoke`, but the actual rendering was not observed in a browser. |
| Admin save → cache cleared | **code-verified only** | `revalidateTag("catalogue")` after insert/update/archive/delete and after `place_order`. Could not exercise it end-to-end without an admin session against a real database. |
| Deployed region actually `fra1` | **not verified** | needs a redeploy; the Vercel connector refused reads. |

Nothing was weakened to make a check pass. The two motion rules that failed on
the first draft of the progress bar were fixed in the CSS/JS, not in the test.

---

## Remaining issues

1. **Deploy required.** The region change does nothing until Vercel builds this
   branch. That is the single highest-value change here and the only one I
   cannot demonstrate.
2. **The book page is still ~0.49 s cold.** Remaining cost: session lookup,
   rating summary and reviews — three queries I did not cache, because review
   moderation has to be visible immediately and a stale "you already reviewed
   this" is worse than a slower page. Caching them is possible (a `reviews` tag
   cleared on post/approve/hide) and would take a cold book page to roughly the
   catalogue's numbers. Not done, because it widens the blast radius of this
   fix into moderation.
3. **First-load JavaScript is untouched.** The audit's ~312 kB stands. That is
   the remaining cost for a visitor who arrives cold, and the next thing to
   look at if the site still feels slow once the region is fixed.
4. **The client router cache still expires immediately.** `force-dynamic` pages
   are re-fetched on back/forward. Loosening `staleTimes` would make
   back/forward instant but would also delay the cart/account reflecting a
   change, so I left it alone.
5. **Cache warm-up after a deploy.** The first visitor to each URL pays full
   price, and on a fresh deployment that is every URL. Nothing here pre-warms
   it; the 60 s window makes the second visitor cheap.
6. **Stock can lag by up to 60 s** if it changes anywhere other than an admin
   save or an order. Those are the only two paths in the codebase, and both
   clear the cache.

---

## Deploy notes

- `vercel.json` is read from the project root (`bookhaven/`) on the next
  deployment. No environment variables change.
- No database migration is involved. Nothing to run in SQL.
- If you want to see the difference yourself before merging: open the site,
  visit a book page, go back, open another. The second and later navigations
  should show the bar and then content with no visible pause. The very first
  hit after a deploy will still be slow — that is the cold cache, not a
  regression.
