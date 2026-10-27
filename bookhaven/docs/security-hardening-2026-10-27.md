# Security hardening — 27 October 2026

Second round of fixes, following the audit of 25 October
(`docs/security-audit-2026-10-25.md`). Same rules as that round: smallest
change per item, no restyling, no dependency added, and nothing applied to the
live project without an explicit go-ahead.

The five items, what changed, and what proves it.

---

## 1 · Rate limiting that survives a cold start — SEC-16

The newsletter and the admin assistant counted requests in a module-level
`Map`. On Vercel every instance has its own copy and instances come and go, so
"5 per 10 minutes" was really "5 per instance, until the instance is recycled".

`app/lib/rate-limit.js` keeps the same numbers and moves the counter out of the
process:

| endpoint | scope | limit |
| --- | --- | --- |
| `POST /api/newsletter` | `newsletter` | 5 per 10 min per connection |
| `POST /api/admin/agent` | `admin-agent` | 20 per 10 min per admin |

Two backends, neither a new dependency:

* **Upstash Redis** when `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are set — one `INCR` / `EXPIRE NX` / `TTL`
  pipeline over REST, 1.5 s timeout. Preferred, because the counter stays off
  the database.
* **Supabase** otherwise — migration `20261025130000_rate_limit_store.sql`
  adds a `rate_limits` table and one `SECURITY DEFINER` function
  (`check_rate_limit`) that increments atomically. RLS is on, `anon` and
  `authenticated` have no grants, and `service_role` gets an explicit
  `EXECUTE` — it inherits nothing, so revoking the default `PUBLIC` grant
  would otherwise take the function away from the one caller that needs it
  (same grant as `set_order_status`/`place_order`).

Identifiers are SHA-256 pseudonyms before they leave the process
(`bh:rl:<scope>:<32 hex>`): a counter needs a stable key, not an IP address or a
phone number on record. `checkRateLimit()` never throws — it returns
`{ limited, retryAfterSeconds, store, configured, available, reason }` and
leaves the decision to the caller, because the right answer differs:

* **newsletter fails open.** A broken counter must not stop a reader
  subscribing; the worst case is a few unthrottled addresses.
* **admin assistant fails closed** (503) once a store is configured but
  unavailable — every turn is a paid provider call, so refusing is cheaper
  than guessing.
* **unconfigured store allows both** and logs the one-line fix once. Nothing
  behaves differently until the migration is applied or Upstash is added.

**M-Pesa was deliberately not changed.** `app/api/mpesa/stk/route.js` counts
real `mpesa_payments` rows per account and per phone — already durable, and
already the thing that must not be bypassed. Switching it to a generic
counter would let a failed insert escape the limit it used to count. The money
path is untouched.

Test: `scripts/security-rate-limit-smoke.mjs` (36 cases). It drives the helper
with injected transports — allowed, limited, TTL fallback, 5xx, network error,
missing function, empty result, the 60 s cooldown after a failure — then sweeps
the two routes for a leftover `Map`, and confirms `stk` still limits per
account and per phone. It also asserts the migration itself grants `EXECUTE`
to `service_role` and to no end-user role — the failure that would only appear
after applying it.

> **Needs approval:** the migration is written, reviewed and **not applied**.
> Until it is, or Upstash is configured, both endpoints behave exactly as they
> did before (allowed, with a warning in the log).

---

## 2 · Newsletter hardening

* **The honeypot was dead code.** The route rejected a filled `company` field
  that the form never sent. The form now carries one — hidden with
  `sr-only`, `aria-hidden`, `tabIndex={-1}`, `autoComplete="off"` — and posts
  it. A bot that fills every input it finds gets `{ ok: true }` and learns
  nothing.
* **Throwaway inboxes** are refused (six domains: mailinator, guerrillamail,
  10minutemail, tempmail, trashmail, yopmail). Short on purpose: refusing a
  real corporate domain costs more than accepting a disposable one.
* **No database text** ever leaves the route. A real failure logs the Postgres
  code and message server-side and answers "We could not save your address.
  Please try again."
* **A duplicate is still a success** (`23505`). Telling a stranger they are
  already subscribed tells them who is on the list.

Test: `scripts/security-newsletter-smoke.mjs` — over HTTP against a running
server, including a genuine duplicate (same address twice → one row, success
both times). It refuses a non-local host without `SMOKE_ALLOW_WRITES=1`,
because unlike the rest of the suite it writes.

---

## 3 · Error responses

Seventeen response paths returned `{ error: error.message }`. Those strings
name tables, columns and constraints — a free schema map — and read like a
crash rather than an answer.

`app/lib/api-error.js` now does both halves in one call: log the real error
(route, Postgres code, message, details, hint, plus non-sensitive context such
as a book id) and answer with a short sentence. Duplicates map to 409 with no
detail. Covered routes:

`/api/orders`, `/api/addresses`, `/api/wishlist`, `/api/newsletter`,
`/api/admin/{activity,books,orders,users}`.

It builds a plain `Response` rather than `NextResponse` — a route handler may
return either, `Response.json` exists in both runtimes, and it keeps the module
importable from a plain `node` test instead of only from the bundler.

Test: `scripts/security-errors-smoke.mjs` (23 routes swept). It asserts the
browser gets the fallback with no table, column or SQL text, that the real
error is logged exactly once with its code and route, the 23505 → 409 mapping,
odd error shapes, and — since the M-Pesa route logs an `error` field on
purpose — that the sweep can tell a response from a log line.

Left alone deliberately: `app/api/mpesa/*` and `/api/orders` still *parse*
`error.message` to recognise their own `RAISE EXCEPTION` markers
(`INSUFFICIENT_STOCK:…`, `ORDER_NOT_FOUND`, …). Those markers are mapped to
customer sentences already; the parsing is not a leak and the money path was
not touched.

---

## 4 · `adresses` → `addresses`

`app/api/adresses` is now `app/api/addresses`. Seven client calls updated
(`app/checkout/page.js` ×2, `app/components/AddressBook.js` ×5), two docs
corrected. Three raw `request.json()` calls in the route went through
`readJsonBody()` (8 KB) at the same time.

The misspelled path survives as a three-line re-export, because a browser
holding a bundle from the previous deployment would otherwise get a 404 in the
middle of saving an address — a silent loss of what the customer just typed.
The alias can be deleted once no cached bundle is expected.

---

## 5 · Defensive cleanups

* `request.json()` now appears in exactly one place:
  `app/api/mpesa/callback/route.js`, which caps the body with
  `exceedsBodyLimit(CALLBACK_BODY)` first and must keep acknowledging anything
  Safaricom sends. Everything else uses `readJsonBody`/`readJsonObject`.
* `/api/mpesa/status` is public and answers only `{ enabled, environment }`.
  Now asserted, not assumed: the key set is compared and the body is swept for
  `shortcode|consumer|passkey|callback|secret`.
* `/api/mpesa/token` is admin-only and returns no token, secret or password —
  also asserted.

Test: `scripts/smoke.mjs`, six new live checks (42 total).

---

## Files

**Created**

| Path | Why |
| --- | --- |
| `app/lib/rate-limit.js` | shared limiter, Upstash + Supabase backends |
| `app/lib/api-error.js` | log the real error, answer with a sentence |
| `supabase/migrations/20261025130000_rate_limit_store.sql` | counter table + `check_rate_limit()` — **not applied** |
| `app/api/addresses/route.js` | the address route, correctly spelled |
| `scripts/security-rate-limit-smoke.mjs` | 36 cases, injected transports + migration grants |
| `scripts/security-errors-smoke.mjs` | 23 routes swept |
| `scripts/security-newsletter-smoke.mjs` | live HTTP, real duplicate |
| `docs/security-hardening-2026-10-27.md` | this file |

**Modified**

| Path | What |
| --- | --- |
| `app/api/newsletter/route.js` | shared limiter, disposable domains, no DB text, 429 + `Retry-After` |
| `app/api/admin/agent/route.js` | shared limiter, fails closed (503) on a configured-but-broken store |
| `app/api/adresses/route.js` | now a re-export alias |
| `app/api/orders/route.js`, `app/api/wishlist/route.js` | `dbErrorResponse`; wishlist bodies via `readJsonBody` |
| `app/api/admin/{activity,books,orders,users}/route.js` | `dbErrorResponse` |
| `app/components/HomeClient.js` | honeypot field, posted with the sign-up |
| `app/components/AddressBook.js`, `app/checkout/page.js` | `/api/addresses` |
| `scripts/smoke.mjs` | M-Pesa narrowness + alias checks |
| `package.json` | `security:ratelimit`, `security:errors`, `security:newsletter` wired into `npm test` |
| `AUDIT_PHASE1.md`, `docs/store-refinement-2026-10-23.md` | corrected path |

## New environment variables

Both optional, both server-only:

| Variable | Effect when set | Effect when unset |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | rate limiting uses Upstash Redis | falls through to Supabase |
| `UPSTASH_REDIS_REST_TOKEN` | paired credential for the above | falls through to Supabase |

No `NEXT_PUBLIC_` variable was added, so nothing reaches the browser bundle.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 7 warnings (all pre-existing) |
| `npm run build` | 30 routes, both `/api/addresses` and `/api/adresses` present |
| `npm test` | **exit 0** — 12 suites, including the three new ones |
| `scripts/smoke.mjs` | 42 checks passed (25 + 9 skipped before) |
| newsletter, live | duplicate address → one row, `{ ok: true }` twice |
| not verified | Upstash backend against a real Redis; `check_rate_limit` against a real Postgres (migration unapplied); any browser-level test (no headed browser here) |

## Follow-ups, outside this change

1. **Apply `20261025130000_rate_limit_store.sql`** (or add Upstash) — until
   then the two limiter numbers are still per instance.
2. The three round-1 migrations are still unapplied; the audit's order stands:
   phone index → grants → `search_path`.
3. `rate_limits` grows by one row per distinct client per window. The function
   sweeps 2 % of expired rows per call, which is enough at this traffic. If it
   ever is not, a nightly delete is the next step, not a schema change.
4. `INSUFFICIENT_STOCK`-style parsing in `/api/orders` is string matching on a
   `RAISE EXCEPTION` payload. It works and is tested; moving it to a returned
   JSON row would be a cleaner contract, but that is a schema change to the
   money path and belongs in its own change.
5. Wire `npm test` into CI (unchanged from the audit: there is no workflow
   file in this repo yet).
