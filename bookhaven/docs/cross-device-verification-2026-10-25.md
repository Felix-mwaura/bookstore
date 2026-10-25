# Homepage redesign — cross-device verification

Date: 2026-10-25 · Branch `arena/c0a0ba98-bookstore` (PR #53)

This is the evidence behind the claims in the PR. Everything below was run
against a **production build of this branch** (`next build && next start`),
rendered in a real Chromium engine, not inferred from one screenshot.

---

## 1. What changed

| File | Change |
| --- | --- |
| `app/components/HeroFan.js` | **new** — three covers held open like a hand fan |
| `app/components/GenreCarousel.js` | **new** — layered, looping, draggable genre deck |
| `app/lib/genres.js` | **new** — artwork + one line of copy per genre |
| `app/components/HomeClient.js` | hero rebuilt around the fan; old genre strip removed; per-genre counts now come from the server |
| `app/globals.css` | `.fan*` and `.genre-*` rules; reduced-motion handling |
| `app/lib/catalogue.js` | `getCatalogueStats()` also returns real per-genre counts |
| `public/genres/*.webp` | 8 generated 1200×1200 editorial images (424 KB total) |
| `app/components/StoreShell.js` | footer contact link wrapped at 320px; taller tap targets |
| `app/components/SectionHeading.js`, `StoreHeader.js` | tap targets raised to 24px+ without moving anything |
| `app/books/page.js`, `app/books/[slug]/page.js`, `app/category/[slug]/page.js`, `app/components/PolicyPage.js` | breadcrumb links raised to 27px tall |

No schema change, no dependency added, no env var added, no route changed.

## 2. Horizontal overflow — 10 widths × 7 pages

Measured with the document's own `overflow-x` left at `visible`, so a layout
that genuinely escapes the viewport is reported rather than hidden. The
`overflow-x: clip` net that an earlier draft used was **removed**: it made
`window.scrollTo` a no-op in testing, which is exactly the kind of hidden
breakage a net causes.

| Width | `/` | `/books` | `/category/fiction` | `/books/bleach-13` | `/help` | `/login` | `/checkout` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 320 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 360 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 375 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 390 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 430 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 768 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 1024 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 1280 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 1440 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |
| 1920 | 0px | 0 | 0 | 0 | 0 | 0 | 0 |

`0` = `documentElement.scrollWidth` equals `clientWidth`.

Four real overflows were found and fixed on the way, all pre-existing on
shipped pages:

1. **320–375px homepage** — the hero grid item defaulted to `min-width: auto`,
   so the search field's fixed pieces set a 370px floor and the page scrolled
   horizontally by up to 66px. Fixed with `min-w-0` on the copy column.
2. **320px and 768px, every inner page** — the footer's
   `hello@bookhaven.co.ke` is one unbreakable word that is wider than its
   column. Fixed by letting it break.
3. **1024–1280px homepage** — the fan's rotated outer leaves were wider than
   the box that contained them, spilling 32–37px past the page edge. Fixed by
   sizing the fan for the *rotated* bounding box.
4. **320px homepage, during this work** — the carousel's eight dots plus two
   arrows came to 340px inside a 288px space. Fixed with per-breakpoint dot
   sizes (24 / 26 / 30px).

## 3. Touch, pointer and keyboard

Automated, on the production build:

| Check | Result |
| --- | --- |
| Touch swipe left advances to the next genre | PASS |
| Touch swipe right goes back | PASS |
| Eight consecutive swipes visit all eight genres and return to the start | PASS `Self-Help → Finance → Productivity → Psychology → History → Philosophy → Fiction → Biography → Self-Help` |
| A vertical swipe scrolls the page and does **not** change genre | PASS |
| Tapping a side card navigates to its category | PASS `/category/finance` |
| Mouse drag advances the deck | PASS |
| A drag that ends over a card does not navigate | PASS |
| Next / previous arrow buttons | PASS |
| `ArrowRight` while an arrow button has focus | PASS |
| Dot jumps directly to a genre | PASS |
| Front card opens its category page | PASS `/category/fiction` |
| Every carousel control has an accessible name | PASS (11 controls) |
| Cards behind the front one are out of the tab order | PASS (2 skipped) |
| Arrow button paints a visible focus outline | PASS `2px solid rgb(181,83,47)` |

Implementation notes: `touch-action: pan-y` on the stage means vertical
gestures stay with the page; the drag offset is written to a CSS custom
property rather than React state, so a swipe does not re-render per frame; a
press only becomes a drag after 8px of mostly-horizontal movement, and the
click that follows a drag is suppressed.

## 4. Accessibility

| Check | Result |
| --- | --- |
| First `Tab` reaches a visible "Skip to content" | PASS |
| Each of the first 14 tab stops paints a focus ring | PASS (0 missing) |
| One `h1` per page | PASS `/`, `/books`, `/help` |
| No skipped heading levels | PASS `/`, `/books`, `/help` |
| Interactive targets ≥ 24×24 CSS px on a phone (WCAG 2.5.8) | PASS `/`, `/books`, `/category/fiction`, `/help` |
| Reduced motion: genre card transitions off | PASS `1e-06s` |
| Reduced motion: fan transitions off | PASS `1e-06s` |
| Carousel still advances with motion reduced | PASS |

**Contrast measured from pixels, not from colour tokens.** The genre name,
count and blurb sit on photography, so the screenshot behind each label was
sampled and scored against the real text colour for all eight genres:

| Text | Worst pixel across 8 genres | Needs | Result |
| --- | --- | --- | --- |
| Genre name (white, 21px bold) | **10.60 : 1** | 3 : 1 (large text) | PASS |
| Book count (`#F3C9B4`, 11px bold) | **9.48 : 1** | 4.5 : 1 | PASS |
| Blurb (white 84%, 13px) | **10.65 : 1** | 4.5 : 1 | PASS |

## 5. Images and data usage

| Check | Result |
| --- | --- |
| No book cover stretched or off its 2:3 box | PASS (11 covers) |
| Exactly one eager image — the hero cover | PASS |
| Everything else `loading="lazy"` | PASS |
| Hero cover preloaded (`<link rel=preload as=image>`) | PASS |
| Phone never requests a genre image wider than 750px | PASS — asked for `128, 256` |
| Genre artwork | 8 files, 1200×1200 WebP, **424 KB total** (down from 18.6 MB of raw PNG) |

Covers keep their aspect ratio because `BookCover` owns a `aspect-[2/3]` box
and the fan only ever tilts it with a transform. Genre images use
`object-cover` inside a card with a fixed height, so a 1:1, 3:4 or 2:3 source
crops rather than distorts.

## 6. Functionality after the redesign

| Flow | Result |
| --- | --- |
| Hero search → `/books?q=…` → the book appears | PASS at 390px and 1440px |
| Category filter → `/category/finance` shows only finance | PASS at 390px and 1440px |
| Front genre card → its category page, with titles | PASS at 320 / 390 / 768 / 1440px |
| Add to basket → `bh_cart` written | PASS |
| Basket survives navigation to `/checkout` | PASS |
| Checkout, signed out → sign-in gate that says the basket is kept | PASS |
| Login page renders email + password on a phone | PASS |
| `/admin` for an anonymous visitor → `/login?next=/admin` | PASS |
| Mobile menu opens and its links navigate | PASS |
| Wishlist control present and clickable | PASS |
| `scripts/smoke.mjs` | **24/24 passed, 9 skipped** (skips are admin routes needing a service-role key) |

**Not exercised here, because they need a live Supabase session or a real
phone:** sign-in itself, order creation, the delivery total and the M-Pesa
button on a populated checkout, order tracking, and the admin dashboard.
Those code paths were not modified by this change, but they were not tested
in a browser in this pass either — say so rather than implying otherwise.

## 7. Project test suite

| Command | Result |
| --- | --- |
| `npm test` (9 offline suites) | all pass **except** `reviews:sql`, which needs `@electric-sql/pglite` |
| `node scripts/reviews-sql-test.mjs` (with pglite installed) | **PASSED — 78 checks, 0 failed** |
| `node scripts/smoke.mjs` against this build | 24 passed, 9 skipped, 0 failed |
| `npx eslint .` | **0 errors, 7 warnings** (all pre-existing: 2 `<img>`, 5 unused vars) |
| `npx next build` | exit 0 |

## 8. What could not be tested — read this before claiming compatibility

| Environment | Status |
| --- | --- |
| Chromium (Chrome/Edge engine), desktop + emulated phone | **Tested.** Chromium 131 headless, 10 viewport widths, touch and mouse input. |
| Firefox | **Not tested.** The browser binary could not be downloaded in this environment. |
| Safari / WebKit | **Not tested.** No WebKit build available. |
| Real iOS Safari, real Android Chrome | **Not tested.** No physical devices. |
| Screen reader (NVDA, VoiceOver, TalkBack) | **Not tested.** Structure, names and roles were checked programmatically only. |

The new code deliberately avoids the features that most often differ between
engines: no `backdrop-filter`, no `:has()`, no `color-mix()`, no container
queries, no `dvh/svh`, no scroll-driven animations, no `image-set()`. The fan
and deck use only transforms, opacity, flexbox, grid, custom properties and
`aspect-ratio` — all of which have been stable in Firefox and Safari for
years. That is an argument, not evidence; a manual pass in Safari on an
iPhone is still owed before this is called universally compatible.

## 9. Known limits

* The deck shows five cards at ≥768px and three below that; the outer two are
  hidden on phones so the front card keeps a readable width.
* The deck does not auto-advance. Every motion is user-initiated.
* Genre artwork is AI-generated for this shop. It is decorative — the card's
  text and `aria-label` carry the meaning, and the `<img>` has an empty `alt`.
* A genre present in the catalogue but missing from `app/lib/genres.js` still
  renders, with a plain navy panel instead of a photograph.
