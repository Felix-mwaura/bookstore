# Navigation performance audit

Read-only investigation. No runtime code was changed. Everything below is
either measured in this environment or read directly from the source; the few
inferences are marked as such.

---

## The one-line finding

Pages that are prerendered answer in **5 ms**. Pages that touch the database
answer in **200–480 ms**, because every one of them pays for a *chain* of
Supabase round trips against a database on a different continent — and while it
waits, the browser shows the old screen with no indication that anything is
happening.

Measured locally, with a fixture database standing in for Supabase and 90 ms
added to each round trip (a realistic cross-region hop):

| Route | Server time | What it does |
| --- | --- | --- |
| `/` | **5 ms** | prerendered, served from cache |
| `/about` | 10 ms | prerendered |
| `/category/fiction` | 199 ms | 2 database waves |
| `/books?page=9` | 296 ms | 2 database waves |
| `/books/letters-home-12` | **482 ms** | 3 database waves |

Those are *server* times on a fast local machine. On Vercel the same page also
pays a cold-start when the function has not run recently, and the user pays
their own distance to the server on top.

---

## Finding 1 — The database is in Frankfurt and the server is (by default) in Washington

**This is the biggest single cause, and it costs nothing to fix.**

- Live Supabase project: `luniopceavtkljywukyi` (`Otakuops`), region
  **`eu-central-1` — Frankfurt**.
- The repo has no `vercel.json`, no `regions` key in `next.config.ts`, and no
  `preferredRegion` export anywhere. With nothing configured, Vercel runs
  serverless functions in **`iad1` — Washington DC**.
- The shop's visitors are in Kenya.

So the path of one page view is:

```
Nairobi ──~200 ms──> Washington DC ──~90 ms per query wave──> Frankfurt
```

Every sequential database wave is a transatlantic round trip. A page doing two
waves spends ~180 ms doing nothing but waiting for packets; three waves, ~270 ms.

**Fix:** set the function region to `fra1` (Frankfurt) so the function sits
next to the database, and each query wave drops from ~90 ms to ~5–15 ms.
That is a one-line `vercel.json` (`{"regions": ["fra1"]}`) and a redeploy.

**Estimated effect:** −150 to −250 ms on `/books` and `/category/*`, −250 to
−400 ms on book pages. It also shortens the visitor's path: Nairobi → Frankfurt
is meaningfully closer than Nairobi → Washington.

> Caveat: this environment only allows traffic to GitHub/npm/PyPI, so I could
> not measure production timings directly. The 90 ms hop is a modelled value,
> not a reading from your dashboard. The *configuration* is verified; the
> *number* is an estimate.

---

## Finding 2 — There is no loading state anywhere, so every navigation looks frozen

`find app -name loading.js` returns **nothing**. There is no `Suspense`
boundary around the catalogue either (the one in `/books` wraps content that
has already been awaited, so it never shows its fallback).

Two consequences:

1. **While the server works, the old page stays on screen.** Next's App Router
   keeps the current screen until the new render arrives. With no `loading.js`,
   a 300–500 ms wait has no spinner, no skeleton, no progress bar — it reads as
   "the site didn't respond to my click", and people click again.
2. **Link prefetch does nothing for these routes.** Next prefetches the loading
   shell of a dynamic route; with no shell to prefetch, the click goes to the
   server cold. The header's 14 `<Link>`s are therefore not buying anything on
   `/books`, `/category/*`, or book pages.

**Fix:** a `loading.js` beside `/books`, `/category/[slug]` and `/books/[slug]`
that renders the header + a skeleton of the real layout. This makes the wait
*visible* and switches prefetch on for those routes.

**Estimated effect:** no change to server time; the wait *feels* like a
transition instead of a stall. This is usually rated the most valuable single
change by users, precisely because it does not make anything faster.

---

## Finding 3 — Two catalogue pages are `force-dynamic` and repeat the same work every visit

`app/books/page.js` and `app/category/[slug]/page.js` both export
`dynamic = "force-dynamic"`. Every visit — the first one, the tenth one, an
identical URL — re-renders from scratch and re-queries the database. Nothing is
cached at the CDN or in Next's data cache.

Per visit to `/books`, the fixture logged:

```
wave 1:  books: 2        ← the page query (count + rows) and getCategoryCounts()
wave 2:  book_rating_summary: 1   ← stars, only after the rows arrive
```

**`getCategoryCounts()` is the expensive one**: it runs
`select("category").eq("is_archived", false)` with no limit — it pulls *every
book row on the shelf* into the function on every catalogue page view, just to
count them in JavaScript.

**Fix, in order of payoff:**

1. Wrap the catalogue reads in `unstable_cache` (or `use cache`) with a short
   TTL — say 60 s, matching the homepage. A repeated view of any filter
   combination then costs nothing.
2. Replace `getCategoryCounts()` with one grouped count (an RPC or a
   `group by category` view) instead of a full table read.
3. Only then consider ISR: both pages read `searchParams`, which forces dynamic
   rendering regardless of the export, so caching the *data* is the practical
   lever, not caching the *page*.

---

## Finding 4 — The book page is a three-step waterfall

`app/books/[slug]/page.js` does this, in order:

```js
const book = await getBookById(id);          // wave 1
const { user } = await getServerUser();      // wave 2 (only signs in a network call)
const [related, rating, reviews, viewer] =
  await Promise.all([...]);                  // wave 3
```

and `getRelatedBooks()` internally calls `attachRatings()`, which is its own
query — so the strip of "other books" adds a fourth hop after the third wave.

Three or four sequential hops is the 482 ms above.

**Fix:**
- Start `getBookById` and `getServerUser` in the same `Promise.all` — they do
  not depend on each other.
- Fetch the related books' ratings as part of the wave that fetches the related
  books, not after it.
- Consider dropping star ratings from the related strip entirely; it is
  decoration in that position.

**Estimated effect:** −90 to −180 ms on every book page.

---

## Finding 5 — 312 kB of JavaScript before the homepage is interactive

Measured from the built output — the scripts the homepage actually requests:

| Chunk | Size (gzip) | What it is |
| --- | --- | --- |
| `4bd1b696` | 63 kB | React DOM |
| `3794` | 66 kB | shared app code |
| `7183` | **51 kB** | the Supabase SDK — auth **and Realtime** |
| `5461` | **42 kB** | Motion (framer-motion) |
| `polyfills` | **39 kB** | Next's legacy-browser polyfills |
| others | ~50 kB | route + framework |
| **total** | **312 kB gz** | 16 script tags |

Two of those are avoidable on the storefront:

- **Realtime (inside the 51 kB Supabase chunk) is used only by the admin
  dashboard** (`admin-client.js:4259`), yet it ships to every shopper because
  `app/lib/supabase.js` calls `createClient()`, which bundles the whole SDK
  including the WebSocket client.
- **Motion is loaded on every page** via `MotionRoot` in the root layout, and
  again by `ProductCard`, `NumberTicker`, `ScrollProgress`, `StoreHeader`,
  `StoreShell`, `WishlistDrawer`. It is 42 kB gz for a drawer transition, a
  toast, and a counter.

On a Nairobi mobile connection 312 kB gz is roughly 1.5–4 s of download and
parse before anything is interactive. That is a **first-visit** cost, not a
per-navigation one — client-side navigation reuses the cached chunks — but it
is why the site feels heavy when it first opens and on a cold cache.

**Fixes:** lazy-load the admin's Realtime subscription behind a dynamic import;
replace the few Motion usages that are pure CSS transitions with CSS (the
drawer already has CSS equivalents in `globals.css`); check whether the
`polyfills` chunk is still needed with a modern browserslist.

---

## Finding 6 — The proxy runs on every page request to set a header

`proxy.js` (Next 16's renamed middleware) matches every page route. For
non-admin routes it does no database work, but it still runs on every
navigation and adds an edge hop before the function — for the homepage, which
otherwise answers in 5 ms, that hop is a meaningful share of its total.

The CSP it sets is per-response for the nonce routes (`/admin`, `/login`,
`/books`, `/category`, `/orders`) and a static string for the others. The
static ones can move to the `headers()` block in `next.config.ts`, which is
evaluated at build time and needs no middleware.

**Estimated effect:** small (tens of ms), and only on prerendered pages. Listed
for completeness, not as a priority.

---

## What I would do, in this order

| # | Change | Effort | Expected effect |
| --- | --- | --- | --- |
| 1 | `vercel.json` → `fra1` | 2 min | −150 to −400 ms on every database-backed page |
| 2 | `loading.js` for `/books`, `/category/[slug]`, `/books/[slug]` | ~1 h | the wait becomes visible; prefetch starts working |
| 3 | Cache catalogue reads (`unstable_cache`, 60 s) | ~2 h | repeat views ≈ instant |
| 4 | Replace the full-table `getCategoryCounts()` | ~1 h | −1 query wave on `/books` |
| 5 | Parallelise the book page's awaits | ~1 h | −90 to −180 ms per book page |
| 6 | Trim the JS (Realtime, Motion, polyfills) | ~half a day | −80 to −100 kB gz on first load |

Items 1–5 together should take every database-backed page from 200–480 ms to
under ~100 ms, and make the remainder feel intentional rather than broken.

---

## What this audit could not check

- **Real production timings.** This sandbox can only reach GitHub, npm and
  PyPI, so `curl` against the live site is blocked and the Vercel connector
  refused every read (`Access denied` — the token lacks project scope). The
  90 ms hop and all millisecond estimates are modelled, not measured.
- **Which region your functions actually run in.** No `vercel.json` and no
  region config exist in the repo, so Vercel's default (`iad1`) applies; I
  could not confirm it from the dashboard.
- **Anything about the visitor's device.** No browser here: no Lighthouse, no
  real network trace, no measurement of time-to-interactive on a phone.
- **Whether the user means "navigation" as in page-to-page, or "the app feels
  slow to open".** The findings split cleanly along that line: findings 1–4 are
  page-to-page, findings 5 is first load.
