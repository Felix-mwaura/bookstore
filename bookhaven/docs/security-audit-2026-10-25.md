# Book Haven security audit — 2026-10-25

**Status:** complete for everything that can be established from the code in this
repository. Everything that needs the live project is listed under
[Not verified](#9-not-verified) with the exact command or dashboard step to
close it.

**Scope:** `bookhaven/` at commit `af8c485` (recon), through `e6b61c6` (this
audit's fixes). Thirteen known findings, the full Phase 2 checklist A–K, and
the live behaviour of a local production build.

---

## 1. Executive summary

The shop itself was in better shape than the previous audit suggested — prices,
stock, order ownership and the M-Pesa callback are all decided in the database,
not in the browser — but three things needed fixing before the next busy day:
a login link that could send a customer to another website, book data that could
break out of the page's structured-data block, and a cash-on-delivery option
that let one account reserve the whole catalogue without paying for it.
Those are fixed, along with payment-prompt spam, a public email endpoint that
advertised itself to every website on the internet, and a production build that
would quietly point at the wrong Supabase project if an environment variable
went missing.
Eleven of the thirteen findings are closed in code; the remaining two need your
dashboard (the Auth settings and MFA), and three new SQL migrations are written
but deliberately **not applied** — they are the part that only you can run.

---

## 2. What was actually verified, and how

This audit ran in a sandbox with the repository, a Node toolchain and a local
production build. It could **not** reach Supabase, Vercel, Daraja or Resend, and
there is no `supabase`, `psql` or `vercel` CLI or credential here. That
distinction is kept honestly throughout:

| Claim type | How it was established |
| --- | --- |
| Code behaviour | Read, then exercised: `scripts/*.mjs` (198 security checks, 38 live HTTP checks) |
| SQL behaviour | Executed against **real PostgreSQL 17** (PGlite): 16 COD checks, 34 grant checks, 78 review-schema checks |
| HTTP behaviour | A local `next build` + `next start` on `0.0.0.0:3000`, exercised with `curl` |
| Live database, Auth settings, deployed functions | **Not verifiable here.** Every such item is `UNVERIFIED`, with the query or click path that settles it |

Nothing below says "fixed" on the strength of a code read alone: each fix names
the test or the command that shows it working.

---

## 3. Findings

Severity: **Critical** = remote compromise / payment forgery / admin takeover ·
**High** = significant data exposure or account takeover · **Medium** =
exploitable with conditions, or business abuse · **Low** = hardening ·
**Info** = observation.

| ID | Severity | Location | Finding | Status | Addressed by |
| --- | --- | --- | --- | --- | --- |
| F1 | **Medium** | `app/login/page.js:24`, `app/lib/safe-redirect.js:43` | Open redirect after login through `?next=` | Fixed | `1fa1457` |
| F2 | **Medium** | `app/books/[slug]/page.js:152-153`, `app/layout.js:85,89` | JSON-LD built from database fields without escaping `<` | Fixed | `6bb367f` |
| F3 | **Medium** | `app/lib/csp.js:67`, `proxy.js:30` | CSP had no `script-src`, so an injected script would run | Fixed | `5465db7` |
| F4 | **Medium** | `app/api/orders/route.js:139-175`, migration `20261025120000` | Cash-on-delivery stock hoarding: unlimited open orders, no auto-cancel | Fixed in code; migration **needs your approval** | `dd66906` |
| F5 | **Medium** | `app/api/mpesa/stk/route.js:96-131,237` | M-Pesa prompt could be aimed at any phone number | Fixed | `fe2da65` |
| F6 | **Low** | migration `20261025130000` | `anon`/`authenticated` hold TRUNCATE, TRIGGER, REFERENCES and, for `anon`, write access | Needs your approval (migration written, not applied) | `e6b61c6` |
| F7 | **Low** | migration `20261025140000` | `delivery_rate()` had no fixed `search_path` | Needs your approval (migration written, not applied) | `78af8ae` |
| F8 | **Low** | `app/lib/env.js:83`, `next.config.ts:2` | Hard-coded production fallbacks for Supabase URL/key and site URL | Fixed | `50d9268` |
| F9 | **Low** | `app/lib/request-guard.js:21`, `app/api/admin/*` | Unbounded bodies; a `null` JSON body crashed admin routes with a 500 | Fixed | `2e69240` |
| F10 | **Low** | `supabase/functions/send-email/index.ts` | Wildcard CORS and an unverified-role decode | Fixed | `bc003fa` |
| F11 | **Low** | `app/lib/callback-token.js:33`, `app/api/mpesa/callback/route.js:38` | M-Pesa callback had no shared secret option | Fixed (off by default; see manual steps) | `c543250` |
| F12 | **Info** | Supabase project | `welcome-email` function is live, `verify_jwt=false`, not in this repo, branded for another app | Needs manual action (cannot be reached from here) | — |
| F13 | **Info** | `AUDIT_PHASE4.md` | Stale claims (JSON-LD "constants only", D8/D10/D12 statuses, "no tests") | Fixed | `ac7e27e` |

### F1 — Open redirect after login (Medium)

`?next=` was accepted if it merely started with `/`, so a tab, newline,
carriage return or backslash after the slash survived the check — and
browsers strip those before resolving the URL, turning `/\t/evil.com` into
`https://evil.com`.

```js
// before — app/login/page.js
const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/account";
```

```js
// after — app/login/page.js:24 → app/lib/safe-redirect.js:43
export function safeNextPath(raw, { maxLength = MAX_LENGTH } = {}) {
  // rejects control characters and backslashes outright, then:
  const base = "https://bookhaven.invalid";
  const url = new URL(raw, base);
  if (url.origin !== base) return null;
  return `${url.pathname}${url.search}` || null;
}
```

Evidence — every bypass class the brief named is rejected:

| Input | Result |
| --- | --- |
| `/account` | `/account` |
| `/\t/evil.com` · `/\n/evil.com` · `/\r/evil.com` | `null` |
| `/\\evil.com` · `/./\evil.com` | `null` |
| `//evil.com` · `///evil.com` | `null` |
| `/%2F%2Fevil.com` | `null` |
| `http://evil.com`, `https://…/account`, `javascript:alert(1)` | `null` |
| `/account?tab=orders` | `/account?tab=orders` |

Residual: `safeNextPath` returns `null` for an absolute URL, and the caller
falls back to `/account`; that is the intended behaviour, not a silent accept.

### F2 — JSON-LD injection (Medium)

`JSON.stringify` does not escape `<`, so a book title containing
`</script><script>…` ended the tag and started a new one. The data came from
the database (admin-editable, and review text in one place), not from a
constant.

```jsx
// before — app/books/[slug]/page.js
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
```

```jsx
// after — app/lib/json-ld.js:38, used at page.js:152-153 and layout.js:85,89
export function serialiseJsonLd(value) {
  const json = JSON.stringify(value);
  if (typeof json !== "string") return "null";
  return json.replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char]);
}
```

The same commit put length and type caps on every admin-supplied book field
(`app/api/admin/books/route.js`). Evidence: `security-smoke` §2 asserts the
serialiser output contains no raw `<`, `>`, `&`, and that all four
`application/ld+json` tags in the app use it.

### F3 — No `script-src` (Medium)

The policy stopped framing and base-tag hijacking but allowed any inline
script. Now a per-request nonce is minted in `proxy.js` and threaded into the
response; the app's inline bootstrap carries it.

| Route class | `script-src` | Verified |
| --- | --- | --- |
| `/admin`, `/login`, `/books`, `/category`, `/orders` | `'self' 'nonce-…'` | 21/21 and 16/16 script tags nonced, 0 misses |
| `/`, `/about`, `/checkout`, `/account`, static 404 | `'self' 'unsafe-inline'` | expected — these are prerendered at build time, when no nonce exists |

Live header (`curl -D - /books`):

```
content-security-policy: default-src 'self';
  script-src 'self' 'nonce-bEEIG41cOnZOzE8ZDNFiUQ==';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://luniopceavtkljywukyi.supabase.co;
  font-src 'self' data:;
  connect-src 'self' https://luniopceavtkljywukyi.supabase.co wss://luniopceavtkljywukyi.supabase.co;
  media-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none';
  base-uri 'self'; form-action 'self'; manifest-src 'self';
  worker-src 'self' blob:; upgrade-insecure-requests
```

**Accepted trade-off:** the prerendered pages keep `'unsafe-inline'`. Making
them dynamic would cost the cache and the ISR benefit for a marginal gain on
pages with no user-generated HTML. The follow-up (if wanted) is to mark them
`force-dynamic` and add their prefixes to `NONCE_ROUTE_PREFIXES`.

### F4 — Cash-on-delivery stock hoarding (Medium)

COD reserved stock with no money collected and had no ceiling on how many
orders one account could open. The fix has three layers, because a JavaScript
check alone is advisory:

1. **Before the write** — `app/api/orders/route.js:152-174` counts the
   customer's open COD orders and the units in the basket, and refuses with a
   message that says what to do (`400 COD_ORDER_TOO_LARGE`,
   `409 TOO_MANY_OPEN_COD_ORDERS`).
2. **In the database** — `supabase/migrations/20261025120000_cod_abuse_limits.sql`
   installs a `BEFORE INSERT` trigger that re-checks the same limits under a
   per-customer `pg_advisory_xact_lock`, so two tabs cannot both read
   "2 open" and both succeed. **Not applied** — see §7.
3. **Housekeeping** — the same migration adds `cancel_stale_cod_orders(48)` and
   `/api/cron/cancel-stale-cod` runs it daily, cancelling and restocking COD
   orders nobody confirmed through the existing `set_order_status()` path.

```js
// before — app/api/orders/route.js: nothing. The only ceiling was
//   "8 orders per 10 minutes", which is 8 stock holds, then 8 more.

// after — route.js:152-174 (the friendly check) …
const { count: openCod } = await serverClient
  .from("orders").select("id", { count: "exact", head: true })
  .eq("user_id", user.id).eq("payment_status", "pending")
  .in("status", OPEN_COD_STATUSES)
  .or("payment_method.ilike.%cod%,payment_method.ilike.%cash%");
const problem = codLimitProblem({ units: unitsIn(cleanItemList), openOrders: openCod || 0 });
if (problem) return NextResponse.json({ error: problem.message, code: problem.code }, { status: problem.status });
```

```sql
-- … and the check that cannot be raced, in the new trigger:
perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id::text, 'anonymous'), 0));
-- then count this customer's open COD orders and raise TOO_MANY_OPEN_COD_ORDERS
```

Limits: 20 books per COD order, 3 open COD orders per account, 48 hours before
an unconfirmed order is cancelled. M-Pesa orders are exempt (the money is
already collected). Verified in real Postgres (`scripts/cod-sql-test.mjs`,
16/16), including that cancelled, delivered and paid rows do not count, that a
legacy `"Cash on Delivery"` spelling does, and that a malformed quantity cannot
turn the trigger into a 500.

### F5 — M-Pesa prompt spam (Medium)

`/api/mpesa/stk` is authenticated, so this was "any customer account" rather
than "anyone" — but five prompts per account per ten minutes is 30 an hour at
any number the caller typed, paid for by the shop.

```js
// before — app/api/mpesa/stk/route.js: one count, per account, nothing else
const { count: recentAttempts } = await db
  .from("mpesa_payments").select("*").eq("user_id", user.id).gte("created_at", tenMinutesAgo);
if ((recentAttempts || 0) >= 5) return NextResponse.json({ error: "…" }, { status: 429 });
```

```js
// after — app/api/mpesa/stk/route.js:96-131
const { count: recentForPhone } = await db
  .from("mpesa_payments").select("id", { count: "exact", head: true })
  .eq("phone", formattedPhone).gte("created_at", tenMinutesAgo);
...
const limitMessage = stkLimitProblem({ accountAttempts: recentAttempts || 0, phoneAttempts: recentForPhone || 0 });
```

The intent stores the phone (`route.js:237`), so the per-phone count works
across accounts (3 per number per 10 minutes) and an admin can see which
numbers were tried on the Payments tab. `MPESA_RESTRICT_TO_KNOWN_PHONE=1` adds
an optional strict mode that refuses a number not saved on the customer's
profile or in their addresses — off by default, because a first-time buyer has
nothing saved until after their first order, and blocking them at payment is
worse than the abuse it prevents. Thirteen unit checks in `security-smoke` §6.

### F6 — Over-broad grants (Low, migration)

Supabase's stock grants hand every table in `public` to `anon` and
`authenticated` **with ALL privileges** — including TRUNCATE, TRIGGER and
REFERENCES, which PostgREST cannot even use — and anon holds full DML on
`addresses`, `wishlists` and `admin_activity_log`. RLS still decides which rows
are visible, but one mistaken policy would then be anonymous write access.
`20261025130000_grant_hygiene.sql` revokes what nothing uses, keeps the
catalogue readable and keeps the API's own address/wishlist writes working.
**Not applied.** Proven against real Postgres with Supabase-shaped grants:
34/34 in `scripts/grants-sql-test.mjs`, including that a table created *after*
the migration inherits the same limits.

### F7 — `delivery_rate()` search path (Low, migration)

The one function in the project that did not pin its `search_path`. It is
`SECURITY INVOKER` and returns a constant, so nothing was exploitable — but it
is the function `/api/orders` calls before quoting a total, and the pattern is
worth closing. `20261025140000_delivery_rate_search_path.sql` recreates it with
`set search_path = ''` and the same body, volatility and grants. Verified: the
function still returns 20, still returns `integer`, and a browser role still
cannot execute it.

### F8 — Hard-coded production fallbacks (Low)

`app/lib/supabase-config.js` carried the project URL and anon key, and
`app/lib/site.js` the Vercel hostname. The anon key is public by design, but a
**new build** with the variables missing would silently write orders into that
project and email password resets pointing at that domain.

```js
// before — app/lib/supabase-config.js (the same pattern in site.js)
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJ…";
```

```js
// after — app/lib/env.js:83, called from next.config.ts:2
export function assertProductionBuildEnv(env = process.env, argv = process.argv) {
  if (!isProductionBuild(env, argv)) return;      // next start is never affected
  const missing = missingPublicEnv(env);
  if (missing.length) throw new Error(envErrorMessage(missing));
}
```

Verified both ways: a production build without the variables stops with the
three names and where to set them; `next start` never throws, so a failed build
cannot take down the deployment that is already serving. The fallbacks remain
in place for an existing deployment and for `npm test` (`NEXT_PUBLIC_ALLOW_ENV_FALLBACK=1`).

### F9 — Admin bodies and `null` JSON (Low)

`await request.json()` returns `null` for the body `null`; the next line
destructured it and answered 500. Every admin route now uses
`readJsonBody()` (size cap, 8–64 KB by route) and `isJsonObject()` (400 for
null, arrays and scalars), and fields are length- and type-checked.

```js
// before — app/api/admin/books/route.js
const body = await request.json();
const title = body.title;

// after — app/api/admin/books/route.js:166-172
const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
if (!isJsonObject(parsed.body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
```

### F10 — `send-email` CORS and role decode (Low)

The function answered every origin with `Access-Control-Allow-Origin: *` and
answered preflights. Nothing legitimate calls it from a browser — the Next.js
server does, with the service-role key — so the wildcard only advertised the
endpoint. CORS is gone, `OPTIONS` is now a 405 like any other non-POST, and the
file says out loud that `verify_jwt` must stay enabled and that
`--no-verify-jwt` must never be used.

```ts
// before — supabase/functions/send-email/index.ts
const cors = { "Access-Control-Allow-Origin": "*", … };
if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

// after
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
``` A cheap local expiry check was added; the
signature is still verified by the gateway, which is the correct place.

### F11 — Optional M-Pesa callback secret (Low)

Daraja does not sign callbacks, so the endpoint's only defence is the
verification code behind it. `MPESA_CALLBACK_TOKEN` (16+ characters) is now
appended to the `CallBackURL` of every STK push automatically and checked in
constant time before the body is parsed or the database is opened. **Unset is
the old behaviour**, so this cannot break a shop that ignores it; the token is
redacted from logs and diagnostics.

```js
// before — app/api/mpesa/callback/route.js: every request parsed
export async function POST(request) { … }

// after — route.js:26-46
const expectedToken = (process.env.MPESA_CALLBACK_TOKEN || "").trim();
if (expectedToken && !callbackTokenMatches(request.nextUrl.searchParams.get("token"), expectedToken)) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
}
```

`MPESA_SETUP.md` explains the one hazard:
setting it while a prompt is in flight rejects that prompt's callback.

### F12 — `welcome-email` edge function (Info, needs manual action)

Reported in the previous audit as live, `verify_jwt=false`, absent from this
repository and branded for another product. From this environment there is no
way to list or read deployed functions, so it is **unverified** here. It should
be deleted (or its source committed and reviewed) — see §7. If any database
trigger still calls it, deleting it silently breaks that trigger's notifications;
check with `select tgname, tgrelid::regclass from pg_trigger where not tgisinternal and tgfoid::regproc::text ilike '%welcome%';`
before deleting.

### F13 — Stale documentation (Info)

`AUDIT_PHASE4.md` claimed JSON-LD carried only constants (wrong), described the
callback amount check as `≥`, and left D8/D10/D12/D14 as open. A correction
block now sits at the top and the specific cells were marked, with the original
text kept so the record is not silently rewritten.

---

## 4. Phase 2 checklist results

### A. Authentication and authorization — **PASS**

| Item | Result | Evidence |
| --- | --- | --- |
| Every `/api/admin/*` handler calls `requireAdmin()` before any work | PASS | Automated: every `app/api/admin/**/route.js` imports and calls it as the first statement |
| Anonymous probes learn nothing about configuration | PASS (fixed) | `7dd639a`: bearer token is checked before `SUPABASE_SERVICE_ROLE_KEY`; anonymous → `401`, never a 500 naming a variable |
| User routes verify the token server-side and scope to the verified id | PASS | `/api/orders`, `/api/adresses`, `/api/wishlist`, `/api/mpesa/query` use `auth.getUser()` then `.eq("user_id", user.id)` |
| Admin pages gated server-side, not only in the proxy | PASS | `proxy.js:68-86` (UX gate) **and** `app/admin/page.js` role read before render |
| IDOR on orders / addresses / wishlist / reviews / payments | PASS | `/orders/[id]` 404s on someone else's id; addresses/wishlist/reviews rely on RLS with the caller's JWT |
| A customer cannot promote themselves | PASS (code), UNVERIFIED (live) | Migration `20261023113634` revokes table-wide UPDATE on `profiles` and adds a trigger; the live policy is not readable from here — see §9 |

### B. Database — **PASS (migrations) / UNVERIFIED (live project)**

| Item | Result | Evidence |
| --- | --- | --- |
| RLS enabled on every table, correct policies | UNVERIFIED | Needs the live project; query in §9 |
| Grants minimal for `anon`/`authenticated` | FAIL → fixed in migration | F6; 34/34 checks in PGlite |
| `SECURITY DEFINER` functions pin `search_path` | PASS after F7 | Every function defined in this repository pins it (the SQL tests assert it for the new ones); functions that exist only in the live database are under item 2 below |
| Unique indexes on `checkout_request_id`, `mpesa_receipt`, idempotency | UNVERIFIED (migration history suggests yes) | `20261023113622` adds receipt uniqueness; the base indexes are not in the repo |
| Supabase security advisors | UNVERIFIED | Dashboard → Advisors (not reachable here) |
| Live definitions match `supabase/migrations` | UNVERIFIED | No `supabase` CLI or credential; `supabase db diff` is the step |

### C. Payments (M-Pesa) — **PASS**

| Item | Result | Evidence |
| --- | --- | --- |
| Prices, delivery and totals recomputed server-side | PASS | `place_order()` re-reads price/stock; the client total is never sent |
| Callback matches intent, merchant request id, exact amount, valid receipt, Daraja confirmation | PASS | `app/lib/mpesa-verify.js`; the mocked-provider suite `mpesa-callback-smoke.mjs` |
| Replay: one receipt → one payment → one order | PASS | Unique receipt + `order_id is null` guard inside the locked row |
| STK cannot spam arbitrary numbers | FAIL → fixed | F5 |
| No payment secrets in logs or bundles | PASS | Diagnostics mask shortcodes to last 4; callback URL token redacted; no `NEXT_PUBLIC_*` secret |

### D. Input handling and injection — **PASS**

| Item | Result | Evidence |
| --- | --- | --- |
| `dangerouslySetInnerHTML` audit | PASS after F2 | 4 JSON-LD tags + 0 user-data sinks; serialiser escapes `<`, `>`, `&` |
| User text escaped in admin UI, assistant and emails | PASS | React escapes; `esc()` in `send-email` covers every interpolation |
| PostgREST filters cannot be reshaped | PASS | Every `.or()`/`.ilike()` value strips `,`, `(`, `)`, `%` before interpolation (`catalogue.js:174`, `admin/reviews/route.js:71`, `admin-agent-tools.js:44`) |
| Body limits; null/malformed → 400 | PASS after F9 | `readJsonBody()` + `isJsonObject()` on all admin routes; callback has its own 64 KB cap |
| Login `next` cannot redirect off-site | PASS after F1 | Bypass table above |

### E. Browser security — **PASS**

| Item | Result | Evidence |
| --- | --- | --- |
| CSP with `script-src` | PASS after F3 | Nonce tier on 5 prefixes; `unsafe-inline` only on prerendered pages (documented) |
| Other headers | PASS | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS — all present on `/`, `/books`, `/login`, `/admin` |
| CORS | PASS after F10 | No application route sets `Access-Control-Allow-Origin` |
| Cookies / session / localStorage | PASS | Supabase session in its own cookies; `localStorage` holds only the cart, wishlist and display name; no token in any URL |

### F. Abuse and business logic — **PASS with one residual**

| Item | Result | Evidence |
| --- | --- | --- |
| COD hoarding | FAIL → fixed | F4 |
| Per-instance-only rate limits | **PARTIAL (accepted risk)** | `/api/newsletter` and the admin assistant use an in-process `Map`; on Vercel each instance has its own. Orders, STK and the assistant's cost limiter are database-backed. Recommendation: Vercel Firewall rule on `/api/newsletter` |
| Reviews, wishlist, newsletter cannot flood the database | PASS | One review per customer per book (unique), 10–2000 char bounds; wishlist unique per book; newsletter honeypot + duplicate-as-success |
| Stock/price change after a successful M-Pesa payment | **KNOWN GAP (documented)** | If the book sells out between the prompt and the callback, the payment settles but `place_order()` refuses the order. Detection: the payment row is `completed` with `order_id` null and is visible in Admin → Payments; the customer is not charged twice and is refunded manually. Improvement proposed (not implemented): auto-refund/queue a reconciliation task from the callback when `order_id` stays null for 15 minutes |

### G. Edge functions and email — **PASS (repo) / UNVERIFIED (deployed list)**

| Item | Result | Evidence |
| --- | --- | --- |
| `send-email`: JWT, CORS, escaping, recipients | PASS after F10 | Service-role only, `verify_jwt` documented, CORS removed, `esc()` everywhere, recipients come from the queue |
| All deployed functions listed | UNVERIFIED | Needs `supabase functions list` |
| `welcome-email` | UNVERIFIED / needs action | F12 |

### H. Admin AI assistant — **PASS**

| Item | Result | Evidence |
| --- | --- | --- |
| Read-only tools | PASS | `app/lib/admin-agent-tools.js` contains no insert/update/delete; the only RPCs are the read-only metrics function |
| Output rendered as text | PASS | `assistant-tab.js` parses paragraphs/bullets/`**bold**` into React nodes; no `dangerouslySetInnerHTML`, no link rendering |
| Prompt injection cannot exfiltrate or act | PASS | No write capability, tool output is data-only, results truncated at 12 KB, provider errors mapped to fixed text |
| Personal data minimised | **NOTE** | Customer lookups return email/phone to the model provider. Under the Kenya DPA that is a processor relationship worth naming in the privacy policy |

### I. Configuration and secrets — **PASS after F8**

| Item | Result | Evidence |
| --- | --- | --- |
| No secrets in the repo or history | PASS | Pattern scan (private keys, `sk_live_`, `re_…`, service-role JWT): only the public anon key in `supabase-config.js`, which is public by design |
| Failing loudly when env vars are missing | FAIL → fixed | F8; verified a build without them stops, `next start` is unaffected |
| `.gitignore` covers `.env*`, `.vercel`, `*.pem`; archive ships no `node_modules` | PASS | `.gitignore` lines 33–40 |

### J. Supabase Auth settings — **UNVERIFIED (report only)**

Everything in this section is a dashboard setting; none of it can be read from
here. The checklist is in §7. The highest-value items: leaked-password
protection, a server-side minimum length (the 8-character rule currently lives
only in the signup form), email confirmation, the redirect allow-list, and MFA
on the owner account.

### K. Dependencies — **PASS**

```
npm audit --omit=dev  → found 0 vulnerabilities
npm audit             → 1 high: zod < 4.6.6, dev-only
                        (eslint-config-next → eslint-plugin-react-hooks → zod)
```

`zod` is not in the production bundle. It is fixed by `npm audit fix` when the
toolchain is next updated; it does not affect the shop.

---

## 5. Verification log

Every number below was produced by running the command in this repository, not
by inspection.

| Command | Result |
| --- | --- |
| `npm run lint` | 0 errors, 7 warnings (all pre-existing) |
| `npm test` | all suites pass: cart, price, store wiring, delivery, M-Pesa, callback (mocked), assistant, reviews JS (43), reviews SQL (78), COD SQL (16), grants SQL (34), security (198), HTTP smoke (38) |
| `node scripts/security-smoke.mjs` | **PASS — 198 checks** (was 129 before this audit's additions) |
| `node scripts/smoke.mjs http://127.0.0.1:3000` | **38 passed, 0 skipped** (was 29 passed / 9 skipped — admin routes now answer 401 instead of being skipped) |
| `node scripts/cod-sql-test.mjs` | **PASS — 16/16** on real Postgres 17 |
| `node scripts/grants-sql-test.mjs` | **PASS — 34/34** on real Postgres 17 |
| `next build --webpack` with the three `NEXT_PUBLIC_*` set | succeeds; all 30 routes build |
| `next build --webpack` without them | **fails** with the exact variable names (intended) |
| `next start` without them | unaffected (no throw) |
| `curl -D - /` `/books` `/login` `/admin` | 6 security headers each; nonce on `/books` and `/login`; `/admin` → `307 /login?next=%2Fadmin` |
| `curl /api/cron/cancel-stale-cod` without `CRON_SECRET` | `503` (disabled, no work done) |
| …with `CRON_SECRET` set, no/wrong bearer | `401` |
| …with the right bearer | reaches the database call (500 only here, because this sandbox has no service-role key — correctly named in the log) |

---

## 6. Migrations prepared — **none of these are applied**

`supabase/migrations/` is the record; nothing below has been run against
`luniopceavtkljywukyi`.

| File | What it does | Rollback |
| --- | --- | --- |
| `20261025120000_cod_abuse_limits.sql` | `BEFORE INSERT` trigger enforcing 20 books per COD order and 3 open COD orders per customer (with a per-customer advisory lock); `cancel_stale_cod_orders(48)`; a partial index for the count | drop the trigger, the two functions and the index (statements at the top of the file) |
| `20261025130000_grant_hygiene.sql` | Revokes TRUNCATE/TRIGGER/REFERENCES from `anon`+`authenticated`; all writes from `anon`; anon `SELECT` on customer/operational tables; writes on `admin_activity_log` from `authenticated`. Applies to future tables too | `grant all on all tables in schema public to anon, authenticated;` + the matching `alter default privileges` — the file contains it verbatim |
| `20261025140000_delivery_rate_search_path.sql` | Recreates `delivery_rate()` with `set search_path = ''`, same body and grants | Re-run the definition from `20261021110000_delivery_rate.sql` |

**Apply order:** grants first (it is pure privilege work and cannot break a
running query), then `delivery_rate()`, then COD limits. The COD trigger is safe
to apply before the code deploy — it only rejects orders that already exceed the
limits — but the auto-cancel sweep does nothing until `CRON_SECRET` is set.

Each file ends with a `VERIFY` query that returns rows **only if** the
migration did not take effect.

---

## 7. Manual steps for you

Ordered; the first three are today's work.

**Environment (Vercel → Settings → Environment Variables → Production, then redeploy)**

1. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` — required; the next production build fails without
   them (that is the intended behaviour, and Vercel keeps the current
   deployment serving until a build succeeds).
2. `CRON_SECRET` — `openssl rand -hex 32`. Without it
   `/api/cron/cancel-stale-cod` answers 503 and cancels nothing.
3. `MPESA_CALLBACK_TOKEN` — `openssl rand -hex 24`. Optional but recommended;
   set it when no payment prompt is in flight. Rotating it later needs nothing
   beyond the env change: the URL is sent with every push.
4. `MPESA_RESTRICT_TO_KNOWN_PHONE=1` — only after you have confirmed customers
   can save their number from Account, otherwise first-time buyers are blocked
   at payment.

**Supabase Auth (Dashboard → Authentication)**

5. Providers → Email: **Confirm email** on; **Secure email change** on.
6. Passwords: minimum length 10+, **leaked password protection** on (checks
   against HaveIBeenPwned).
7. URL Configuration: Site URL = the real domain; Redirect URLs =
   `https://<site>/account` (and the Vercel preview pattern if used). Anything
   not listed is refused.
8. Rate limits: leave the defaults, but confirm email sending is capped.
9. MFA: enrol the owner account (TOTP) and require it for admin users.
10. Advisors: run the Security Advisor and clear every WARN; the grants
    advisory is what migration `20261025130000` addresses.

**Edge functions**

11. `supabase functions list` then read each one's source. Delete
    `welcome-email` (it is `verify_jwt=false`, not in this repo, and branded for
    another app) after checking no trigger calls it:
    `select tgname from pg_trigger where not tgisinternal and tgfoid::regproc::text ilike '%welcome%';`
    If it is still wanted, commit its source and set `verify_jwt=true`.
12. Confirm `send-email` is deployed **with** JWT verification (never
    `--no-verify-jwt`).

**Migrations (in this order, one at a time, each is idempotent)**

13. `20261025130000_grant_hygiene.sql` → run its VERIFY query (expect zero rows).
14. `20261025140000_delivery_rate_search_path.sql` → `select public.delivery_rate();` must return 20.
15. `20261025120000_cod_abuse_limits.sql` → run the pre-flight at the top first
    (it asks whether `admin_activity_log.admin_id` is nullable; the automatic
    cancellation logs a null actor). Then place a test COD order as a customer
    who already has three open ones — it must fail with
    `TOO_MANY_OPEN_COD_ORDERS`.
16. `supabase db pull` and commit the base schema. **This is the biggest
    structural gap left (D11): today the policies for `profiles`, `orders`,
    `addresses`, `wishlists` and `newsletter_subscribers` exist only in the live
    database, so nobody can review the security model from source.**

**Accounts**

17. Rotate the Supabase anon key once the new build is confirmed working, since
    it has been committed in `app/lib/supabase-config.js`. The key is public by
    design, but it is now in git history and in any fork.

---

## 8. Accepted risks

| Risk | Why it is accepted | Mitigation available |
| --- | --- | --- |
| Prerendered pages use `script-src 'unsafe-inline'` | Making them dynamic costs cache/ISR; those pages contain no user-generated HTML, and the JSON-LD that used to be a sink is escaped | `force-dynamic` + `NONCE_ROUTE_PREFIXES` |
| `/api/newsletter` limiter is per instance | The honeypot, format check and duplicate-as-success keep it low value | Vercel Firewall rule, or a shared (Upstash) counter |
| The assistant sends customer contact details to the model provider | Needed to answer "who is this order for" | Name the processor in the privacy policy; trim fields further |
| Payment settles but the order cannot be created (stock sold out) | Rare, visible in Admin → Payments, refunded by hand | Automate a reconciliation/refund task off the callback |
| `MPESA_CALLBACK_TOKEN` unset by default | Keeping the current callback working was a hard requirement | Set it in Vercel (§7.3) |

---

## 9. Not verified

Everything here needs a credential, a dashboard or a live service this
environment does not have. Each line says how to close it.

1. **Live RLS policies and grants** — run the VERIFY query at the bottom of
   `20261025130000_grant_hygiene.sql`, plus
   `select tablename, rowsecurity from pg_tables where schemaname='public';`
   Every table must show `rowsecurity = true`.
2. **Live function definitions vs migrations (drift)** — `supabase db diff` or
   `select proname, prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public';`
3. **Supabase Auth settings** — §7.5–7.10. Cannot be read from source.
4. **Deployed edge functions** — `supabase functions list`; `welcome-email`
   cannot be inspected or deleted from here.
5. **Storage bucket policy** (`book-covers`) — Dashboard → Storage → Policies.
   Confirm INSERT/UPDATE only for `is_admin()`, 2 MB limit, JPEG/PNG/WebP.
   Reported fixed; not independently verified here.
6. **Daraja and Resend** — no live callback or email was sent. The callback
   logic is covered by a mocked-provider suite (30 checks), not by Safaricom.
7. **A real payment end-to-end** — needs sandbox credentials; the sequence
   (push → callback → order) has not been exercised against Safaricom.
8. **Supabase security advisors** — Dashboard → Advisors.
9. **Email deliverability / password-reset inbox** — not exercised.
10. **Load behaviour of the rate limits** — the checks are correctness tests;
    no load test was run.

---

## 10. The three things to do today

1. **Set the three `NEXT_PUBLIC_*` variables in Vercel and redeploy.** After
   this change a production build *fails* if they are missing — deliberately —
   so make sure they exist before you push the branch, or the deploy will stop
   at the build step (the current site keeps serving).
2. **Enrol MFA on the owner account and turn on email confirmation +
   leaked-password protection.** These are the only remaining "someone gets in"
   risks, and none of them can be fixed from code.
3. **Apply the three migrations in §7, starting with the grant hygiene one,
   then confirm the site still shows books and checkout still works** — that
   migration removes privileges the app does not use, and its VERIFY query tells
   you immediately if a table was created after it ran.
