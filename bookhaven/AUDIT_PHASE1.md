# BookHaven — Phase 1 audit and remediation

Scope: stabilise authentication/authorization, book management, order
management, database integrity and deployment configuration.
Audited against the live Supabase project (`luniopceavtkljywukyi`) and the
code in this repository. No database rows were modified during the audit
(every probe ran inside a transaction that was rolled back).

## What was already correct

- Row Level Security is enabled on all seven public tables.
- `orders` were already readable only by their owner or an admin; `profiles`
  only by their owner.
- `place_order()` already locked book rows, validated stock, re-priced from
  the catalogue, and refused unverified M-Pesa payments.
- The `protect_profile_role()` trigger blocks role self-promotion.
- Book create/edit/archive/delete plus cover upload were already coherent:
  upload first, then the row; the uploaded file is removed if the DB write
  fails; the old cover is removed after a successful replace. The bucket
  (`book-covers`) is public-read, 2 MB, JPEG/PNG/WebP — matching the client
  constants exactly.
- The admin activity log is written on sensitive actions.
- `books` and `orders` are already in the `supabase_realtime` publication.
- The React "missing key" warning described in the brief is **not
  reproducible** in the current orders table: each row is wrapped in a
  `<Fragment key={order.id}>`.

## Confirmed defects

| # | Severity | Defect | Evidence |
|---|---|---|---|
| 1 | High | `app/middleware.js` never executed. Next.js requires the file at the project root, and Next 16 renamed the convention to `proxy.js`. `/admin` therefore had no request-level gate. | Next 16 docs: `proxy.js` at project root |
| 2 | High | `GET /api/mpesa/token` returned a Daraja OAuth token to **any anonymous caller**. | Route had no auth check |
| 3 | High | `POST /api/mpesa/stk` was unauthenticated and trusted a client-supplied `amount`, so anyone could trigger pushes to arbitrary numbers for any amount. | Route read `phone/amount/orderId` from the body |
| 4 | Critical | `POST /api/mpesa/callback` **inserted** `mpesa_payments` rows from an unauthenticated request and then updated `orders` directly. A forged success payload could mint a "completed" payment; real successful callbacks never set `user_id` or `expected_amount`, so `place_order()` rejected every M-Pesa order. | Callback inserts with no `user_id`; all 4 stored payments have null amounts |
| 5 | High | `/api/wishlist` and `/api/addresses` never attached the caller's JWT, so every query ran as the `anon` role: reads silently returned nothing, writes were rejected. `PATCH /api/addresses` spread `...rest` into the update, allowing `user_id` to be reassigned. | Route built a plain `createClient` |
| 6 | High | `orders.total` stored **only the item subtotal**; the delivery fee was dropped. The checkout UI showed subtotal + delivery, plus a KSh 50 COD fee that was never stored anywhere. | `place_order` inserted `v_subtotal`; all 6 orders have `total = items_subtotal` |
| 7 | High | No duplicate-submission protection. A double click created two orders and decremented stock twice. | No idempotency key |
| 8 | High | `PATCH /api/admin/orders` did read-then-write with no row lock and no transition rules. Concurrent cancels could restock twice; invalid transitions (Delivered → Processing) were accepted. | Code read `existing` then updated separately |
| 9 | Medium | Admin order UI offered all four statuses at all times, including backwards moves. | `<select>` rendered a fixed list |
| 10 | Medium | `decrement_book_stock()` was broken (`stock` is text, `stock - quantity` is invalid) and unused. | Function definition |
| 11 | Medium | `app/admin/page.js` threw a 500 whenever `ADMIN_EMAIL` was unset, used `getSession()` (a cookie decode, not verification) and `.single()` for the profile. | Page source |
| 12 | Medium | Card payments were simulated: clicking "Pay" ran `setTimeout(…, 3000)` and reported success without any gateway. | `CardFlow` |
| 13 | Medium | Confirmation showed a random client-generated `BH-XXXXX` as the "Order ID" (not the saved order), claimed an email had been sent, and displayed the phantom COD fee. | `generateOrderId()` |
| 14 | Low | Profile lookups used `.single()` in the proxy/login/admin paths, raising PGRST116 for users without a profile. | Four call sites |
| 15 | Low | `/api/orders` accepted `total` from the body and echoed raw database errors to the client. | Route source |

## Changes made

### Database (migration `phase1_order_integrity_and_security`, additive)

- `orders`: added `subtotal`, `delivery_fee`, `cod_fee`, `idempotency_key`,
  `updated_at`. Existing rows backfilled (`subtotal = total`), so historical
  totals are unchanged.
- Unique partial index `(user_id, idempotency_key)`; index on
  `checkout_request_id`; `replica identity full` on `books` and `orders`.
- One-default-address partial unique index (after de-duplicating any existing
  defaults).
- `CHECK (price >= 0)` and `CHECK (low_stock_threshold >= 1)` on `books`.
- `place_order()` replaced: server-computed `subtotal/delivery/total`,
  idempotent replay, amount-verified M-Pesa, validated delivery details.
  Service-role only.
- `set_order_status()` added: row lock, transition rules
  (Processing → Shipped/Cancelled, Shipped → Delivered/Cancelled; Delivered
  and Cancelled terminal), exactly one restock on cancellation, activity log
  in the same transaction. Service-role only.
- Dropped the broken `decrement_book_stock()`.
- Dropped the `orders` UPDATE policy: browsers can no longer write orders
  directly, only read them.

### Application

| File | Change |
|---|---|
| `proxy.js` (new) | Root-level Next 16 proxy; verified `getUser()`, `maybeSingle()` role check, fixed cookie `setAll` (the old code rebuilt the response inside the loop and dropped cookies). |
| `app/middleware.js` (deleted) | Was never executed. |
| `app/lib/supabase-config.js` (new) | One place for the public URL/anon key, env-first with a safe fallback. |
| `app/lib/server.js` (new) | `serviceClient()`, `clientForToken()`, `bearerToken()`, `userFromRequest()`. |
| `app/lib/supabase.js` | Uses the shared public config. |
| `app/lib/admin-auth.js` | Service client from the helper; clear 500 when the service key is missing; `maybeSingle()`; role-based only. |
| `app/admin/page.js` | No hard `ADMIN_EMAIL` failure; verified `getUser()`; `maybeSingle()`; redirects to `/access-denied`; explicit config error if the service key is absent. |
| `app/api/admin/orders/route.js` | Calls `set_order_status()`; maps invalid transitions to 409 with a readable message; no direct table writes. |
| `app/api/orders/route.js` | Rejects `total` entirely; normalises items; validates delivery details; sends an idempotency key; maps stock/payment errors to clear codes. |
| `app/api/mpesa/stk/route.js` | Requires a session; prices the cart with `quote_cart()`; records a pending payment (user + expected amount) before returning; 5-attempts/10-minutes guard; sandbox/production switch. |
| `app/api/mpesa/callback/route.js` | Update-only, never inserts; amount check; idempotent; never touches `orders`. |
| `app/api/mpesa/query/route.js` | Requires a session; only the owner's checkout id; asks Safaricom and reconciles the row. |
| `app/api/mpesa/token/route.js` | Admin-only connectivity check; the token never leaves the server. |
| `app/api/wishlist/route.js` | Attaches the caller's JWT; validates `bookId`. |
| `app/api/addresses/route.js` | Attaches the caller's JWT; whitelists writable fields; validates input. |
| `app/checkout/page.js` | Sign-in gate before payment; `idempotencyKey`; M-Pesa sends items, not an amount; real saved order id on confirmation; server totals; COD surcharge removed; fake card flow removed; cart cleared only after a successful save; retry path when saving fails. |
| `app/admin/admin-client.js` | Status control only offers transitions the server accepts; terminal states are read-only; cancellation copy no longer says it can be reversed. |
| `app/login/page.js` | `maybeSingle()` for the role lookup. |
| `.env.example`, `README.md`, `.gitignore` | Documented every variable, deployment steps and the security model. |

## Verification performed

**Database** (single transaction, rolled back):

1. `place_order` computed subtotal 2,598 + delivery 300 = total 2,898. ✅
2. Stock decremented by the ordered quantity. ✅
3. Same idempotency key returned the original order, stock unchanged. ✅
4. `Processing → Delivered` rejected (`INVALID_TRANSITION`). ✅
5. `Processing → Cancelled` restored stock exactly to its original value. ✅
6. `Cancelled → Processing` rejected (no reopen). ✅
7. No double restock after the rejected reopen. ✅
8. Empty delivery details rejected. ✅
9. M-Pesa without a verified payment rejected. ✅

**Build:** `next build` (webpack, Google Fonts mocked) succeeds; 20 routes plus
the proxy are compiled.

**Lint:** changed files are clean apart from pre-existing warnings. See
"Not verified" for the remaining repo-wide issues.

## Not verified / blockers

- **Live M-Pesa calls.** No Daraja credentials exist in this workspace. The
  sandbox flow must be tested with real keys and a public callback URL.
- **Turbopack build.** This sandbox cannot reach `fonts.googleapis.com`, so the
  default build fails at `next/font` for Inter and Playfair Display. That is
  an environment restriction, not an application defect — it will resolve on
  Vercel. The webpack build with mocked font responses validates the code.
- **Browser end-to-end flows.** No browser automation was available here;
  checkout, admin uploads and cancellation should be exercised manually against
  a preview deployment.
- **Repo-wide lint debt.** `app/admin/admin-client.js` and `app/login/page.js`
  still report pre-existing `react-hooks/set-state-in-effect` and unescaped
  entity errors that predate this work. They do not block `next build`.
- **Phase 2 items** (realtime UI subscriptions, bulk operations, email
  notifications, richer metrics) are intentionally out of scope.

## Post-deploy fix (2026-10-20)

The first deployment of Phase 1 made `/admin` return a server error on any
environment without `SUPABASE_SERVICE_ROLE_KEY`.

- **Cause:** the page threw an explicit configuration error when that variable
  was missing. Every variable in the Vercel project is scoped to **Production
  only**, so preview deployments always lacked it.
- **Fix:** the dashboard now renders using the admin's own JWT and Row Level
  Security. A new `is_admin()` SECURITY DEFINER helper backs an
  "Admins can read all profiles" policy, which is what previously forced the
  service-role dependency. The service role is now needed only for mutations.
- **Also fixed:** `sync_user_email()` updated `profiles.email`, a column that
  did not exist, so any email change failed inside the auth trigger. Added and
  backfilled the column.
- **UX:** added `app/admin/error.js` so a future failure shows a readable
  message plus the log digest instead of a blank error page, and a read-only
  banner when mutations are unavailable.

Verified by simulating both roles against RLS: admin sees 6 orders / 5
profiles / 13 books, customer sees 2 orders and only their own profile.

## Recommended next step

Deploy this branch to a Vercel preview with the production environment
variables, then run the manual regression checklist: admin login, book create +
cover upload, COD order, M-Pesa sandbox order, cancellation/restock, and a
cross-account order-access attempt. Once that passes, begin Phase 2.
