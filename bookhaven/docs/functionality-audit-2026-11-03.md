# Functionality audit and premium polish — 3 November 2026

Two briefs arrived together: one asked for a complete interaction audit of the
shop, with every broken thing fixed; the other asked for the same audit plus a
premium visual pass using [Magic UI](https://github.com/magicuidesign/magicui)
as the reference. They are one pass, done in that order: understand, test,
fix, then polish — never the reverse, because a beautiful page that cannot
take an order is worth nothing.

The visual layer itself was already rebuilt on this branch (see
`premium-pass-2026-10-31.md`: one type scale, one page frame, one set of
components). This document covers what the audit found on top of that, what
was fixed, and what was added from Magic UI — and, more importantly, what was
deliberately **not** added.

---

## Phase 0 — the inventory

**Routes.** 20 pages under `app/`: `/`, `/books`, `/books/[slug]`,
`/category/[slug]`, `/checkout`, `/account`, `/orders/[id]`, `/login`,
`/help`, `/about`, `/privacy`, `/terms`, `/admin`, `/access-denied`, plus
`not-found.js` and `error.js`. 24 API routes under `app/api/` (admin CRUD,
newsletter, orders, wishlist, addresses, five M-Pesa endpoints). Three
loading boundaries and two `notFound()` call sites. Nothing in the tree is
unreachable.

**Data.** Five client shapes and eleven tables: `books`, `genres`,
`book_reviews`, `book_rating_summary`, `orders`, `profiles`,
`mpesa_payments`, `mpesa_callbacks`, `stock_movements`, plus two storage
buckets (covers, and the admin's upload target). Reads are anon + RLS;
writes are server routes with the service key; the only browser-side writes
are auth and the wishlist.

**Design language.** Cream `#FAF6EE`, navy `#1B2A4A`, sienna `#B5532F`, one
display serif (Playfair) over one UI sans (Inter), seven-step type ladder,
three radii, three shadows — all documented in `premium-pass-2026-10-31.md`.
Tailwind v4 with `@theme` tokens; no shadcn/ui, and adding it would have
meant a second component system beside the one the branch just built.

**Baseline.** `npm ci` 380 packages; `next build` 0 errors; `npm test` 0
failures, 657 assertions; `eslint app scripts` 0 errors, 7 pre-existing
warnings.

---

## Phase 1 — what was tested, and how

There is no browser in this environment (no Chromium, no Firefox, no
Playwright), so "test every interactive element" was done three ways:

1. **A crawler over the running production build.** New in this pass:
   `scripts/ui-audit.mjs` (`npm run ui:audit`) seeds 12 routes, follows every
   internal link it finds up to 60 pages, and asserts per page: one `h1` and
   that it is the display serif, every `<img>` has `alt`, every field has an
   accessible name, every button has a name, no `href="#"` or empty anchor,
   no duplicate ids, a `<title>`, a meta description, a `lang`, a skip link,
   and no placeholder copy. **784 assertions across 60 pages — all passing.**
2. **Targeted HTTP probes** against the real route handlers (below).
3. **Code inspection** for the things a crawler cannot see: handlers that do
   nothing, double-submit guards, focus traps, error branches, and the
   server-side half of every authorization decision.

### The table

`OK` means verified in this environment. `Code` means read and judged sound
but not exercisable here (no database, no auth server, no Daraja).

| # | Area | Element | Expected | Found | Status | Fix |
|---|---|---|---|---|---|---|
| A1 | Nav | Every header/footer/breadcrumb link | resolves | 60 pages crawled, no dead route, no `#` | OK | — |
| A2 | Nav | Active-page state in the browse row | marked | `aria-current="page"` + sienna underline | OK | — |
| A3 | Nav | Mobile menu | opens, closes, closes on link | `useDialog` trap, Escape, outside click, every link closes it | Code | — |
| A4 | Nav | Search submit (button + Enter) | navigates | `submitSearch` builds `?q=&category=` | OK | — |
| A5 | Nav | Empty search | not a dead end | `/books` with all titles | OK | — |
| A6 | Nav | Search with SQL metacharacters | safe | term stripped of `,%()` before `ilike` | OK | — |
| A7 | Nav | 404 page | real 404 | **200 with a 404 body** on `/books/*` and `/category/*` | **BROKEN** | removed the three streamed loading boundaries; now 404 |
| A8 | Nav | Out-of-range page (`?page=99`) | not a dead end | empty grid under a heading describing titles | **PARTIAL** | 307 to the last real page, filters preserved |
| B1 | Catalogue | Sort, price band, availability, genre | correct result set | mirrors the query builder; 4 sorts × 4 bands × 2 stock × 8 genres | Code | — |
| B2 | Catalogue | Pagination | pages exist | `pages = ceil(total / 12)`, redirect past the end | OK | A8 |
| B3 | Catalogue | Card click-through | navigates | `<Link>` on cover + title, whole card clickable | OK | — |
| B4 | Catalogue | Card hover/focus | feedback | lift + cover tilt on `(hover:hover) and (pointer:fine)`; flat on touch | OK | — |
| B5 | Catalogue | Sold-out card | cannot be added | `stockState()` → button disabled, "Out of stock" label | Code | — |
| B6 | Catalogue | Cover fallback | drawn when no image | `BookCover` paints a typographic cover from `books.cover` | OK | — |
| C1 | Cart | Add / increment / decrement / remove | totals track | `lib/cart.js`, pure and covered by `cart-smoke` | OK | — |
| C2 | Cart | Quantity cap | never above stock | `addItem` returns `capped`; `setQuantity` clamps | OK | — |
| C3 | Cart | Persistence across refresh | survives | `localStorage` + reconciliation on load | Code | — |
| C4 | Cart | Empty basket at checkout | blocked with a way out | "Your basket is empty" + browse link | OK | — |
| C5 | Cart | Checkout without a session | asks to sign in | dedicated panel explaining why before paying | OK | — |
| C6 | Checkout | First paint | shows the page, not a sentence | **only "Checking your session…"** in the server HTML | **BROKEN** | skeleton with the real `h1`, step rail and panel |
| C7 | Checkout | Required fields | inline errors | `validate()` per field, `aria-invalid` + `aria-describedby` | Code | — |
| C8 | Checkout | Kenyan phone | 07XX / 01XX / 254 / +254 | `isValidKenyanPhone` + `normalisePhone` | OK | — |
| C9 | Checkout | Double submit | one order | `saving` disables the button; `idempotencyKey` sent | Code | — |
| C10 | Checkout | Cash-on-delivery consent | keyboard usable | was a `<div onClick>` — unreachable by keyboard/SR | **BROKEN** | real `<input type="checkbox">` (earlier on this branch) |
| C11 | Checkout | Price change while in the basket | told, not silent | re-prices from the database, shows a `basketNotice` | Code | — |
| D1 | M-Pesa | Anonymous STK request | 401 | 401 | OK | — |
| D2 | M-Pesa | Status endpoint | no secrets | `{enabled, environment}` only | OK | — |
| D3 | M-Pesa | Callback, valid/invalid results | updates the order once | five verification checks, idempotent by `CheckoutRequestID` | Code | — |
| D4 | M-Pesa | Callback token | optional, enforced when set | `verifyCallbackToken`, 403 before the body is read | OK | — |
| D5 | M-Pesa | Button states | idle/loading/waiting/success/failed/timeout | six explicit states, countdown, "pay on delivery" fallback | Code | — |
| E1 | Auth | Sign up / in / out | works | Supabase auth, clear errors, session persisted | Code | — |
| E2 | Auth | Password reset | end to end | recovery link → `/account?recover` → set new password | Code | — |
| E3 | Auth | Protected routes | redirect, then return | `?next=` validated against an allow-list | OK | — |
| E4 | Auth | Other users' data | impossible | RLS + server-side `auth.uid()` checks; no client-trusted ids | Code | — |
| F1 | Forms | Newsletter: invalid address | 400 | 400, message | OK | — |
| F2 | Forms | Newsletter: disposable inbox | 400 | 400 | OK | — |
| F3 | Forms | Newsletter: valid, duplicate, honeypot | 200 | 200 / 200 / 200 | OK | — |
| F4 | Forms | Newsletter: oversized body | refused | 413 | OK | — |
| F5 | Forms | Reviews | validated, one per book | length clamps, error messages, `my_book_review` | Code | — |
| G1 | Admin | Every `/api/admin/*` without a token | 401 | **500 "server misconfigured"** when the service key is absent | **BROKEN** | token check first, configuration second |
| G2 | Admin | Non-admin token | 403 | profile lookup, `role !== admin` → 403 | Code | — |
| G3 | Admin | Book create/edit/delete | works, archive when ordered | service-key route, archive-vs-delete rule | Code | — |
| G4 | Admin | Cover upload | type + size checked | validated before upload, old object cleaned up | Code | — |
| H1 | Data | Every query checks `error` | no silent failures | 17 bare `catch {}` blocks reviewed — all `localStorage` guards | OK | — |
| H2 | Data | N+1 | none | ratings batched by `.in()`; related books one query | OK | — |
| H3 | Data | `?page=` / `?q=` bounds | clamped | 80-char query, page ≥ 1, sort/price/stock allow-listed | OK | — |
| I1 | Quality | Keyboard | reachable | skip link, 44px targets, visible 2px ring, focus trap in overlays | OK | — |
| I2 | Quality | Icon-only controls | named | 60-page crawler: no nameless button | OK | — |
| I3 | Quality | Images | alt + no layout shift | every `<img>` has `alt`; covers are aspect-locked | OK | — |
| I4 | Quality | Console / hydration | clean | **not verifiable** — no browser | — | see below |

### The five things that were actually broken

1. **Soft 404s** (`/books/anything`, `/category/anything`). The `loading.js`
   boundaries at `app/books/`, `app/books/[slug]/` and
   `app/category/[slug]/` started streaming the response before
   `notFound()` could run, so a missing title answered **200** with a 404
   body. Link checkers, analytics and Google all saw a healthy page. Removing
   those three boundaries restores a real 404 — verified:
   `/books/nope-999` and `/category/nope` now answer 404 while every real
   page still renders. The trade was a skeleton on navigation; prefetching
   covers most of it, and the list page keeps its in-page grid skeleton.
2. **A blank first paint at `/checkout`.** Until the session check answered,
   the server HTML held one sentence. It now paints the page: the `h1`, the
   step rail and the form's shape.
3. **`/account` had no heading while loading**, so the page's most important
   semantic anchor appeared late — and not at all if the fetch hung.
4. **A dead end past the last page.** `?page=99` rendered an empty grid under
   a heading describing the shelf. It now redirects (307) to the last page
   that exists, keeping every filter and sort.
5. **The admin API leaked its own configuration.** Every `/api/admin/*` route
   answered `500 "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set"`
   to anonymous callers when the key was absent. Identity is now checked
   first (401), configuration second (500 only for a caller who proved who
   they are).

---

## Phase 2 — the premium polish, and Magic UI's part in it

Magic UI is a library of animated components (MIT, `motion`-based). The brief
asked for it "with restraint… refined, not flashy". Two components earned a
place; six were considered and rejected on grounds that are stated here so
the decision can be argued with.

### Adopted

**`NumberTicker` → the catalogue figures on the homepage**
(`app/components/NumberTicker.js`). Three live counts — titles on the shelf,
genres, ready to ship — count up once when they scroll into view. Adapted
from the original in two ways that matter: it animates with one
`requestAnimationFrame` loop under the house curve instead of a Motion
spring (the shop has no springs), and it renders the final figure on first
paint when the visitor's system asks for reduced motion. The animated digits
are `aria-hidden`; a screen reader hears the real number.

**`ScrollProgress` → the long-form pages**
(`app/components/ScrollProgress.js`). A two-pixel sienna rail on the policy
pages and a book's detail page — the two places on this site someone reads
to the end. The original ships a three-stop pastel gradient; a gradient is
the one thing this design language refuses, so it is a single colour. It
renders **nothing** under `prefers-reduced-motion`, and it is `aria-hidden`
so it never becomes a tab stop.

### Considered and rejected

| Magic UI component | Why not |
|---|---|
| `blur-fade` / `text-animate` | The site already has one reveal system (`[data-reveal]`). A second, differently-timed entrance is the exact "every section does the same dance" problem the craft rules name. |
| `marquee`, `scroll-based-velocity` | The genre deck already moves; a second moving strip beside it competes for the same attention and never stops. |
| `bento-grid` | Needs shadcn/ui's `Button` and Radix icons — a second component system for a catalogue grid that is not a marketing pitch. |
| `border-beam`, `magic-card`, `shine-border`, `neon-gradient-card`, `meteors`, `particles` | All are gradient/glow decoration. The house rules ban glass and gradients as ornament, and these would date the shop within a year. |
| `shimmer-button`, `rainbow-button`, `shiny-button` | A second action treatment beside `.btn-primary` breaks "one action colour per view". |
| `confetti` | Not a premium cue; it is a party trick on a page where someone has just paid money. |
| `number-ticker` as shipped | Adopted in form, not in code: see above. |

**No dependency was added.** `motion` was already a dependency; both
components are hand-adapted to this repo's tokens and conventions, and both
carry the MIT attribution in their header comment.

---

## Verification

| Check | Result |
|---|---|
| `next build` (offline, fixture database) | **0 errors**, 32 routes, compiled in 5.3s |
| `npm test` | **0 failures — 657 assertions** across 25 suites |
| `npm run ui:audit` (new) | **784 passed, 0 failed, 60 pages** |
| `eslint app scripts` | **0 errors**, 7 warnings (all pre-existing) |
| `/books/nope-999`, `/category/nope` | **404** (was 200) |
| `/books?page=99`, `/category/fiction?page=99` | **307** → last real page, filters kept |
| `/api/admin/*` without a token | **401** (was 500 when misconfigured) |
| Newsletter: bad / disposable / valid / honeypot / GET / oversized | 400 / 400 / 200 / 200 / 405 / 413 |
| M-Pesa status | `{enabled:false, environment:null}` — no credential echoed |
| Sitemap, robots | 200 |
| Server HTML, all 60 crawled pages | one `h1` (Playfair), alt on every image, every field and button named, no dead anchors, no duplicate ids, title + description + lang + skip link |

**Performance, measured from the running build:** 15–16 script chunks per
page, **≈1.0 MB raw / ≈300 KB gzip**; CSS **83 KB raw / 16 KB gzip**. The
weight is the Supabase browser client, React and Motion, all of which
predate this pass; the two new components add about 3 KB between them and
mount only where they are used. No Lighthouse run is possible without a
browser, so no score is claimed.

**Accessibility:** the crawler's 784 checks plus the craft suite's contrast
maths; focus rings, the skip link, 44px targets and the reduced-motion rules
are unchanged by this pass and asserted by `craft-smoke`.

### Not verified here, and why

- **Anything visual.** No browser exists in this environment: no screenshot
  at 360/768/1280, no hover or focus state actually seen, no console read,
  no hydration warning observed, no synthesised touch.
- **Anything that needs the real backend.** Sign-up, sign-in, password
  reset, order creation, RLS, the Daraja STK push and its callback against
  Safaricom, and storage uploads are judged from code and from the
  authorization tests that do run (every privileged route answers 401 to an
  anonymous caller). A fixture database was used for rendering; it is not a
  substitute for the real one.

---

## Needs your decision

1. **Apply `20261025130000_rate_limit_store.sql`.** Until it exists, the two
   limiters fall back to per-instance counting.
2. **M-Pesa credentials and environment.** The code is correct for either
   host, but only you know whether the Daraja app is a sandbox or a live
   one; a mismatch fails as "invalid credentials" and reads like a bad key.
   `MPESA_ENV`, `MPESA_SHORTCODE` and `MPESA_TILL_NUMBER` are the three that
   disagree most often.
3. **`NEXT_PUBLIC_SITE_URL`** must be the production HTTPS origin, or the
   callback URL defaults to the wrong host and Daraja rejects the push.
4. **SMTP password rotation** and the `welcome-email` function, both flagged
   in the earlier audit and still outstanding.
5. Whether you want the **loading skeletons restored** on `/books/*` and
   `/category/*` at the cost of soft 404s. The audit's answer is no; the
   opposite is defensible if SEO is not a concern.

---

## Manual checklist (after deploying to Vercel)

Five minutes each, in this order:

1. **Browse** — open `/`, tap a genre, use the header search with one term
   and with an empty field, change the sort, apply a price band, go to page 2.
2. **Book page** — open a title, check the price and stock line, add it to the
   basket, back out, confirm the basket badge is 1.
3. **Basket** — raise the quantity to the stock limit (it should stop),
   remove the line (the drawer should show the empty state), add it again.
4. **Checkout, cash** — sign in, complete the form with a real Kenyan number,
   submit, confirm one order appears in `/account` and that the button could
   not be pressed twice.
5. **Checkout, M-Pesa** — on a sandbox build only: send the prompt, enter the
   PIN, wait for the success screen; then cancel a second attempt and confirm
   the failure screen offers the pay-on-delivery fallback.
6. **Auth** — sign out, sign in with a wrong password (clear error), use
   "forgot password", follow the email, set a new password.
7. **Admin** — sign in as an admin, add a book with a cover, edit its price,
   delete a book with no orders (removed) and one with orders (archived).
8. **Keyboard** — Tab from the top of `/`: the skip link appears first; every
   control shows a ring; open the basket and press Escape.
9. **Phone** — at 360px wide: the menu opens and closes, fields do not make
   the page zoom, the sticky header never covers a heading.
10. **404** — visit `/books/does-not-exist` and confirm a real 404.
