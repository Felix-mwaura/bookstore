# BookHaven security audit — 2026-10-25

Status: **in progress** (Phase 1 complete; Phase 2–4 below are filled in as work lands).

Environment note, up front, because it limits what can honestly be claimed:

- This audit ran in a sandbox with source access and package-registry access only.
  It could **not** reach `luniopceavtkljywukyi.supabase.co`, the Supabase dashboard,
  the Vercel dashboard, Daraja, or Resend. There is no `supabase`, `psql` or
  `vercel` CLI here and no Supabase credential of any kind.
- Therefore every claim about the **live** database (RLS policies, grants,
  advisors, deployed functions, Auth settings) is marked `UNVERIFIED` and backed
  by an exact SQL query or dashboard step the owner can run. Nothing in this
  report pretends that a repository migration equals the live state.
- The Git history available is a single squashed commit (`a14e69e`), so the
  "secret in history" check covers that commit only.

---

## Phase 1 — reconnaissance

### Repository shape

| Path | What it is |
| --- | --- |
| `app/` | Next.js 16 App Router (JavaScript/React) |
| `proxy.js` | Next 16 request gate (formerly `middleware`); currently `/admin` only |
| `next.config.ts` | Security headers, image allow-list |
| `supabase/migrations/*.sql` | 8 migrations, 2026-10-20 → 2026-10-23 |
| `supabase/functions/send-email/index.ts` | The only edge function in the repo |
| `scripts/*.mjs` | The test suite (`npm test`) — plain Node, no framework |

### Every API route

"Who may call it" is the **intent**; the verification column is Phase 2.

| Route | Methods | Caller | Authentication | Supabase client | Input accepted |
| --- | --- | --- | --- | --- | --- |
| `/api/admin/activity` | GET | admin | `requireAdmin()` (verified JWT → `profiles.role`) | service role | none |
| `/api/admin/agent` | GET, POST | admin | `requireAdmin()` before body parsing | service role, read-only tools | `messages[]` (≤14 entries, 4 000 chars each, 20 000 total) |
| `/api/admin/books` | GET, POST, PATCH, DELETE | admin | `requireAdmin()` | service role | whitelisted book columns; `id`; `stock_reason`, `stock_note` |
| `/api/admin/checkout-status` | GET | admin | `requireAdmin()` | service role | none |
| `/api/admin/emails` | GET, POST | admin | `requireAdmin()` | service role | none |
| `/api/admin/inventory` | GET, POST | admin | `requireAdmin()` | service role | `book_id`, `quantity`, `reason` (enum), `note` |
| `/api/admin/metrics` | GET | admin | `requireAdmin()` | service role | `from`, `to` ISO dates, ≤400-day span |
| `/api/admin/orders` | GET, PATCH | admin | `requireAdmin()` | service role | `id`, `status` (enum), `courier`, `tracking_ref` |
| `/api/admin/orders/bulk` | POST | admin | `requireAdmin()` | service role | `ids[]` ≤100 UUIDs, `status`, `courier` |
| `/api/admin/orders/payment` | PATCH | admin | `requireAdmin()` | service role | `id`, payment `status` (enum), `payment_ref` |
| `/api/admin/payments` | GET | admin | `requireAdmin()` | service role | `status` filter |
| `/api/admin/reviews` | GET, PATCH, DELETE, POST(405) | admin | `requireAdmin()` | service role | filters; `id`, `is_published` |
| `/api/admin/users` | GET, PATCH | admin | `requireAdmin()` + owner/last-admin guards | service role | `id`, `role` ∈ {admin, customer} |
| `/api/adresses` | GET, POST, PATCH, DELETE | signed-in customer | Bearer token verified with `auth.getUser()` | anon key **+ caller JWT** (RLS) | address fields (whitelist), `id` |
| `/api/mpesa/stk` | POST | signed-in customer | Bearer token verified | service role (writes intent) | `phone`, `items[{id,quantity}]`; **amount never accepted** |
| `/api/mpesa/callback` | POST, GET | public / Safaricom | none (by design) — five verification checks + Daraja query | service role | Safaricom envelope |
| `/api/mpesa/query` | POST | signed-in customer | Bearer token verified; payment must belong to caller | service role + Daraja | `checkoutRequestId` |
| `/api/mpesa/status` | GET | public | none | none | none |
| `/api/mpesa/token` | GET | admin | `requireAdmin()` | server-only key material | none |
| `/api/newsletter` | POST | public | none (honeypot, per-instance IP limit) | service role | `email`, `company` (honeypot) |
| `/api/orders` | GET, POST | signed-in customer | Bearer token verified; GET scoped to `user.id` | GET: anon + JWT; POST: service role | `items`, `deliveryDetails`, `paymentMethod`, `checkoutRequestId`, `idempotencyKey` |
| `/api/wishlist` | GET, POST, DELETE | signed-in customer | Bearer token verified; queries scoped to `user.id` | anon key + JWT (RLS) | `bookId` |

### Server components that read data

| File | Reads with | Notes |
| --- | --- | --- |
| `app/page.js` | anon/REST (catalogue helpers) | ISR (`revalidate = 60`) |
| `app/books/page.js`, `app/category/[slug]/page.js` | anon/REST | `force-dynamic` |
| `app/books/[slug]/page.js` | anon + caller cookies for `my_book_review()` | `force-dynamic`; builds JSON-LD from **database** fields |
| `app/orders/[id]/page.js` | caller JWT (RLS) | 404 on someone else's id |
| `app/account/page.js` | caller JWT (RLS) | profile + orders + addresses |
| `app/admin/page.js` | caller JWT (RLS) | **server-side** admin gate, not proxy-only |
| `app/sitemap.js` | anon/REST | `revalidate = 3600` |

### `proxy.js`

Runs only on `/admin*` (`matcher: ["/admin", "/admin/:path*"]`). It verifies the
JWT with `auth.getUser()` and checks `profiles.role === "admin"`, redirecting to
`/login` or `/access-denied`. It is explicitly documented as a UX gate, not the
security boundary; `app/admin/page.js` re-checks and every `/api/admin/*` route
calls `requireAdmin()`. That layering is correct.

### Where the service-role key is used

`app/lib/server.js#serviceClient()` and `app/lib/email-dispatch.js` are the only
places that read `SUPABASE_SERVICE_ROLE_KEY`. Callers:

- API routes: `mpesa/stk`, `mpesa/query`, `mpesa/callback`, `orders`, `newsletter`
- Library: `admin-auth.js` (the admin check itself), `mpesa-availability.js`,
  `email-dispatch.js`

No file marked `"use client"` imports any of them; no `NEXT_PUBLIC_*` variable
name contains `KEY`, `SECRET` or `PASS`. The key is read in Node runtime modules
only. `send-email` runs in Deno and reads its own copy of the key from function
secrets.

---

## Phase 1 plan (the changes this audit will make)

Ordered, smallest-first, each its own commit. Anything that touches the database
or a dashboard is **prepared, not applied**.

1. `security: reject open redirects after login` — parse with `new URL()` against
   a dummy origin, reject control characters/backslashes, keep pathname+search.
2. `security: escape JSON-LD and bound admin book fields` — one serialiser used
   by every `application/ld+json` tag; length/type caps on the admin book form.
3. `security: cap admin request bodies` — `readJsonBody()` everywhere, null-safe
   body handling, string caps.
4. `security: add a nonce-based script-src` — nonce per request for dynamically
   rendered pages, documented weaker policy for ISR/static pages; CSP moved out
   of `next.config.ts` so only one policy is sent.
5. `security: limit cash-on-delivery hoarding` — per-order quantity cap already
   exists (50); add max open COD orders per account, and auto-cancel plumbing.
   DB backstop + scheduler in a **new migration, not applied**.
6. `security: bind M-Pesa STK pushes to a phone` — store the phone on the intent,
   rate-limit per phone as well as per account.
7. `security: require a secret token on the M-Pesa callback` — optional
   `MPESA_CALLBACK_TOKEN`, constant-time compare, automatic append to the push
   URL, redacted in diagnostics.
8. `security: fail loudly on missing production configuration` — production
   builds refuse to start without the Supabase/Site variables; dev and previews
   keep working.
9. `security: stop advertising wildcard CORS from send-email`.
10. Migrations (not applied): over-broad grants, `delivery_rate()` search path,
    COD limits/auto-cancel.
11. Documentation: this file, plus corrections to `AUDIT_PHASE4.md`.

Verification at every step: `npm run lint`, the relevant script, then a full
`npm test` against a local production build, then `npm run build`.
