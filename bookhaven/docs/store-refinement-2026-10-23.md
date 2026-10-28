# Store refinement — 23 October 2026

What changed in this pass, what it is verified against, what it is not, and the
decisions that are yours to make.

The instruction was "refine everything into a full working e-commerce store".
That is a direction, not a finish line, so this pass did the work that **needs
no database change** and therefore needs no authorisation to ship, and it ends
with the schema work that does — written out, tested locally, **not applied**.

---

## 1. What shipped in this pass

### The two review follow-ups from the audit

**Deterministic review pagination.** "Highest rated" ordered by rating, then
date. Two reviews with the same rating can have the same timestamp, and with no
final tiebreaker the database is free to return them in any order — so a review
posted between two page loads could appear twice across a page boundary, or not
at all. Every sort now ends with `id desc`, which is unique and immutable.

**"Your review" marker.** A customer who has reviewed a book can now see which
row is theirs: the card is outlined and carries a **Your review** chip. This
required one server-side lookup — `my_book_review()` returns only the caller's
own row, so the page learns one id and not the `user_id` of every review. Signed
out, nothing changes.

### Saved addresses, end to end

`/api/addresses` (spelled `/api/adresses` until Oct 2026, still answered
as an alias) has existed since the checkout work, with full create, read,
update and delete — and **nothing in the customer UI ever called it**. The table
held zero rows; every order asked for the same address again.

- **Account → Addresses**: list, add, edit, delete, and choose a default. The
  first address saved becomes the default automatically.
- **Checkout**: a signed-in customer with saved addresses gets a "use a saved
  address" picker above the form. A checkbox saves the address used for the
  order (deduplicated against what is already saved, and never allowed to fail
  an order that is already in the database).

### Saved books follow the account

The wishlist was local-only, so saved books did not survive a new device or a
cleared browser. It now reconciles with the account on sign-in.

The interesting part is not the sync, it is the shared-device case: a wishlist
in local storage belongs to a **device**, and adopting it blindly into whoever
signs in next would put one customer's saved books into another customer's
account. The rules live in `app/lib/wishlist-sync.js` as three explicit cases —
same owner, no owner (guest saves, adopted), different owner (replaced, never
merged) — and are tested in `scripts/wishlist-sync-test.mjs`.

### Two things a past order should let you do

- **Buy these again** on any order: re-reads live prices and stock, adds what is
  available, says what is not, and goes to checkout.
- **Rate this book**, per item, on a **Delivered** order only.

### The pages every shop has to have

`/help`, `/privacy`, `/terms`, `/about`, linked from a new footer column and
included in the sitemap. They are written from what the code actually does:

- delivery is 20%, imported from the same constant that prices checkout, so the
  page cannot drift from the amount charged;
- payment is described as M-Pesa or cash on delivery, which is what exists;
- privacy lists the columns that actually exist and who can read them
  (verifying the cascade rules rather than guessing them);
- the terms describe cancellation by request, because there is no self-service
  cancel button — the alternative would be a promise the site cannot keep;
- **no invented returns window**. The page says there is no fixed rule and asks
  the customer to get in touch. A number there would be a commitment nobody at
  the shop has agreed to.

Because `lib/site.js` still carries **placeholder** contact details, the contact
block on these pages says the details are not published yet rather than
repeating a fake phone number and a mall address on four new pages. Set the env
vars below and it switches to the real details with no code change.

### Checkout

A plain-language line under the payment options: placing an order is under the
terms of sale, delivery is 20% and is shown before payment.

---

## 2. Verification

| Check | Result |
| --- | --- |
| `npx next build` | PASS — `/help`, `/privacy`, `/terms`, `/about` prerendered; `app/layout.js` restored, `git diff` empty |
| `npx eslint .` | 0 errors, 7 pre-existing warnings |
| `node scripts/smoke.mjs` | 24 pass, 9 skip (unchanged baseline) |
| `node scripts/reviews-sql-test.mjs` | 78/78 |
| `node scripts/reviews-smoke.mjs` | 43/43 |
| `node scripts/wishlist-sync-test.mjs` | 24/24 (new) |
| `node scripts/store-wiring.mjs` | PASS |
| `GET /help /privacy /terms /about /account` on a local production build | 200 each |

### Not verified, and why

- **No browser was driven.** Same constraint as the review work: this sandbox
  cannot open TLS to `*.supabase.co`, so the address book, the checkout picker
  and the wishlist sync were built against the APIs' contracts, lint, the build
  and review — not clicked. `docs/review-qa-checklist.md` covers the review
  flow; the address and wishlist flows need the same treatment (add a signed-in
  pass over: save an address → see it at checkout → toggle a saved book on two
  different browsers).
- **The address API has never had a real call.** Its routes predate this pass
  and were reviewed, not exercised. The first real use is the risk.

---

## 3. Decisions that are yours

### 3a. Contact details are still placeholders

The footer, the help page and the structured data all read:

```
NEXT_PUBLIC_STORE_EMAIL
NEXT_PUBLIC_STORE_PHONE
NEXT_PUBLIC_STORE_PHONE_E164
NEXT_PUBLIC_STORE_LOCATION
NEXT_PUBLIC_STORE_HOURS
```

Until they are set, the site publishes `hello@bookhaven.co.ke` and
`+254 712 345 678` in the footer, and the new pages say the details are not
confirmed. This is the single cheapest improvement on the list: five Vercel
environment variables and the shop stops advertising a phone number that rings
nowhere.

### 3b. There is no returns policy

`/help#returns` deliberately does not promise a window. If you want one
("unused books within 14 days"), tell me the terms and the page gets them — but
it should be a decision, not a number I invent.

### 3c. No self-service account deletion

Deleting an account is an administrator action. The privacy page says so. A
self-service delete needs a server route that removes the auth user with the
service role — worth doing before the shop has many customers, and a week of
"please delete my account" emails.

---

## 4. Proposals that need a migration (not applied)

Nothing below has been run. Each is written to be additive, idempotent and
wrapped in a transaction, in the same shape as the reviews migration.

### 4a. Discount codes — the biggest missing commerce feature

Today there is no way to run a promotion. The money path must stay server-side:
a code can only ever reduce the total, and the reduction must be recomputed in
`place_order()`, never trusted from the browser.

```sql
create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          citext unique not null,
  kind          text not null check (kind in ('percent', 'fixed')),
  value         integer not null check (value > 0),
  min_subtotal  integer not null default 0 check (min_subtotal >= 0),
  max_uses      integer check (max_uses is null or max_uses > 0),
  used_count    integer not null default 0 check (used_count >= 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
```

- `orders` gains `coupon_code text`, `discount_amount integer not null default 0`,
  and a check that `discount_amount` never exceeds the subtotal.
- `place_order()` takes the code, looks it up **inside the transaction**, checks
  the window, the minimum and the use count, applies it to the *book* subtotal
  (delivery stays 20% of the discounted subtotal — a decision to confirm), and
  increments `used_count` with the row lock it already holds.
- Redemption is recorded per order, so a code with `max_uses` cannot be raced.
- Admin CRUD in the existing dashboard; the Coupons tab is currently a
  placeholder.
- The checkout shows the discount as its own line and the order stores it.

Effort: roughly a day, most of it in `place_order()` and its tests.

### 4b. Stock alerts

"Email me when this is back." Needs a `stock_alerts` table, an enqueue on stock
change, and an unsubscribe path. Half a day. Only worth it once something
actually sells out.

### 4c. Reporting a review

The public text is unmoderated input. Administrators can hide and delete, but a
customer has no way to flag anything. A `review_reports` table plus a small
queue in the existing Reviews tab is about half a day, and it becomes worth
doing the moment there are enough reviews for a bad one to arrive unnoticed.

### 4d. Per-customer review limit

One account can currently review every title in the catalogue in an afternoon.
A daily cap is a two-line trigger change and one more check in the SQL test.

---

## 5. What I would do next, in order

1. **Set the contact env vars** (5 minutes, no code).
2. **Run the two browser checks** — reviews (`docs/review-qa-checklist.md`) and
   a signed-in pass over addresses and saved books. Everything below is worth
   less than knowing the paths a customer actually walks are solid.
3. **Coupons** (4a), if promotions matter to the shop.
4. **Review prompts on delivery** — the email template and the Delivered hook
   already exist; this is the cheapest way to get from zero reviews to some.
5. **Account self-delete**, before the inbox fills up.
