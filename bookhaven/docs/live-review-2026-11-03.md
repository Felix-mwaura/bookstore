# Live review — production, 3 November 2026

What was checked on <https://bookstore-puce-sigma.vercel.app/> from outside, in
the browser-less way available here, and what it proved.

**This is not a visual review.** There is no browser in this environment: no
screenshots, no layout, no keyboard tab-through, no reduced-motion check, no
contrast measurement, no Lighthouse. Those remain open and are listed at the
end rather than implied.

---

## 0. The tool has a blind spot — read this before the findings

The pages were fetched as rendered HTML converted to markdown. That converter
**drops `<header>` and `<nav>` landmarks**. Confirmed against the source:

| Missing from every fetch | Why |
|---|---|
| Page titles, counts, breadcrumbs on `/books`, `/category/*`, `/about`, `/help`, `/terms`, `/privacy` | `PageHeader` renders `<header>` (`app/components/PageHeader.js:24`) and `PolicyPage`'s title block too |
| Genre / price / availability filters, pagination | `CatalogueControls` and `Pagination` render `<nav>` (`CatalogueControls.js:40,62,83`, `Pagination.js:25`) |
| The site nav and its genre menu | `<nav>` |

So "no heading on `/books`" would have been a false alarm. Everything below is
either visible in the page body, or verified against source before being
called a defect. Where a page element could not be seen, it says so.

Also not observable this way: JSON-LD (stripped with `<script>`), `<meta>`
tags beyond `<title>`, CSS, images' intrinsic behaviour, and anything that
happens after hydration (cart, checkout steps, dialogs).

---

## 1. What is genuinely working in production

Each of these was exercised with a real request, not assumed:

| Check | Evidence |
|---|---|
| **Contact placeholders are gone** | Footer and homepage say "Our phone number and inbox are not published yet"; no `hello@bookhaven.co.ke`, no phone, no address anywhere in the body of `/`, `/about`, `/help`, `/terms`, `/privacy` |
| **Newsletter no longer collects without a way off the list** | "The announcement list is not open yet" — the form is absent from the HTML |
| **No unverified delivery claim** | "Every order appears in your account with its current stage" replaces "we deliver countrywide" |
| **Sitemap reads the database** | 9 `category/*` URLs including `education`, which is not in the built-in taxonomy but is in the `genres` table |
| **Delivery maths agree end to end** | Product page: KSh 1,250 → "KSh 250" delivery; KSh 20 → "KSh 4"; both 20%, stated before payment |
| **Sort works both ways** | `?sort=price-asc` → 20, 700, 1,099, 1,199, 1,200, 1,250, 1,299, 1,345, 1,399, 1,450, 1,500, 1,500. `?sort=price-desc` → 1,899 … 1,250 |
| **Pagination is correct** | 17 titles, 12 per page; page 2 holds exactly the remaining 5 |
| **Price bands work** | `?price=under-1000` → exactly two books (KSh 700, KSh 20), with an "Under KSh 1,000 ✕" chip |
| **Search empty state is honest** | "No books match “zzzznotabook”" + Clear filters — no fake results, no dead end |
| **Category pages work for every genre** | `/category/education` renders its single book |
| **Checkout empty state** | "Your basket is empty / Add a book before checking out" + a way out |
| **Protected routes redirect, not leak** | `/orders/1` → `/login?next=%2Forders%2F1` |
| **Discounts are traceable** | The badge is computed from a real `original_price` column (`ProductCard.js:39-41`), not invented per render: 1,599→1,250 = −22%, 2,099→1,599 = −24% |
| **Stock labels reflect the shelf** | "Only 3 left" on Deep Work, "In stock" elsewhere, "Be the first to review" where no review exists |
| **Unreviewed books carry no rating** | `/books/the-subtle-art-of-not-giving-a-f-ck-12`: "No reviews yet", "Not yet rated", and no `aggregateRating` input |
| **Real book data is intact** | Subtle Art: publisher HarperOne, ISBN 9780062457714, 2016, 224 pp — all checkable |

---

## 2. Defects found, and what happened to them

### 2.1 Critical — a genre filter that silently does nothing *(fixed)*

`/books?category=Education` returned **all 12 books on page 1**, with the title
"All books" and no filter chip. `/books?category=Fiction` correctly returned 7
with a "Fiction" chip.

**Cause:** `app/books/page.js` validated `?category=` against the hard-coded
eight-name array in `app/lib/categories.js`. "Education" exists only in the
`genres` table, so it was discarded and `queryCatalogue()` received no filter.

**Reach:** the desktop sidebar and the header's genre picker both render from
`genres` (the database), so both offer Education and both link into a filter
that ignores the choice. A customer picks a genre and gets the whole shop.

**Fixed:** `app/books/page.js` now resolves the value through `getGenres()`,
accepting a genre name or its slug, case-insensitively. Any genre an admin
creates filters correctly from that moment, with no deploy of new code.

### 2.2 High — the sitemap advertises a page it forbids *(fixed)*

`sitemap.xml` listed `/login` while `robots.txt` disallows it and
`next.config.ts` serves it `X-Robots-Tag: noindex`. Three signals disagree;
Search Console reports the shop's own sitemap as submitting an excluded URL.

**Fixed:** `/login` removed from the sitemap. The noindex header and the
robots rule stay.

### 2.3 High — the one rating on the site is test data *(owner action, one click)*

`/books/lord-of-mysteries-18` shows **4.0 (1)** with a review by **Knight P.**
dated 23 Oct 2026: *"It's an excellent book … It is a fantastic book experience
… 10/10"*. The card for the same book shows the 4.0 in the catalogue and on the
homepage.

`/about` says, in as many words, that ratings come from real reviews by
signed-in customers. One of them did not. Hide it in `/admin` → Reviews; the
aggregate, the card and the structured data all recalculate from
`book_rating_summary`, which counts published rows only.

### 2.4 High — four product records that are not products *(owner action)*

Live and purchasable right now, all "In stock":

| Title | Author | Price | Notes |
|---|---|---|---|
| Lord Of Mysteries | Felix | KSh 20 | ISBN `7895463289` — not a valid ISBN-13 (must begin 978/979); publisher "felix" |
| Harry potter | Felix | KSh 1,500 | real title, placeholder metadata |
| My dress up darling | Felix | KSh 1,500 | |
| Chainsaw man | Unknown | KSh 1,345 | author literally "Unknown" |

The other 13 titles carry checkable data (real publishers, valid ISBNs, sensible
pages/years), so this is a four-row cleanup, not a catalogue problem.

### 2.5 Medium — the homepage names 5 of its 9 genres

The genre deck renders only the active card and two either side
(`VISIBLE_DEPTH = 2` in `GenreCarousel.js`), so the homepage HTML contains
Fiction, Psychology, Education, Self-Help and Biography — while the stat beside
it says "09 genres to browse". Finance, History, Philosophy and Productivity
appear only after a swipe or arrow press.

Not fixed here, deliberately: the dots and arrows already reach all nine, and
choosing between "add a plain index of all genres" and "widen the deck" is a
design decision that needs to be *looked at*, which I cannot do. Recorded
instead, with a recommendation in §4.

### 2.6 Medium — `/about` told people to contact a shop with no contact details *(fixed)*

"For anything else, contact us directly." immediately above a card saying the
contact details are not published. Now: when details are configured it points
at them; until then it says they are not published and points at the order
reference.

### 2.7 Low — `/privacy` contradicted itself about email *(fixed)*

"Order emails already sent are in your inbox, outside our control" sat two
sections below "the shop does not send email copies of an order yet". Now
conditional on `ORDER_EMAILS_ENABLED`.

### 2.8 Low — five of seventeen covers are missing

Books 7, 8, 10, 11 and 12 render the designed text fallback (genre, title,
author on a navy panel) instead of cover art. It looks deliberate rather than
broken — the fallback is not an alt-text smear — but it is a data gap, not a
design choice, and the shelf looks uneven next to the covered titles.

### 2.9 Low — every URL in the sitemap claims to have changed at once

`lastModified` is `new Date()` for all 26 URLs on every regeneration
(`2026-11-03T16:01:26.429Z` on every `<url>`). Crawlers learn to ignore it.

---

## 3. Route-by-route

| Route | Observed | Verdict |
|---|---|---|
| `/` | Hero, delivery strip, search, genre deck (5 of 9), new arrivals, how-it-works, stats, trust strip, closed newsletter, honest contact band | Good. Genre deck coverage is the open question |
| `/books` | 12 cards, chips when filtered, empty state, no results leakage | Good. Empty and filtered states are honest |
| `/books?sort=…` | Correct ordering both directions | Good |
| `/books?page=2` | 5 remaining titles | Good |
| `/books?price=under-1000` | 2 titles, chip shown | Good |
| `/books?q=…` | "No books match", Clear filters | Good |
| `/books?category=Education` | Whole shelf, title "All books" | **Was broken; fixed** |
| `/books/[slug]` (with cover) | Price, 20% delivery for that title, stock, buy bar, reviews, related | Good |
| `/books/[slug]` (no cover) | Text fallback panel, honest "not yet rated" | Acceptable; data gap |
| `/category/[slug]` | Renders the genre's books, including a DB-only genre | Good |
| `/help` | Delivery at 20% with a worked example, payment, tracking, damaged books, refunds, review rules, no invented promises | Good — the strongest page on the site |
| `/terms` | Order reference without the email promise, refunds by hand, cancellation, limits | Good |
| `/privacy` | Data collected, who sees it, no trackers, deletion, what survives | Good after the email fix |
| `/about` | What is sold, delivery, why ratings look the way they do, contact | Good after the contact fix |
| `/checkout` (empty) | Clear empty state and a route back to the shelf | Good |
| `/login` | Sign-in, reset link, register link, one-line data note | Good |
| `/orders/1` (anonymous) | Redirect to `/login?next=…` | Correct |
| `/sitemap.xml` | 26 URLs, 9 genres, 17 books, all timestamps identical | `/login` removed; timestamps open |
| `/robots.txt` | Disallows admin/account/checkout/orders/login/api, declares host + sitemap | Correct |

---

## 4. Recommendations not implemented

1. **Genre deck.** Either widen it to show every genre on wide screens, or add
   one quiet line under the stage — "All genres: Fiction · Finance · …" — as
   real links. The second is better for scanning and gives every genre page an
   internal link from the homepage. Both are visual changes; pick one after
   looking at it.
2. **Covers.** Upload artwork for the five titles that fall back to text.
3. **Sitemap timestamps.** Use each book's `updated_at` once it is exposed to
   the storefront query; until then a daily timestamp for the static routes and
   no `lastModified` for book URLs would be more honest than "now".
4. **Duplicate CTAs.** Product pages carry "Add to basket" twice (sticky bar and
   panel) with identical accessible names. Consider labelling the sticky one
   with the book title, or making it `aria-hidden` until it is actually stuck.

---

## 5. Still not verified — do not read the rest of this document as covering it

| Area | Why | How to close |
|---|---|---|
| Layout at 320/360/375/390/430/600/768/820/1024/1280/1366/1440/1920 | No browser | Manual pass, or a runner with a headless browser |
| Keyboard journey, focus order, dialogs, skip link in practice | No browser | Tab through: home → genre → book → basket → checkout → confirmation |
| Reduced motion | CSS rules exist and are unit-checked (`craft-smoke`); behaviour is unobserved | Emulate `prefers-reduced-motion: reduce` and watch a page transition |
| Contrast in situ | Token maths passes; nothing checks what is actually painted | axe/Lighthouse, or a contrast picker on the live page |
| JSON-LD (`Book`, `Offer`, `AggregateRating`, `Breadcrumb`, `Organization`) | Scripts are stripped by the fetcher | Rich Results Test on a book URL; expect **no** `aggregateRating` on unreviewed titles |
| `<meta>` description / OG / Twitter cards | Only `<title>` is visible this way | Social preview debugger |
| Core Web Vitals | No browser | PageSpeed Insights on the production URL |
| Signed-in flows: account, addresses, cart persistence, COD order | Needs a real session | One manual COD order end to end |
| M-Pesa end to end | Needs Daraja credentials | Owner has confirmed live payments with real money; the callback path remains untested from here |
| Admin screens | Needs an admin session | Manual pass over every tab |

---

## 6. Commands run for this review

```
build-offline.sh                     exit 0   (next build --webpack)
npm test                             exit 0   704 ok, 0 FAIL   (700 → 704: 4 new assertions)
node scripts/ui-audit.mjs :3100       784 passed, 0 failed, 60 pages
npx eslint app scripts               0 errors, 5 warnings (pre-existing)
node scripts/trust-smoke.mjs         passed — 43 assertions, including the Education filter
```

The fixture database was extended with an `Education` genre and one book on it,
so the regression that shipped can never pass silently again.
