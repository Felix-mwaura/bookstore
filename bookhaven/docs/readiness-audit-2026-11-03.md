# Readiness audit — Book Haven, 3 November 2026

**Scope:** the brief of 3 November 2026 (*Complete website review, improvement and
implementation*), phase 1 — the read-only baseline — plus the small set of P0
changes that the brief explicitly authorises ("suppress unverified contacts").

**Updated 3 November 2026, after the owner answered the five questions in
§5.3.** The answers are recorded in §5.4 and every affected row below was
amended rather than deleted — the register is meant to show what changed and
why, not to look like nothing was ever wrong.

**What this document is not:** a production sign-off. Several of the brief's
acceptance criteria depend on facts this environment cannot see — a live
Supabase schema, the Daraja sandbox, a browser, a search console. Those are
listed in §6, not glossed over.

---

## 1. Readiness verdict

**Not production-ready — and the gap is mostly not code.**

The purchase path is in better shape than a typical store of this size:
orders are priced on the server by `place_order()`, the delivery rate is
checked against the database before every order, COD and M-Pesa are separate
states, M-Pesa callbacks are token-checked and idempotent, admin APIs answer
401 to anonymous callers, and reviews come only from published rows. None of
that was undone in this pass, and `npm test` covers it.

What stops a launch is a category of problem the code cannot fix by itself:

| Blocker | Why it blocks | Who can clear it |
|---|---|---|
| **No confirmed contact details** | The shop publishes no way to reach a person. Code now says so honestly (§4), but a customer with a problem has nowhere to go. | Owner |
| **Order emails cannot reach customers** | There is no verified sending domain, so the provider only accepts the account owner's own address. The copy no longer claims otherwise (H6), but a customer gets no confirmation and no refund notice by email. | Owner (buy a domain, verify it, set `NEXT_PUBLIC_ORDER_EMAILS=on`) |
| **Product records that look like test data** | "Lord Of Mysteries" at KSh 20, "Harry potter", "My dress up darling", "Chainsaw man" by "Unknown" are on a shelf customers can buy from. A rating on one of them is test data too. | Owner (approval to edit/retire; see §5.1) |
| **No stated refund window** | Refunds are manual and the shop's position is now on /terms and /help (M7). The *time* a refund takes is deliberately unstated. | Owner + a Kenyan consumer-law read |
| **Rate limits are not enforced in production** | `20261025130000_rate_limit_store.sql` has not been applied, so counters live in per-instance memory and reset on every cold start (M6). | Owner (path and two ways to apply are in §5.5) |

**Cleared since the first draft:** M-Pesa is live and has taken real money into
the correct account (owner, 3 Nov). The delivery-coverage claim now comes only
from the owner (C4). The rating was confirmed to be test data and is being
removed through the admin UI (H5); the rating a card shows is computed from
published reviews only, which was already true in code.

Everything below is either a finding with a file and a line, or a task with a
name attached.

---

## 2. How each claim in this document was checked

Three kinds of evidence, kept apart on purpose:

- **Inspected** — read the source, followed the call path.
- **Ran** — an automated check executed in this environment, with its output.
- **Not possible here** — needs a browser, the production database, Daraja, or
  a search console.

Automated results from this pass (fixture database, production build):

```
bash /tmp/build-offline.sh                exit 0   (next build --webpack, ~24 s)
npm test                                  exit 0   695 ok, 0 FAIL   (was 657 before this pass)
node scripts/ui-audit.mjs http://…:3100   784 passed, 0 failed, 60 pages
npx eslint app scripts                    0 errors, 5 warnings (3 unused vars, 2 <img>)
```

The five warnings are pre-existing and listed in §6. No test was weakened or
deleted; one script was added (§5).

---

## 3. Issue register

Severity is *customer or money impact*, not tidiness. "Owner" in the last
column means the fix needs a business fact or an authorisation from you.

### Critical

| # | Issue | Where | Impact | Status |
|---|---|---|---|---|
| C1 | Site published four **unverified contact details** as fact: `hello@bookhaven.co.ke`, `+254 712 345 678`, "The Junction Mall, Nairobi", "Mon–Sat: 9am–7pm" | `app/lib/site.js` (old `PLACEHOLDER_*` defaults), consumed by `StoreShell`, `HomeClient`, `PolicyPage`, `error.js` | A customer travels to an address that may not exist, or emails a mailbox nobody reads and concludes the shop ignored them | **Fixed in this pass** (§4). Publishing real values is an owner action |
| C2 | Apparent **test records on sale**: Lord Of Mysteries (KSh 20), "Harry potter", "My dress up darling", "Chainsaw man" (author "Unknown") | production `books` rows; not reachable from this environment | Buying one produces an order nobody can fulfil; a KSh 20 price on a real title is a pricing error waiting to happen | **Report only** (§5.1). Needs your approval to correct |
| C3 | **M-Pesa advertised without independent verification** | `app/api/mpesa/*`, checkout copy | A misconfigured Daraja path would mean customers see "pay" and nothing arrives | **Closed 3 Nov** — the owner confirms it is live and has taken real money into the correct account. The code-side guarantees (server-computed amount, `delivery_rate()` gate, callback token, idempotent confirmation) are unchanged and still tested |
| C4 | **"We deliver anywhere in Kenya" / "delivered nationwide"** published on its own authority | old `HomeClient` hero, `StoreShell` footer, `help` | A nationwide promise the shop may not be able to keep, on a page that also says it does not publish windows it cannot keep | **Fixed in this pass** — the sentence is now an owner-supplied fact |

### High

| # | Issue | Where | Impact | Status |
|---|---|---|---|---|
| H1 | **Sitemap listed eight hard-coded category slugs** while the nav, filters and admin read the `genres` table | `app/sitemap.js` (old `CATEGORIES`) | A genre an admin creates is invisible to search; a genre they delete is advertised as a 404 | **Fixed** — sitemap now calls `getGenres()` |
| H2 | **Checkout, account, admin, login served without `noindex`** | `next.config.ts` headers; `robots.txt` only | A disallowed URL can still be indexed, and a URL pasted into a browser never reads robots.txt; a basket or account page can surface in results | **Fixed** — `X-Robots-Tag: noindex, nofollow` on `/admin`, `/account`, `/checkout`, `/orders/*`, `/login` |
| H3 | **Newsletter collected addresses with no way off the list**: no unsubscribe path, no campaign sender in the codebase (the edge function only sends transactional mail), and a privacy promise ("unsubscribing is a link in every one of those emails") that nothing implements | `app/components/HomeClient.js`, `app/privacy/page.js`, `supabase/functions/send-email` | Consent you cannot withdraw; a false statement in a privacy notice | **Fixed as an honest gate** — the form waits for a published contact channel; the privacy page now describes what exists |
| H4 | **`app/error.js` hard-coded the placeholder email** instead of reading config | `app/error.js:43–44` | A broken page told the customer to write to an address nobody had confirmed | **Fixed** |
| H5 | **A rating on Lord Of Mysteries came from test data** — the 4.0 was produced by a review that no customer wrote | `app/lib/reviews.js` reads `book_rating_summary`, which counts published reviews; the row itself lives in production `book_reviews` | A fabricated rating is exactly what the brief forbids, and Google may quote it through `aggregateRating` | **Confirmed test data, 3 Nov.** Removal is one click in `/admin` → Reviews → **Hide** (§5.4). No code bug: the moment the row is hidden the card shows "no rating yet" and the JSON-LD drops `aggregateRating` |

| H6 | **Order emails cannot reach a customer**: the `send-email` function exists, but with no verified sending domain the provider only accepts the account owner's own address | `supabase/functions/send-email/index.ts`, `app/lib/email-dispatch.js`, `/terms`, `/privacy`, checkout confirmation | A customer is told their order is confirmed and hears nothing; a refund notice sent by email never arrives; password-reset mail is a separate Supabase path and is unaffected | **Copy fixed, capability open.** `ORDER_EMAILS_ENABLED` (new) drives every claim: unset, /terms says "We do not send email copies yet", /privacy says the same, and the checkout confirmation says the page is the record. The admin Emails tab now names the domain requirement and flags failed rows |

| # | Issue | Where | Impact | Status |
|---|---|---|---|---|
| M1 | **`20%` typed by hand in six customer-facing places** while `DELIVERY_PERCENT` exists | `HomeClient` (×4), `StoreHeader`, `books/[slug]/page.js`, `admin-client` | The day the rate or its wording changes, one of them is missed and the site disagrees with itself about money | **Fixed** — all read the constant |
| M2 | Sitemap uses `lastModified: now` for every URL on every regeneration | `app/sitemap.js` | Tells crawlers everything changed an hour ago, every hour; depresses the signal | Open — low effort, but it is a policy choice (per-book `updated_at` would be better and needs the column) |
| M3 | Sitemap caps at `getStorefrontBooks(500)` | `app/sitemap.js` | Books 501+ would be missing from the sitemap | Open — no effect at 16–40 titles, real at scale |
| M4 | Terms promise "you will see an order reference at checkout and receive it by email"; the email depends on the `send-email` edge function being deployed with a verified sending domain | `app/terms/page.js` | A promise in a contract that may not be kept | **Owner** — confirm the edge function is live, or soften the sentence |
| M5 | No **stated refund window or returns commitment** | `app/help/page.js` is deliberately honest about this | A shop taking money needs a position; the honest-but-empty state is better than a fake promise, and still not enough to launch on | **Owner + legal** |
| M6 | **Rate limits are not enforced in production**: the store is unconfigured, so `checkRateLimit()` allows every request and logs why | `app/lib/rate-limit.js`, `supabase/migrations/20261025130000_rate_limit_store.sql` | The newsletter and admin-assistant limits reset on every cold start; a burst can slip past on a multi-instance deploy | **Open — owner applies one file** (§5.5 has the path, both ways to apply it and the two queries that prove it landed). The app is safe either way: it degrades to per-instance memory, never to "no limit and no log" |

| M7 | **No published refund position** | `/terms`, `/help` | A shop that takes money has to say how it gives it back | **Documented 3 Nov** from the owner's statement: refunds are paid back by hand by the shop, no number of days is published (the last step is the provider's), keep the order reference. The refund *window* is still the owner's decision |

### Low

| # | Issue | Where | Impact | Status |
|---|---|---|---|---|
| L1 | Five lint warnings: unused `cover`, `initialBooksCount`, `setVerified`; two `<img>` in admin | several | Noise; hides the next real warning | Open |
| L2 | `font-mono` used twice in the admin assistant tab | `app/admin/assistant-tab.js` | Against the design rules (monospace as costume) | Open |
| L3 | OrderView address fields share one type size | `app/components/OrderView.js` | Hierarchy is flat on the most important screen after payment | Open |
| L4 | Nothing visual verified — no browser in this environment | — | Contrast, focus rings, 320–1920 layouts, dialogs | **Cannot be checked here** |

---

## 4. What changed in this pass

Every change is small, reversible, and refuses to invent a fact.

### 4.1 Contacts: absent, not guessed (`app/lib/site.js`)

`STORE_CONTACT` used to return the four placeholder values whenever the
`NEXT_PUBLIC_STORE_*` variables were unset. It now returns `null` for each
unset field, plus two derived flags: `reachable` (any channel configured) and
`usingPlaceholders` (kept for the existing call sites; it means "nothing is
configured").

What the customer sees when the values are unset, in place of a fake detail:

- **Footer** — "Contact details are not published yet", with a link to
  `/help` that explains how an order is handled.
- **Homepage contact band** — the same sentence, and the "Email the shop"
  button becomes "Delivery & returns" (a real page) instead of a `mailto:` to
  a dead mailbox.
- **/about, /help, /terms, /privacy** — the existing honest card, unchanged in
  spirit, now also copes with *some* details being set (email only, phone
  only).
- **Error page** — no address at all; it asks the person to note which page
  they were on.

Setting the five `NEXT_PUBLIC_STORE_*` variables turns all of it back on with
no deploy of new code. `.env.example` now says exactly that, and no longer
warns that the site will publish fake values.

### 4.2 Delivery claims: the fee stays, the map claim becomes yours

The fee model did not change: 20% of the book subtotal, computed by
`deliveryFeeFor()`, mirrored by `place_order()`, and refused outright if the
database disagrees (`/api/orders`, `PRICING_NOT_READY`). What changed is the
sentence around it.

- `DELIVERY_COVERAGE` (new, optional) is the only place a coverage claim can
  come from. Unset, the copy states what the code actually does — packed and
  handed to a rider or courier, current stage on the order page — and claims
  no geography.
- The six hand-typed `20%` strings now read `DELIVERY_PERCENT`, so the number
  cannot drift between the footer, the hero, the stat band, the product page
  and the admin panel.

### 4.3 One genre list (`app/sitemap.js`)

The sitemap's literal `CATEGORIES` array is gone; it now reads `getGenres()`,
the same function the nav, the carousel and the filters use, with the
documented built-in taxonomy as its fallback (it never throws, so a database
outage still yields a sitemap).

### 4.4 Newsletter: a list you can leave (`HomeClient`, `privacy`)

No unsubscribe mechanism exists in the codebase, and no campaign email is ever
sent — `send-email` is transactional only. Rather than leave a promise nobody
can keep, the form renders an honest "not open yet" state until the shop has a
published contact channel, at which point it reappears with no code change.

The privacy page's Email section now describes what the code does
(transactional mail to the address on the order) and says plainly that the
announcement list is closed until there is a way off it.

### 4.5 Private pages are served `noindex` (`next.config.ts`)

`X-Robots-Tag: noindex, nofollow` on `/admin`, `/account`, `/checkout`,
`/orders/*` and `/login`. robots.txt already disallowed them; a disallowed URL
can still be listed, and a pasted URL never reads robots.txt.

### 4.6 The check that keeps it true (`scripts/trust-smoke.mjs`)

New script, wired into `npm test` (43 assertions). It fails if any
placeholder value returns to `app/` as code, if an unconfigured shop reports
anything other than nulls, if a configured shop *fails* to publish (so the
feature cannot silently disappear for everyone), if the rendered pages leak a
placeholder, if the homepage promises nationwide delivery in the repo's own
words, if a private page is served without `noindex`, if `/terms` or `/privacy`
promises an email while `ORDER_EMAILS_ENABLED` is off (and fails if they *stop*
promising it once the flag is on, so the switch cannot rot), or if a category
the homepage links to is missing from the sitemap — which is the exact shape of
the bug in H1.

---

## 5. Owner action list

Nothing here is a code task. Each item is a fact or a decision I will not
invent.

### 5.1 Product data (needs your approval — I have changed nothing)

Four records look like test data. I cannot reach the production database from
this environment, so this list is from the brief and needs confirming against
the shop itself. **No rows were edited or deleted.**

Before deciding, run this read-only query in the Supabase SQL editor:

```sql
select b.id, b.title, b.author, b.price, b.stock_quantity, b.created_at,
       (select count(*) from public.order_items oi where oi.book_id = b.id) as times_ordered
from public.books b
where b.price < 100
   or b.author is null
   or b.author ilike any (array['unknown','felix','test'])
   or b.title ilike any (array['%harry potter%','%lord of mysteries%','%chainsaw%','%dress up%'])
order by b.created_at desc;
```

What each outcome means:

- **`times_ordered = 0`** → safe to delete, or to correct and keep.
- **`times_ordered > 0`** → do **not** delete. `order_items.book_id` is
  `ON DELETE RESTRICT`; the delete will fail, and it should. Set
  `stock_quantity = 0` (the storefront then shows "out of stock" honestly) and
  correct the metadata, or keep them and reprice.
- **Real books with bad metadata** (Harry Potter and Chainsaw Man are real
  titles) → correct title, author, price and cover; they are probably worth
  keeping.

Tell me which of the four you want corrected, retired or deleted, and I will
do it in one reviewed migration with a rollback note.

### 5.2 Business facts to publish

| Fact | Set where | Effect |
|---|---|---|
| Support email | `NEXT_PUBLIC_STORE_EMAIL` | Footer, homepage, policy pages, error page, newsletter form |
| Support phone (+ dialable form) | `NEXT_PUBLIC_STORE_PHONE`, `…_PHONE_E164` | Same, plus the "call us" wording on /help |
| Collection point (if any) | `NEXT_PUBLIC_STORE_LOCATION` | Policy contact card |
| Opening hours (if any) | `NEXT_PUBLIC_STORE_HOURS` | Policy contact card |
| Delivery coverage sentence | `NEXT_PUBLIC_DELIVERY_COVERAGE` | Homepage, footer, /help delivery section |

These are `NEXT_PUBLIC_*`, so they are baked into the browser bundle and must
never hold anything private — only details you would print on a poster.

### 5.3 Confirmations received on 3 November

| # | Question | Answer | Consequence |
|---|---|---|---|
| 1 | Is M-Pesa live and has a real transaction completed? | **Yes — real money, correct account.** | C3 closed. Checkout keeps advertising M-Pesa where `mpesaEnabled` is true; nothing in the copy changes. |
| 2 | Is there a verified sending domain for order emails? | **No — no domain bought yet.** | H6. Every customer-facing claim now follows `ORDER_EMAILS_ENABLED`, which is off until the domain exists. |
| 3 | What is the refund position? | **Manual refunds by the shop; refunded customers are emailed.** | M7. Written into /terms and /help as a manual refund with no published number of days. **The "emailed" half will not work until item 2 is fixed** — until then the refund notice has to be a call or a message to the number on the order. |
| 4 | Is the 4.0 on Lord Of Mysteries genuine? | **No — test data.** | H5. Hide it in `/admin` → Reviews; the aggregate and the JSON-LD recalculate themselves. |
| 5 | Has the rate-limit migration been applied? | **No — could not find the file.** | M6. `bookhaven/supabase/migrations/20261025130000_rate_limit_store.sql`; §5.5 has both ways to apply it. |

### 5.4 Removing the test rating (no SQL needed)

1. `/admin` → **Reviews**.
2. Filter to *Published*, find the review on **Lord Of Mysteries**.
3. Press **Hide**.

That flips `is_published` to false. `book_rating_summary` counts only
published rows, so the card loses its 4.0 immediately, the book page shows "no
rating yet", and `aggregateRating` disappears from that page's structured data.
Nothing is deleted, so the decision is reversible if it turns out to have been
a real review.

To see what is there first, read-only:

```sql
select r.id, b.title, r.rating, r.reviewer_name, r.is_published, r.created_at,
       r.verified_purchase
from public.book_reviews r
join public.books b on b.id = r.book_id
where b.title ilike '%lord of mysteries%'
order by r.created_at desc;
```

If more than one row exists, hide every one that no customer wrote.

### 5.5 Applying the rate-limit migration

The file is at **`bookhaven/supabase/migrations/20261025130000_rate_limit_store.sql`**
(inside the Next.js app folder, not at the repo root).

- **SQL editor**: open the file, copy all of it, paste into the Supabase SQL
  editor, run. It is idempotent (`create table if not exists`, `create or
  replace function`), so running it twice is harmless.
- **CLI**: `cd bookhaven && supabase db push`.

Then confirm:

```sql
select to_regclass('public.rate_limits');             -- rate_limits, not null
select public.check_rate_limit('smoke-test', 5, 600); -- allowed: true, retry_after: 0
```

The same instructions are in `README.md` under *Migrations you still have to
apply yourself*, so the next person finds them without asking. Until it runs,
the routes log `Rate-limit store is configured but missing: apply
supabase/migrations/20261025130000_rate_limit_store.sql` and allow the request.

---

## 6. Not verified, and why (do not read this as a pass)

| Area | Why it could not be checked here | How to close it |
|---|---|---|
| Visual quality on any page | No browser, no screenshots in this environment | One manual pass at 320/375/768/1024/1440, or give me a browser-capable runner |
| Real Core Web Vitals / Lighthouse | Same | Run PageSpeed Insights against production |
| Signed-in flows (account, addresses, order history) | The fixture answers 401 on `/auth/v1`; no real session exists here | Manual: sign in, place a COD order, open its order page |
| M-Pesa sandbox | Needs Daraja credentials | Authorised sandbox run; `scripts/mpesa-smoke.mjs` + `mpesa-callback-smoke.mjs` cover the code paths only |
| Production schema vs migrations | No database access | `supabase migration list` against production |
| The four suspect product rows | No database access | Query in §5.1 |
| Emails actually arriving | There is no sending domain, so this is known to fail for customers; the admin Emails tab is where it will show | After verifying a domain: send one test order, check inbox and spam, then set `NEXT_PUBLIC_ORDER_EMAILS=on` |
| Search-console coverage, canonical behaviour at scale | Needs production + time | Submit the sitemap, watch Coverage |

Five lint warnings remain (`cover`, `initialBooksCount`, `setVerified`, two
`<img>`). They are listed rather than silenced: silencing an unused variable
without reading it is how a real bug hides.

---

## 7. Route map (from the build output)

Public, indexable: `/`, `/books`, `/books/[slug]`, `/category/[slug]`,
`/about`, `/help`, `/terms`, `/privacy`, `/sitemap.xml`, `/robots.txt`.

Private, `noindex` + disallowed: `/admin`, `/account`, `/checkout`, `/login`,
`/orders/[id]`, `/access-denied`.

API: `/api/orders`, `/api/mpesa/{stk,query,status,token,callback}`, `/api/wishlist`,
`/api/addresses` (+ the `/api/adresses` typo alias), `/api/newsletter`,
`/api/admin/*`, `/api/assistant`.

Access control, as inspected and as the suite exercises it: every
`/api/admin/*` route answers **401** to an anonymous caller before it reads any
configuration; `/api/orders`, `/api/mpesa/stk`, `/api/wishlist`,
`/api/addresses` answer **401**; `/api/newsletter` is public by design with
body-size caps, validation, a honeypot and a rate limit.

---

## 8. Next steps, in order

1. Product-data decision (§5.1) — one reviewed migration, after the query.
2. Hide the test review (§5.4) — one click, two minutes.
3. Apply the rate-limit migration (§5.5) — one file.
4. Publish a contact channel (§5.2) — unblocks the newsletter form, the
   "email the shop" path and the footer.
5. Phase 2–3 of the brief: visual, responsive and accessibility review of
   every page, including admin and every empty/error/loading state. This is
   the largest remaining block and needs a browser to be honest; I can do
   source-level review and contrast maths here, not screenshots.
6. Phase 5–7: RLS and least-privilege re-verification against production,
   cache isolation, structured data spot-check, then the performance pass.

Historical audits (`production-audit-2026-10-23.md`,
`cross-device-verification-2026-10-25.md`, `store-refinement-2026-10-23.md`,
`polish-2026-10-31.md`, `premium-pass-2026-10-31.md`,
`functionality-audit-2026-11-03.md`) are untouched and remain the record of
what was true then.
