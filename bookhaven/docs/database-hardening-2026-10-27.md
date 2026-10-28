# Database hardening — 27 October 2026

Applied to the live project `luniopceavtkljywukyi` (Otakuops) through the
Supabase MCP, as three recorded migrations. No application row was modified;
every functional test below ran inside a transaction that was rolled back, and
the row counts afterwards are unchanged.

| Version | Name | What it does |
| --- | --- | --- |
| `20261027173623` | `harden_public_privileges_and_rls` | table/function privileges, 2 duplicate policies dropped, 21 policies rewritten |
| `20261027173645` | `schema_defaults_fk_and_fk_indexes` | `payment_status` default, two `NOT NULL`s, the wishlist FK, `delivery_rate()`, five FK indexes |
| `20261027173820` | `index_wishlists_book_id` | index for the new FK |

Matching files are in `supabase/migrations/` under those versions. All three
are idempotent, so replaying them is a no-op.

---

## 1. Privileges

Applied as specified:

* `REVOKE TRUNCATE, REFERENCES, TRIGGER` on all tables in `public` from `anon`
  and `authenticated`, **plus** `ALTER DEFAULT PRIVILEGES` so new tables do not
  inherit them again.
* `REVOKE INSERT, UPDATE, DELETE` on `admin_activity_log`, `email_outbox`,
  `stock_movements`, `mpesa_payments`, `newsletter_subscribers`.
* `profiles`: table-level `UPDATE` revoked from both roles, then
  `GRANT UPDATE (first_name, last_name, phone, email)` to `authenticated`.
  `role` is not in the grant — a request that tries it fails at the privilege
  layer, before the `protect_profile_role` trigger even runs.
* `is_admin()`: `EXECUTE` revoked from `PUBLIC` and `anon`, kept for
  `authenticated` (the admin policies are evaluated as that role).

**Not done as written — `book_reviews`.** The brief asked for table-level
`GRANT SELECT, INSERT, UPDATE`. The live table already has the column-level
grants from migration `20261023162927` — `SELECT` on every column **except**
`user_id`, `INSERT` on `(book_id, user_id, rating, title, review_text)`, and
`UPDATE` on `(rating, title, review_text)` — and `app/lib/reviews.js` depends
on them: it reads with the anon key and documents that `select *` must fail.

Table-level grants would have (a) exposed every reviewer's `user_id` to anyone,
and (b) let a customer write `is_published` and `verified_purchase` on their
own review — the moderation switch and the "verified purchase" badge. Both
were confirmed possible only through the column grants, so the grants were left
alone and verified instead:

```
anon  select * from book_reviews                        -> 42501
anon  insert into book_reviews ...                      -> 42501
auth  insert ... (is_published, verified_purchase)      -> 42501
auth  insert ... (own user_id)                          -> 1 row
```

**`delivery_rate()`.** Recreated as IMMUTABLE SQL with `SET search_path TO
public`, still `select 20`. `EXECUTE` was revoked from `PUBLIC`, `anon` **and**
`authenticated`, then granted explicitly to `service_role`: both call sites
(`app/api/orders/route.js`, `app/lib/mpesa-availability.js`) use the service
client, and `service_role` inherits nothing, so an explicit grant is the only
thing that keeps the pricing guard working.

## 2. RLS cleanup

* Dropped `Public books read` (exact duplicate of `Books are publicly
  readable`) and `Admins can read payments` (superseded by `Admins can read
  mpesa payments`).
* Rewrote all 21 policies that called `auth.uid()` / `is_admin()` to
  `(select auth.uid())` / `(select public.is_admin())` — one InitPlan per query
  instead of one call per row. Semantics unchanged.
* Ten admin policies moved from `to public` to `to authenticated`. This is a
  consequence of revoking `is_admin()` from `anon`: a policy that calls a
  function anon cannot execute raises `42501` instead of returning no rows, so
  anon must never be asked to evaluate it.
* `mpesa_callbacks` keeps RLS enabled with **zero** policies, no grants to
  `anon`/`authenticated`; only the service role touches it. No policy was
  added.

## 3. Schema

* `orders.payment_status` default: `'paid'` → `'pending'`.
* `addresses.user_id` and `wishlists.user_id` are `NOT NULL` (verified 0 nulls
  first: 1 address, 0 wishlist rows).
* `wishlists_book_id_fkey` added, `ON DELETE CASCADE` (verified 0 orphans).
* `delivery_rate()` recreated as above.
* `orders.user_id` **left nullable** on purpose: 0 of 2 orders have a null
  user, and the app never inserts one (`place_order()` is the only writer and
  takes the id from the verified token), but that constraint belongs with a
  change to the money path, not this pass.

## 4. Indexes

The five requested, all `CREATE INDEX IF NOT EXISTS`, plus one more:

| Index | Table |
| --- | --- |
| `idx_admin_activity_admin_id` | `admin_activity_log (admin_id)` |
| `idx_email_outbox_order_id` | `email_outbox (order_id)` |
| `idx_mpesa_callbacks_payment` | `mpesa_callbacks (matched_payment_id)` |
| `idx_mpesa_payments_order_id` | `mpesa_payments (order_id)` |
| `idx_stock_movements_order_id` | `stock_movements (order_id)` |
| `idx_wishlists_book_id` | `wishlists (book_id)` — added with the new FK; the unique `(user_id, book_id)` key cannot serve a lookup by `book_id` alone |

Afterwards: **0** foreign keys without a leading index. No index was dropped.

## 5. Verification (live, after apply)

| Check | Result |
| --- | --- |
| Policies | 23 total; the two duplicates are gone; 0 policies call `auth.uid()`/`is_admin()` outside `(select …)` |
| `TRUNCATE` for `anon`/`authenticated` | refused on every table (`42501`) |
| `TRUNCATE` on `books` as anon | `42501 permission denied` |
| anon reads | 16 books, 1 published review, 0 profiles, 0 addresses, 0 orders |
| anon on `book_reviews` | explicit column list works; `select *` refused |
| anon on `mpesa_callbacks` | `42501` |
| Customer review update (own) | 1 row |
| Customer review update (someone else's) | 0 rows |
| Customer review delete (own / someone else's) | 1 row deleted / row survives |
| Customer insert with another user's id | `42501` new row violates RLS |
| Customer insert with `is_published` | `42501` |
| `profiles` update `first_name` | 1 row |
| `profiles` update `role` | `42501` |
| Visibility | customer sees 1 profile, admin sees all 3; customer sees 2 orders (own), another customer 0 |
| `delivery_rate()` | `search_path=public`, returns 20, `EXECUTE`: service_role only |
| Tables without RLS | 0 |
| SECURITY DEFINER functions without `search_path` | 0 |
| Row counts after tests | unchanged (1 review, 2 orders, 1 address, 0 wishlists) |

### Advisors

The Supabase MCP available in this session does not expose `get_advisors`, so
the checks it performs were run as SQL instead: RLS disabled (0), policies
without an InitPlan wrapper (0), `SECURITY DEFINER` without `search_path` (0),
foreign keys without an index (0), duplicate permissive policies (1 — see
below), and `pg_stat_user_indexes` (see below).

## 6. Leftovers

1. **Two permissive `SELECT` policies on `book_reviews` for `authenticated`**
   (`Admins can read all reviews` + `Customers read their own reviews`). They
   are not duplicates — they serve different audiences — but the performance
   advisor flags the pair. Merging them into one
   `using ((select public.is_admin()) or (select auth.uid()) = user_id)` is
   equivalent and removes the finding.
2. **`anon` still holds `INSERT` and `DELETE` on `profiles`.** No policy allows
   either (`profiles_insert_own` requires `auth.uid() = id`), so they are dead
   grants. The unapplied `20261025120000_revoke_broad_grants.sql` revokes them
   along with anon's writes on `addresses`/`wishlists`; those parts were not in
   this brief and remain unapplied.
3. **`handle_updated_at`, `protect_profile_role`, `sync_stock_label` still have
   `PUBLIC EXECUTE`.** All three are SECURITY INVOKER trigger functions, so a
   direct call runs with the caller's own privileges and fails on table access;
   revoking `PUBLIC` is hygiene, not a fix.
4. **Leaked-password protection is a dashboard setting, not SQL.** Authentication
   → Sign In / Providers → *Prevent use of leaked passwords* (HIBP). Worth doing
   together with `password_min_length = 8` and the email confirmations already
   discussed in the audit.
5. **Unused-index stats are not meaningful yet.** The database holds 1 review,
   2 orders and 1 address; almost every index reports `idx_scan = 0`,
   primary keys included. Nothing was dropped, as instructed — re-check after
   real traffic.
6. **`books` still carries both spellings**: `featured` and `is_featured`,
   `stock` and `stock_quantity`. Catalog code should read `is_featured` and
   `stock_quantity`; nothing was renamed or migrated in this pass.

## What could not be verified

* **End-to-end HTTP against production.** This sandbox cannot reach
  `bookstore-puce-sigma.vercel.app` (network allow-list), so the deployed app
  was not exercised after the change. Every RLS path the app uses was instead
  exercised in SQL under `set local role` with real JWT claims.
* **The deployed application code.** Production still runs the pre-PR build;
  these database changes are compatible with it (no route relied on a revoked
  privilege — verified by reading every `.from()`/`.rpc()` call site).
* **PostgREST round-trip.** Column-level grants combined with RLS were tested
  through SQL, not through `/rest/v1`.
