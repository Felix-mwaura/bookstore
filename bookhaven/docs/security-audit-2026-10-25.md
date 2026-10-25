# Book Haven — Security Audit & Remediation

**Date:** 25 October 2026
**Scope:** `bookhaven/` (Next.js 16 App Router), `supabase/` (SQL + edge functions), the live Supabase project `luniopceavtkljywukyi`, and the Vercel deployment `bookstore-puce-sigma.vercel.app`
**Base:** `a14e69e` (production, PR #54)
**Branch:** `arena/e37eff10-bookstore` (the session's branch; no commit touches `main`, PR #55 carries the work)
**Method:** source review of every route/handler, read-only SQL against the live database, live edge-function listing, and a local production build exercise

> **Nothing was applied, deployed or changed outside the repository.** The three migrations in §7 are new files and have **not** been run against the live database. No edge function was deployed. No Supabase Auth setting and no Vercel environment variable was changed. The live database was read only (`SELECT`, `information_schema`, function/trigger definitions, edge-function listing).

---

## 1. Executive summary

The audit produced seventeen rows: **eight code fixes** (each with a regression test), **one documentation correction**, **two migrations written but not applied**, **one item reviewed and deliberately left unchanged** (the read-only admin assistant), and **five that need your decision** — the CSP `script-src` tradeoff, the out-of-repo `welcome-email` function, the Supabase Auth settings, the migration drift, and the per-instance limiter I accepted. The two that would have hurt most were a **stored XSS** — any book title containing `</script>` broke out of the structured-data block on a public page — and an **open redirect** on the real sign-in page, where `/	/evil.com` survived the old prefix check and sent the browser to `https://evil.com/`. Payments held up well: the amount is always recomputed on the server, a callback must match a stored intent, the exact amount, a receipt and Safaricom's own STK query, and replay is blocked — what was missing was that the payer's phone number was never stored, so a per-number abuse limit was impossible, and COD had no limit at all, so stock could be held hostage indefinitely. The database's row-level security is sound but its *grants* are not: `anon` and `authenticated` hold `TRUNCATE`, `TRIGGER` and `REFERENCES` on every table and full DML on several, which is one policy mistake away from being exploitable. Nothing was applied, deployed or reconfigured: the migrations, the `welcome-email` function and the Auth settings all need your explicit approval before they touch production.

---

## 2. What was verified, and how

| Area | Method | Result |
| --- | --- | --- |
| Route inventory | `find app/api -name route.js` + read every file | 22 route files (13 admin, 4 M-Pesa, 5 user/public) |
| Authorization | read every handler; grep for `requireAdmin` | all 13 admin handlers call `requireAdmin(request)` as their first statement |
| Live schema | `pg_class`, `pg_policies`, `information_schema.role_table_grants`, `pg_indexes`, `pg_proc`, `pg_trigger`, `pg_get_functiondef` | 12 tables, 25 policies, 23 functions, 26 indexes |
| Live migration history | `supabase_migrations.schema_migrations` | 17 applied vs 8 files at `a14e69e` (§5, item B5) |
| Edge functions | `list_edge_functions` + `get_edge_function` | 2 deployed: `send-email` (`verify_jwt: true`), **`welcome-email` (`verify_jwt: false`, not in repo)** |
| Auth settings | `get_auth_config` | reported only (§6, item J) |
| Dependencies | `npm audit --omit=dev` | 0 vulnerabilities (next 16.4.2, react 19.2.4) |
| Secrets in git | `git ls-files`, `git log --diff-filter=A`, pattern grep over the working tree and full history | only `.env.example` (placeholders); no `.env`, `.pem` or live key was ever committed |
| Build | `next build` (Next 16.4.2) | compiled, all routes generated (chart in §8) |
| Rendered pages | `node scripts/smoke.mjs` against a local production build | 25 passed, 9 skipped (no service-role key locally) |
| Unit/regression suite | `npm test` | passes, including 8 new security tests (§8) |
| Live HTTP probes | local `next start` + fixture catalogue | JSON-LD parses on a book page; unsafe `?next=` values produce **no** `next=` link (§5.1) |

**Environment limitations that shape these claims.** No headed browser with a real mouse was available (the sandbox has no display server), so nothing here is a claim about Safari or Firefox. The live production site cannot be driven from the sandbox's browser; production was only read through the `fetch_page` tool in earlier sessions. The Deno runtime is not installed, so the edge functions were reviewed and source-asserted, not executed. The SQL was reviewed line by line but not executed anywhere — see §7.

---

## 3. Findings

Severity: **Critical** (exploitable now, severe impact) · **High** (exploitable with modest effort or a plausible path) · **Medium** (needs a condition, or defence-in-depth with real value) · **Low** · **Info**.

| ID | Sev | Location (at `a14e69e`) | Finding | Evidence | Status | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | **High** | `app/login/page.js:20-23` | Open redirect on the sign-in page | `/\t/evil.com`, `/\n/evil.com`, `/\r/evil.com` pass the prefix check and resolve to `https://evil.com/` | **Fixed** | `f61dc21` |
| SEC-02 | **High** | `app/books/[slug]/page.js:151-152`, `app/layout.js:84,88` | Stored XSS via JSON-LD | `JSON.stringify(...)` into `dangerouslySetInnerHTML`; a title containing `</script>` closes the block and opens a real script element | **Fixed** | `e0a13f8` |
| SEC-03 | Medium | 10 sites in `app/api/admin/**` | Admin bodies: `null` crashes, no size cap, no string length caps | `await request.json()` → `null` → `body.title` throws (500); a 2 MB title was accepted | **Fixed** | `7e49c48` |
| SEC-04 | Medium | `app/api/mpesa/stk/route.js:186-194` | STK never stored the payer phone; no per-number limit | `mpesa_payments.phone` exists but was never written; only 5 pushes/10 min per account | **Fixed** | `7ba8696` |
| SEC-05 | Medium | `app/api/mpesa/callback/route.js` | Callback accepted anyone | No shared secret, no path token, no IP allow-list; each call costs DB reads + a Daraja query | **Fixed** (opt-in) | `db09561` |
| SEC-06 | Medium | `app/lib/supabase-config.js:10,14`, `app/lib/site.js:9`, `next.config.ts:7`, `send-email:18` | Hard-coded production fallbacks | Real project URL + real anon JWT as fallbacks; a checkout without `.env.local` silently used the live database | **Fixed** | `2acb82f` |
| SEC-07 | Medium | `app/api/orders/route.js` | COD stock hoarding | 50 copies/line, unlimited open COD orders; COD reserves stock without payment | **Fixed** | `75f04e5` |
| SEC-08 | **High** | live grants | Browser roles hold unused, dangerous privileges | `anon`+`authenticated`: `TRUNCATE`,`TRIGGER`,`REFERENCES` on every table; full DML on `addresses`,`wishlists`,`admin_activity_log`,`stock_movements`,`email_outbox`; `INSERT`,`DELETE` on `profiles`; full DML on the `book_rating_summary` view | **Migration written, not applied** | `ef937fe` |
| SEC-09 | Low | live `public.delivery_rate()` | Only function without a pinned `search_path` | `proconfig` is empty; `SECURITY INVOKER`, returns the constant 20 | **Migration written, not applied** | `ef937fe` |
| SEC-10 | Low | `supabase/functions/send-email/index.ts:21-26` | Wildcard CORS on a service-role endpoint | `Access-Control-Allow-Origin: *` | **Fixed in repo, not deployed** | `77a2695` |
| SEC-11 | Low | `next.config.ts:24-27` | CSP has no `script-src` | Policy is `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` | **Open — documented tradeoff** (§5.11) | — |
| SEC-12 | Medium | Supabase edge function `welcome-email` v2 | Unauthenticated, out-of-repo function | `verify_jwt: false`; called by `on_auth_user_created_send_welcome` with `{"user_id": …}` and no `Authorization`; the body takes `user_id` from the caller | **Report only** (§5.12) | — |
| SEC-13 | Info | `AUDIT_PHASE4.md:120,133,129` | Stale audit claims | "No `dangerouslySetInnerHTML` on user data", "callback cannot be forged (…) amount ≥ expected" and "CSP (D14) open" now read as if the issues were absent/covered | **Fixed** | see `AUDIT_PHASE4.md` banner |
| SEC-14 | Medium | Supabase Auth settings | Production auth configuration is a development one | `site_url: http://localhost:3000`, `webauthn_rp_id: localhost`, `mailer_autoconfirm: true`, `password_min_length: 6`, HIBP off, captcha off, no session timeout | **Report only — needs your approval** (§6 J) | — |
| SEC-15 | Info | migrations | Provenance drift | 17 applied vs 8 files; 13 applied names have no same-named file, 4 files have no same-named applied row | **Reported** (§5 B5) | — |
| SEC-16 | Low | `app/api/admin/agent/route.js:18-33` | Rate limit is per serverless instance | module-level `Map`, 20 turns/10 min per admin | **Accepted** (low value target, admin-only) | — |
| SEC-17 | Info | `app/api/admin/agent/*` | AI assistant is read-only and renders text | tools expose only SELECT-shaped helpers + `admin_dashboard_metrics`; no write tool; output rendered as React text | **PASS, no change** | — |

### What was already right (do not regress these)

* **Every** `/api/admin/*` handler calls `requireAdmin()` first; it resolves the token with `adminClient.auth.getUser(token)` (signature verified server-side) and then reads `profiles.role` with the service client. `proxy.js` merely redirects browsers and says so.
* Customer routes take the user id from a verified token, never from the body (`clientForToken`, `userFromRequest`).
* `profiles.role` cannot be escalated: `protect_profile_role` rejects any role change where `current_user` is not `service_role`/`postgres`/`supabase_admin` (verified live).
* M-Pesa pricing is server-authoritative (`stk` recomputes from `books` + `deliveryFeeFor`; `place_order` recomputes again), and a callback needs a stored intent, the matching `merchant_request_id`, an exact amount, a receipt matching `^[A-Z0-9]{6,24}$` **and** a `stkQuery` confirmation from Daraja. Receipt reuse is detected and held.
* Search inputs are sanitised before PostgREST `.or()`/`.ilike()` interpolation in all three places that use them (`app/lib/catalogue.js`, `app/api/admin/reviews/route.js`, `app/lib/admin-agent-tools.js`).
* Unique indexes exist exactly where they should: `mpesa_payments_checkout_request_id_key`, `mpesa_payments_receipt_key`, `idx_orders_user_idempotency`.
* No token is written to `localStorage` (only `bh_cart`/`bh_wishlist`) and no route logs a token value.
* `npm audit --omit=dev` reports **0** vulnerabilities.

---

## 4. Detailed findings and fixes

### SEC-01 — Open redirect on the sign-in page · High · `f61dc21`

Vulnerable (`app/login/page.js:20-23` at `a14e69e`):

```js
const raw = typeof params.next === "string" ? params.next : "";
const nextPath =
  raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw.slice(0, 300) : null;
```

A browser removes tab/LF/CR **before** it parses a URL, but JavaScript does not, so the string `"/\t/evil.com"` passes these three tests and then resolves to `https://evil.com/`. On the real sign-in page that is a phishing chain with a trustworthy first hop. Confirmed with a standalone harness: tab, LF and CR variants were accepted and resolved off-origin; `//evil.com`, `/\evil.com`, `https://evil.com` were rejected.

Fixed (`app/lib/safe-redirect.js`, used at `app/login/page.js:24`):

```js
export function safeNextPath(raw) {
  if (typeof raw !== "string" || !raw || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/")) return null;
  if (hasUnsafeCharacters(raw)) return null;          // C0 controls, DEL, U+2028/29, backslash
  const url = new URL(raw, DUMMY_ORIGIN);
  if (url.origin !== DUMMY_ORIGIN) return null;        // scheme, //host, \host
  if (decoded.startsWith("//") || hasUnsafeCharacters(decoded)) return null;  // %2F%2F, %5C
  return `${url.pathname}${url.search}${url.hash}`;    // path only, never origin
}
```

Test: `scripts/security-redirect-smoke.mjs` — 6 accepted forms, 18 rejected forms, and a regression guard that asserts the *old* expression still would have accepted the three control-character payloads.

Rendered check: `GET /login?next=%2F%2Fevil.com` (and tab/CR/backslash/scheme variants) now produce **no** `next=` in any `href`; `GET /login?next=%2Fcart` still produces `href="/login?tab=register&amp;next=%2Fcart"`.

### SEC-02 — Stored XSS through JSON-LD · High · `e0a13f8`

Vulnerable (`app/books/[slug]/page.js:151-152`, `app/layout.js:84,88`):

```jsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
```

`productJsonLd` contains `name`, `author`, `description` and `isbn` straight from the `books` row. `JSON.stringify` does not escape HTML, and the HTML parser ends a `<script>` element at the first literal `</script` — even inside a JSON string. A title of `</script><script>alert(document.cookie)</script>` executes for every visitor of that page, and the title is editable from the admin form.

Fixed (`app/lib/json-ld.js`):

```js
const ESCAPES = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" };
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char]);
}
export function jsonLdProps(value) {
  return { type: "application/ld+json", dangerouslySetInnerHTML: { __html: serializeJsonLd(value) } };
}
```

`\u003c` is a valid JSON escape, so the object still parses identically while the document contains no `<` the HTML parser can act on. Test: `scripts/security-jsonld-smoke.mjs` (6 payload classes, round-trip equality, source guard against a future raw `JSON.stringify` in a script tag). Rendered check: the two blocks on `/books/deep-work-4` parse as JSON and contain no `<` or `</script`.

Only these four `dangerouslySetInnerHTML` sites existed; both are now behind the helper.

### SEC-03 — Admin request bodies · Medium · `7e49c48`

Vulnerable (10 sites, e.g. `app/api/admin/books/route.js:103`):

```js
try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
const { data: fields, error: vError } = sanitize(body, { partial: false });   // body may be null
```

`"null"` parses to `null`, and every subsequent `body.x` throws → 500. There was no size ceiling (`request.json()` parses whatever arrives) and no length limit on any string: `title`, `description`, `publisher`, `isbn`, `badge` were unbounded, so a 2 MB title would be stored and then rendered on the storefront, in JSON-LD, in the admin table and in confirmation emails.

Fixed:

* `app/lib/request-guard.js:59` — `readJsonObject()` rejects `null`, arrays, scalars and malformed JSON with **400**, and applies a byte ceiling before parsing (`8 KB`, `32 KB` for books) → 413.
* All 8 admin route files now use it (10 call sites); no admin route calls `request.json()` any more.
* `sanitize()` moved to `app/lib/book-admin.js:47` (so it is testable) with per-column ceilings (`title` 200, `author` 120, `description` 5000, …) and text-type checks; the column whitelist still drops `rating`, `reviews`, `stock` and `created_at`.

Test: `scripts/security-admin-bodies-smoke.mjs` — the six malformed bodies, the size cap, mass assignment, every length ceiling, and a sweep asserting all 13 admin routes still call `requireAdmin` and none parse a body by hand.

### SEC-04 — M-Pesa: the phone was never stored · Medium · `7ba8696`

Vulnerable (`app/api/mpesa/stk/route.js:186-194`):

```js
.insert({ user_id: user.id, expected_amount: Math.ceil(amount), status: "pending" })
```

The `phone` column exists and the route had already normalised `formattedPhone`, but it only travelled in the Daraja request. Consequences: only an account-level limit was possible (5/10 min) — a number could be rung from several accounts; the admin Payments table always showed an empty phone; and a callback naming a different number could not be compared with anything.

Fixed (`app/api/mpesa/stk/route.js:85-105,193`):

```js
const [{ count: accountAttempts }, { count: phoneAttempts }] = await Promise.all([
  db.from("mpesa_payments").select("*", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", windowStart),
  db.from("mpesa_payments").select("*", { count: "exact", head: true })
    .eq("phone", formattedPhone).gte("created_at", windowStart),
]);
const limit = mpesaAttemptVerdict({ accountAttempts, phoneAttempts });   // 5/account, 3/phone
...
.insert({ user_id: user.id, phone: formattedPhone, expected_amount: Math.ceil(amount), status: "pending" })
```

Both counts come from the database, so they survive a serverless cold start (the admin assistant's limiter, by contrast, is per instance — SEC-16). Test: `scripts/security-mpesa-limits-smoke.mjs`; the index that keeps the phone count cheap is migration `20261025122000`.

### SEC-05 — M-Pesa callback had no shared secret · Medium · `db09561`

The callback is public by necessity (Daraja does not sign callbacks), and the five body/DB checks are the real defence. But nothing distinguished Safaricom from a scanner, and every call costs a database read plus an outbound `stkQuery`.

Fixed (`app/api/mpesa/callback/route.js:31-35`, `app/lib/callback-secret.js`): when `MPESA_CALLBACK_TOKEN` is set, the value must arrive as `?k=<token>` on `MPESA_CALLBACK_URL` (or `x-callback-token`); comparison hashes both sides first so a length difference cannot throw and timing cannot leak. **Unset changes nothing** — important, because the URL already registered with Safaricom would otherwise start being refused.

Test: `scripts/security-callback-token-smoke.mjs` (unset, both carriers, prefixes, case, malformed URLs, ordering before the body is parsed).

### SEC-06 — Hard-coded production fallbacks · Medium · `2acb82f`

Vulnerable (`app/lib/supabase-config.js:10,14`):

```js
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIs…";
```

The anon key is public by design, but the *fallback* is not harmless: a checkout built without `.env.local` silently talked to the live project — reads, carts and orders included. The same pattern existed for the site URL (`app/lib/site.js:9`), the image host (`next.config.ts:7`) and the e-mail CTA (`send-email:18`).

Fixed: no literal project values remain. In production, a missing `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` throws a named error at import time, and a missing site URL throws too (falling back to `VERCEL_PROJECT_PRODUCTION_URL` first). Development still loads, because unit tests import modules that merely mention Supabase. Test: `scripts/security-config-smoke.mjs` (child-process cases plus a literal scan of the four files).

### SEC-07 — COD stock hoarding · Medium · `75f04e5`

COD is the only method that reserves stock without money. The route accepted up to 50 copies of a title per line and any number of open orders, so one account could hold the last copies off the shelf for free.

Fixed (`app/api/orders/route.js:145-163`): for `payment_method === "cod"`, 3 open COD orders per account (counted from the database, `status not in (Delivered, Cancelled)`), 5 copies per title, 15 books per order; refusal is a 429 whose message offers M-Pesa. The M-Pesa path is untouched. Test: `scripts/security-cod-smoke.mjs`.

### SEC-08 — Over-broad grants · High · migration `20261025120000` (not applied)

Live `information_schema.role_table_grants` before the fix:

```
addresses            anon, authenticated  DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
admin_activity_log   anon, authenticated  DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
profiles             anon, authenticated  DELETE,INSERT,SELECT,TRUNCATE
book_rating_summary  anon, authenticated  DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
```

RLS is enabled on all 12 tables with 25 policies and kept the rows safe (`admin_activity_log` has a SELECT-only policy, so a write attempt would have been refused). The grants are still wrong: they are the layer that survives a future policy mistake, a `SECURITY DEFINER` helper or a PostgREST feature that bypasses RLS. `book_rating_summary` is an aggregate view, so its DML grants cannot actually write — but they are noise that hides real mistakes.

The migration revokes `TRUNCATE`/`TRIGGER`/`REFERENCES` everywhere, removes all writes from `anon`, removes writes that only the service role performs (`admin_activity_log`, `email_outbox`, `stock_movements`, `mpesa_payments`, `newsletter_subscribers`, `profiles`), and re-asserts the reads and column-level `UPDATE (first_name, last_name, phone)` that the app actually uses. `authenticated` keeps row-scoped DML on `addresses` and `wishlists`, and the existing column grants on `book_reviews`.

### SEC-09 — `delivery_rate()` search_path · Low · migration `20261025121000` (not applied)

Live definition: `language sql immutable`, `proconfig` empty — the only function in the schema without a pinned `search_path`. It is `SECURITY INVOKER` and returns `20`, so the current risk is small, but it is the pricing guard in `/api/orders`, and an empty `search_path` costs nothing. `EXECUTE` is removed from `anon` and kept for `authenticated` (the route calls it through the user's client).

### SEC-10 — Wildcard CORS on `send-email` · Low · `77a2695` (not deployed)

```ts
const cors = { "Access-Control-Allow-Origin": "*", ... };
```

The function requires the service role, but any page could call it and read the response, and the header advertised the endpoint. Nothing legitimate calls it from a browser (the Next.js server and `/api/admin/emails` call it server-to-server with no `Origin`). Fixed: the origin is echoed only when it appears in `ALLOWED_ORIGINS` or equals `SITE_URL`, with `Vary: Origin` always sent and no CORS headers for server-to-server calls. The unverified JWT decode is unchanged but now documents that it is only safe because the function is deployed with `verify_jwt: true` — turning that off would make the role check meaningless.

Test: `scripts/security-edge-cors-smoke.mjs` asserts the source contract. **The Deno runtime is not available here, so the function was not executed** — see §9.

### SEC-11 — CSP without `script-src` · Low · open, documented tradeoff

Current policy: `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. It blocks framing, base-tag hijacking and foreign form posts, but not injected scripts.

A nonce policy is the correct fix and it is *not* a five-line change: `next.config.ts` headers are static per build, so the nonce has to be minted per request in `proxy.js`, which means widening the middleware matcher from `/admin*` to every page (it currently runs `getUser()` on admin routes only), reading the nonce in the root layout, and forcing every page to render dynamically — on a live store where `/books`, `/category/*` and the book pages are currently dynamic but `/checkout`, `/help`, `/privacy`, `/terms` are static. Getting it wrong breaks hydration, and a broken checkout is worse than a missing directive. I did not do it blind; the tradeoff is recorded here and the work is scoped in §10.

### SEC-12 — `welcome-email` edge function · Medium · report only

Deployed as `welcome-email` **v2, `verify_jwt: false`**, and it is not in this repository. Its source (retrieved from the live project) takes `{ user_id }` from the request body, loads that user with the **service role**, and sends a Resend email to `user.email` — subject to a `welcome_email_sent` flag in `app_metadata`. It is invoked by the trigger `on_auth_user_created_send_welcome` on `auth.users` (via `net.http_post`, no `Authorization` header), which is why JWT verification was turned off.

Consequences: anyone who knows (or guesses) a user UUID can trigger a welcome email for that account, and can call the function repeatedly for accounts that have not yet been marked. The email goes to the account's own address, so this is not a spam relay and not a data leak — it is an unauthenticated, out-of-repo function holding a service-role key, which is reason enough to bring it into the repository and give it a shared secret in the `Authorization` header (the trigger can send one via `vault.decrypted_secrets` or a hard-coded header value paired with `verify_jwt: false`). **I did not deploy or modify it** — it is not in the repo, and deploying is explicitly outside what I may do without approval.

### SEC-13 — Stale audit claims · Info

`AUDIT_PHASE4.md` said *"No `dangerouslySetInnerHTML` on user data (only the JSON-LD constants)"* — the constants interpolate live book titles, so that sentence was wrong the day it was written, and it is the reason SEC-02 was never noticed. It also described the callback as accepting `amount ≥ expected_amount` (the code compares exactly) and listed the CSP as an open item without saying what it does and does not cover. The file now carries a banner pointing at this report plus inline corrections (§"AUDIT_PHASE4 corrections").

---

## 5. Phase 2 checklist

**A. Authentication and authorization**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| A1 | `requireAdmin` on every `/api/admin/*` | **PASS** | 13/13 handlers, first statement; asserted by `security-admin-bodies-smoke.mjs` |
| A2 | Token verified server-side, not decoded | **PASS** | `admin-auth.js`: `adminClient.auth.getUser(token)` → `profiles.role` |
| A3 | Admin pages gated server-side | **PASS** | `app/admin/page.js` reads the user server-side; `proxy.js` redirects; route handlers are the real boundary |
| A4 | IDOR on orders / addresses / wishlists / reviews / payments | **PASS** | user id from token only; RLS `auth.uid() = user_id` on all four tables; `book_reviews` own-row policies |
| A5 | Role escalation through `profiles` | **PASS** | trigger `protect_profile_role` (live definition read); anon/client cannot set `role ≠ customer` |
| A6 | Admin agent is read-only | **PASS** | tool list has no write helper; only RPC `admin_dashboard_metrics` |

**B. Database vs the live project**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| B1 | RLS enabled everywhere | **PASS** | 12/12 tables; 25 policies; `mpesa_callbacks` has RLS and **no** policies (default deny) |
| B2 | Minimal grants | **FAIL** | SEC-08 — migration written, not applied |
| B3 | `SECURITY DEFINER` functions pin `search_path` | **PASS** (one exception) | all 20 definer functions set `search_path`; `delivery_rate` is invoker and is SEC-09 |
| B4 | `EXECUTE` revoked where not needed | **PASS** | business RPCs (`place_order`, `adjust_book_stock`, `set_order_status`, …) are not executable by `anon`/`authenticated`; `is_admin`, `delivery_rate` remain executable by `authenticated` by design |
| B5 | Migration drift | **FAIL (Info)** | 17 applied, 8 files at `a14e69e`. **13** applied names have no same-named file (`secure_trigger_functions`, `send_welcome_email_on_signup`, `enable_realtime_books_orders`, `security_hardening_round_2`, `harden_orders_and_place_order`, `mpesa_payment_verification`, `phase1b_admin_reads_without_service_role`, `phase2a`–`phase2e`, `phase3_newsletter_subscribers`); **4** of the 8 files have no same-named applied row (`phase2_operations`, `admin_reads_without_service_role`, `profile_role_hardening`, `delivery_rate`). Several are plainly the same change under a different filename (`phase2_operations` ↔ `phase2a`–`phase2e`), so this is provenance rather than missing schema — but the repository alone cannot rebuild the live database today |
| B6 | Unique index on `checkout_request_id` | **PASS** | `mpesa_payments_checkout_request_id_key` (partial) |
| B7 | Unique index on `mpesa_receipt` | **PASS** | `mpesa_payments_receipt_key` (partial) |
| B8 | Order idempotency | **PASS** | `idx_orders_user_idempotency` unique partial + `place_order` |
| B9 | Advisors | **UNVERIFIED** | no advisor endpoint is exposed by the available tooling; the equivalent checks (RLS, grants, `search_path`, definer rights, indexes) were run directly as SQL |

**C. Payments**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| C1 | Server-side repricing | **PASS** | `stk` recomputes from `books` + `deliveryFeeFor`; `place_order` recomputes again; client `total` unused |
| C2 | Callback cannot forge success | **PASS** | stored intent + `merchant_request_id` + exact amount + receipt regex + `stkQuery` |
| C3 | Replay protection | **PASS** | `mpesa_receipt` unique index + `findReceiptOwner` → `RECEIPT_REUSED`; `completePending` only updates `status='pending'` |
| C4 | STK spam | **PASS (after fix)** | 5/account and 3/phone per 10 min, both database-backed (SEC-04) |
| C5 | No secrets in logs or client bundles | **PASS** | only error codes/messages logged; only `NEXT_PUBLIC_*` reaches the browser |

**D. Input handling**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| D1 | JSON-LD escaping | **PASS (after fix)** | SEC-02 |
| D2 | Escaped user text everywhere | **PASS** | React escapes text nodes; the e-mail function escapes every interpolation (`esc()`); the only raw HTML is JSON-LD |
| D3 | PostgREST `.or()`/`.ilike()` injection | **PASS** | `[,%()]` stripped in `catalogue.js` and `admin/reviews`; `safeTerm` in the agent tools |
| D4 | Body size and type validation → 400 | **PASS (after fix)** | SEC-03 |
| D5 | Open-redirect bypasses | **PASS (after fix)** | SEC-01; tab/CR/LF/backslash/encoded/protocol-relative all covered |

**E. Headers, CORS, tokens**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| E1 | CSP / nonce | **FAIL** | SEC-11, documented tradeoff |
| E2 | Other headers | **PASS** | nosniff, `X-Frame-Options: DENY`, referrer policy, permissions policy, HSTS, no `X-Powered-By` (asserted by `smoke.mjs`) |
| E3 | CORS | **PASS (after fix)** | no `Access-Control-Allow-Origin` anywhere in `app/`; edge function allowlisted (SEC-10) |
| E4 | Tokens in URLs / logs / localStorage | **PASS** | no token logging; `localStorage` holds cart/wishlist only; Supabase session lives in the SSR client's cookies |

**F. Availability and stock integrity**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| F1 | COD hoarding | **PASS (after fix)** | SEC-07 |
| F2 | Rate limiter scope | **PARTIAL** | orders and M-Pesa use database counts; the admin agent uses a per-instance `Map` (SEC-16, accepted) |
| F3 | Flooding | **PASS** | orders 8/10 min; M-Pesa 5/10 min + 3/number; callback body capped |
| F4 | Post-payment stock/price mismatch | **PASS** | `place_order` re-checks stock and total and refuses; stock is re-checked in `stk` before the push |

**G. Edge functions**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| G1 | JWT verification | **FAIL / report only** | `send-email` true; **`welcome-email` false** (SEC-12) |
| G2 | Out-of-repo functions listed | **FAIL (Info)** | `welcome-email` is deployed and not in the repo |
| G3 | CORS | **PASS (after fix, not deployed)** | SEC-10 |
| G4 | Escaping in email | **PASS** | every interpolation goes through `esc()`; `money()` is numeric |
| G5 | No arbitrary recipients | **PASS** | recipients come from `email_outbox` rows / `auth.users`, never from the request body |

**H. AI assistant**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| H1 | Read-only | **PASS** | no write tool; RPC whitelist |
| H2 | Output is plain text | **PASS** | React text rendering; no `dangerouslySetInnerHTML` |
| H3 | Prompt injection | **UNVERIFIED** | the prompt and tool loop were reviewed, but no adversarial model run was possible offline |
| H4 | Data minimisation | **PARTIAL** | tools return trimmed rows and truncate at 12k chars; the model provider still receives admin-order data — a DPA decision, not a code one |

**I. Secrets**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| I1 | Secrets in the working tree or history | **PASS** | only `.env.example` (placeholders); no `.env`/`.pem` ever added; no live-key patterns |
| I2 | Hard-coded production fallbacks | **PASS (after fix)** | SEC-06 |
| I3 | `.gitignore` | **PASS** | `node_modules`, `.next`, `/build`, `*.pem`, env patterns |
| I4 | Archive/upload excludes `node_modules` | **PASS** | no archive script exists; `.gitignore` covers it |

**J. Supabase Auth settings — report only**

| Setting | Live value | Why it matters |
| --- | --- | --- |
| `site_url` | `http://localhost:3000` | confirmation / recovery links point at localhost |
| `uri_allow_list` | *(empty)* | no redirect allow-list |
| `mailer_autoconfirm` | `true` | addresses are never confirmed; throwaway accounts are free |
| `password_min_length` / HIBP | `6` / `false` | weak passwords accepted |
| `security_captcha_enabled` | `false` | sign-up and reset have no bot check |
| `passkey_enabled` / `webauthn_rp_id` | `true` / `localhost` | passkeys cannot work on the real domain |
| `sessions_*` | no timeout, not single-session | a stolen session lives indefinitely |
| Refresh-token rotation | `true` | good |
| SMTP | Resend, configured | credentials visible to anyone with dashboard access (reported, not printed) |

**K. Dependencies**

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| K1 | `npm audit --omit=dev` | **PASS** | 0 vulnerabilities |
| K2 | Patched framework versions | **PASS** | next `16.4.2`, react/react-dom `19.2.4`, `@supabase/supabase-js` `2.106.1`, `@supabase/ssr` `0.12.3` |
| K3 | No major upgrades | **PASS** | none made |

---

## 6. Commits

| Commit | What |
| --- | --- |
| `f61dc21` | SEC-01 open redirect |
| `e0a13f8` | SEC-02 JSON-LD escaping |
| `7e49c48` | SEC-03 admin bodies (`readJsonObject`, length caps, sanitizer moved to a testable module) |
| `7ba8696` | SEC-04 M-Pesa phone + per-number limit |
| `db09561` | SEC-05 optional callback shared secret |
| `2acb82f` | SEC-06 hard-coded production fallbacks |
| `77a2695` | SEC-10 send-email CORS |
| `ef937fe` | SEC-08/SEC-09 migrations (grants, `search_path`, phone index) — unapplied |
| `75f04e5` | SEC-07 COD limits |
| *(this doc)* | SEC-13 + report + tests wiring |

---

## 7. Migrations (written, **not applied**)

Each file carries its own rollback statements in a trailing comment. None has been executed anywhere — not on a branch database, not in a transaction. **Review the SQL before running it.**

| File | Purpose | Risk if applied | Rollback |
| --- | --- | --- | --- |
| `supabase/migrations/20261025120000_revoke_broad_grants.sql` | Drop unused privileges from `anon`/`authenticated`; keep only what the app uses | If some client path uses a privilege this revokes, that call starts failing with `42501`. The app paths that matter (addresses, wishlists, profile edit, reviews, catalogue reads) are re-granted in the same file | Re-grant the specific privilege named in the error; the file ends with the exact statements |
| `supabase/migrations/20261025121000_delivery_rate_search_path.sql` | Pin `search_path = ''`; revoke `EXECUTE` from `anon` | `delivery_rate()` is called with `authenticated`/service role only; anon never prices a cart | `alter function … reset search_path; grant execute … to anon;` |
| `supabase/migrations/20261025122000_mpesa_payments_phone_index.sql` | Index `(phone, created_at desc)` | Build locks writes briefly; the table is small | `drop index if exists …` |

**Suggested order:** apply the phone index first (purely additive), then the grants, then `search_path`. Apply to a Supabase branch first if you have one; otherwise take a backup (the free plan has none) and apply in a quiet window.

---

## 8. Test and build results

`npx eslint .` → **0 errors, 7 warnings** (unchanged from the baseline; all pre-existing: unused vars and `<img>` in the admin client).

`next build` (Next 16.4.2, production env) → compiled; every route generated, including `/api/mpesa/callback`, `/api/admin/*`, `/books/[slug]`, `/orders/[id]`, `/admin` (proxy).

`npm test` with a local production build → **passes**, and now includes eight security suites:

```
cart / price / store-wiring / delivery / mpesa / mpesa-callback / agent / reviews / reviews-sql
security-redirect           (6 accepted, 18 rejected, old-rule regression guard)
security-jsonld             (6 payload classes, round-trip, source guard)
security-admin-bodies       (null/array/scalar, size cap, mass assignment, length caps, 13-route sweep)
security-mpesa-limits       (verdicts, messages, route ordering)
security-callback-token     (unset, carriers, prefixes, case, malformed URLs)
security-config             (production throws, dev loads, no literal prod values)
security-edge-cors          (source contract — Deno not executed)
security-cod                (policy, messages, route wiring)
smoke.mjs                   (25 passed, 9 skipped — no service-role key locally)
```

Rendered checks against the local production build:

| Check | Result |
| --- | --- |
| `/books/deep-work-4` JSON-LD | 2 blocks (plus the RSC echo), both parse, no `<` and no `</script` |
| `/login?next=%2Fcart` | `href="/login?tab=register&amp;next=%2Fcart"` preserved |
| `/login?next=` tab / CR / LF / `//` / `\` / `https://` | **no** `next=` in any `href` |
| Security headers | all six present, no `X-Powered-By` |
| `/admin`, `/orders/<uuid>` signed out | redirect as before |

---

## 9. Not verified (stated plainly)

1. **The live database after the migrations.** They have never been executed. Privilege changes can surface a client path nobody grepped for; apply to a branch or take a backup first.
2. **The deployed `send-email` function.** The repo copy is fixed, but the deployed v2 still sends the wildcard CORS header until it is redeployed. Deno is not installed here, so the fixed function was not executed.
3. **`welcome-email`.** Out of the repository, unauthenticated, `verify_jwt: false`. Its behaviour was read from the deployed bundle, not run.
4. **A headed browser with a real mouse, and Safari/Firefox.** All rendering checks used Chromium against a local production build. The redirect and JSON-LD checks are server-rendered HTML, so browser differences there are unlikely; the rest of the UI was not re-tested as part of this audit.
5. **Supabase advisors.** The tooling available exposes no advisor endpoint. The equivalent queries (RLS, grants, `search_path`, definer rights, indexes) were run directly and are reported above; treat "advisors" itself as unrun.
6. **Real M-Pesa traffic.** No STK push, callback or `stkQuery` was sent. The callback secret is therefore also untested against Safaricom: it is opt-in precisely so it cannot break the flow until you set it.
7. **Prompt-injection resistance of the admin assistant.** Reviewed, not adversarially exercised.
8. **Node-only tests vs the edge runtime.** `security-config` and `security-edge-cors` assert source text and module loading in Node; neither boots the Deno runtime.
9. **Migration drift.** 17 applied vs 8 files: I could read *what* is applied, not reconstruct *why* the missing nine were never committed.

---

## 10. Manual steps (needs your approval where marked)

**Today**

1. **Merge the branch / open PR #56** (code only; no infrastructure change). Everything below is independent of that.
2. **Apply the three migrations**, ideally to a branch project first. ⚠️ *Needs approval.*
3. **Set the Auth site URL**: `site_url = https://bookstore-puce-sigma.vercel.app`, add the same origin (and `/login`, `/account`) to `uri_allow_list`, then set `webauthn_rp_id` to the real hostname. ⚠️ *Needs approval — this changes login e-mails.*
4. **Rotate the SMTP password** if it has ever been pasted into a chat, a ticket or a screenshot (it is readable in plain text from the project's auth settings by anyone with dashboard access).

**This week**

5. **Turn on `MPESA_CALLBACK_TOKEN`**: set the Vercel variable, append `?k=<token>` to `MPESA_CALLBACK_URL`, and redeploy. Do it in a quiet window — pushes created before the change carry the old URL. ⚠️ *Needs approval (Vercel env).*
6. **Redeploy `send-email`** so the CORS fix reaches production, and set `ALLOWED_ORIGINS` (or `SITE_URL`) on the function. ⚠️ *Needs approval (edge deploy).*
7. **Bring `welcome-email` into the repo** (or disable the trigger) and give it a shared secret; add the header to `net.http_post` in the trigger. ⚠️ *Needs approval.*
8. **Harden Auth**: `mailer_autoconfirm = false`, `password_min_length = 8`, `password_hibp_enabled = true`, captcha on sign-up, and a session timebox. ⚠️ *Needs approval; each one can lock people out if done carelessly.*

**When there is time**

9. **Nonce-based CSP** — widen the `proxy.js` matcher, mint a nonce per request, read it in `app/layout.js`, and verify hydration on `/checkout`, `/cart` and `/admin` before promoting. This is the one finding I deliberately left open.
10. **Commit the nine unrepresented migrations** (or a comment mapping them) so a fresh database can be rebuilt from this repo.
11. **Add `DB`-backed rate limits** to the admin assistant if it ever becomes a cost problem (SEC-16).
12. **Wire `npm test` into CI** so these regression guards run on every push.

---

## 11. The three most important things to do today

1. **Apply the grants migration** (`20261025120000_revoke_broad_grants.sql`). It is the largest remaining exposure that a fix already exists for: if any policy is ever loosened, `anon` currently has the table privileges to act on it. Nothing in the live app needs `TRUNCATE`, `TRIGGER` or `REFERENCES`.
2. **Set the Auth site URL and verify a password-reset e-mail end to end.** Every reset and confirmation link currently points at `http://localhost:3000`, so a locked-out customer cannot get back in — and that is invisible until someone tries.
3. **Redeploy `send-email` and enable `MPESA_CALLBACK_TOKEN`.** The repo is fixed but production still serves the wildcard CORS header, and the callback endpoint is still open to anyone; enabling the token is the difference between "Safaricom only" and "anyone with a CheckoutRequestID".

---

## Appendix — `AUDIT_PHASE4.md` corrections

*SEC-02:* the sentence "No `dangerouslySetInnerHTML` on user data (only the JSON-LD constants)" was wrong — those constants interpolate live book titles. Corrected by the banner and by the fix in `e0a13f8`.
*SEC-05:* "requires `amount ≥ expected_amount`" — the code compares exactly (`Math.round(reported) === expected_amount`).
*D14 (CSP):* the policy covers framing, base-uri, form-action and object-src; `script-src` is still absent (SEC-11).
*D10 (callback):* now has an opt-in shared token (`db09561`); it is not enabled until the environment variable exists.
*D8 (profile role):* verified live — `protect_profile_role` is active and no client can change `role`.
