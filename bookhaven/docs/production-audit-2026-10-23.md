# Book Haven — production audit, 2026-10-23

Scope: the eight priorities in `bookhaven_production_improvements_prompt.txt`, carried out
against this repository and, read-only, against the live Supabase project
`luniopceavtkljywukyi` and the production deployment
`https://bookstore-puce-sigma.vercel.app`.

**Update, same day:** the two migrations were authorised by the owner and applied at
11:36 UTC. Their status below has been corrected, and section 8 records what was verified
afterwards. No environment variable was changed, no live payment or email was triggered,
and every statement about the live system is something that was queried or attempted.

---

## 0. Verdict

**Release is UNBLOCKED for the three conditions below.** Both migrations are applied and
verified (section 8). Two owner actions remain before launch, and neither is a code defect:
real contact details, and email delivery with a verified domain.

| Release gate condition | Status |
| --- | --- |
| A forged callback can complete a payment | **Pass (code)** — verified with mocked provider; fails closed on every path |
| A customer can promote themselves to admin | **Pass (live + code)** — production already refuses it; repository now reproduces the guard |
| Critical RLS is unverified | **Pass** — verified after the migrations: customers cannot self-promote, browsers cannot write orders/books/payments, the subscriber list is no longer readable by `anon` |

Both migrations are now applied (`20261023113622`, `20261023113634`) and the post-apply
checks in section 8 pass, so the gate is "pass, with owner actions outstanding" (section 9).

---

## 1. Corrections to earlier findings

Two things reported earlier in this engagement were wrong, and are corrected here.

**1.1 "Customers can promote themselves to admin in production" — not true today.**
The `profiles_update_own` policy (`using auth.uid() = id`) and a table-wide `UPDATE`
privilege are both real, and on their own they would allow it. But production also has:

```
trg_protect_profile_role  BEFORE INSERT OR UPDATE ON public.profiles
  → public.protect_profile_role()   (enabled, tgenabled='O')
```

Attempting the escalation as a real customer, inside a transaction that was rolled back:

```sql
set local role authenticated;
set local_config request.jwt.claims = '{"sub":"4974e59c-…","role":"authenticated"}';
update public.profiles set role = 'admin' where id = '4974e59c-…';
-- ERROR 42501: Role changes are not permitted from this context
```

**The live hole is closed.** The real finding is different and still serious:
*that trigger exists in no migration in this repository.* A database rebuilt from
`supabase/migrations` would be wide open, and the next person to debug a fresh environment
would find a store where anyone can make themselves an admin.

**1.2 "mpesa_payments has no foreign keys" — wrong.**
It has `mpesa_payments_order_id_fkey` (→ `orders`, ON DELETE SET NULL) and
`mpesa_payments_user_id_fkey` (→ `auth.users`, ON DELETE SET NULL). The earlier query
looked at the wrong relation.

---

## 2. P0 — M-Pesa (launch blocker)

### What was wrong

`POST /api/mpesa/callback` is public and Daraja does not sign callbacks. It acted on the
body alone:

| # | Defect | Consequence |
| --- | --- | --- |
| 1 | `ResultCode === 0` in the body was sufficient to set `status='completed'` | A forged POST completes a payment — the only thing an attacker needs is a `CheckoutRequestID`, which is returned to the browser that started the payment |
| 2 | Amount check was `amount >= expected_amount` | Overpayment accepted; the order total could be met with a larger payment made for something else |
| 3 | No receipt validation, no uniqueness | Two rows could hold the same M-Pesa receipt; `place_order` would accept the second |
| 4 | No check that `MerchantRequestID` matched | A callback for a different transaction could settle the row |
| 5 | Intent row inserted **after** the STK push returned | A push that succeeded but whose insert failed left real money in flight with no record; a fast callback found no row and was dropped |
| 6 | Unknown `CheckoutRequestID` silently acknowledged and discarded | A genuine payment that could not be matched was lost with no evidence |
| 7 | Every DB error ignored | A failed write on a real payment was indistinguishable from success |
| 8 | `/api/mpesa/query` set `status='completed'` with no amount and no receipt | A payment could become order-eligible without proof of amount or a receipt |

### What changed

- **`app/lib/mpesa-verify.js`** (new). Pure functions — no network, no database. A success
  must pass five checks: matching intent, matching `MerchantRequestID`, **exact** amount
  equality, a well-formed receipt, and independent confirmation from Daraja's
  `stkpushquery`. Anything else returns `hold`, which keeps the row `pending` and records a
  reason; it never returns "complete".
- **`app/lib/mpesa-callback-handler.js`** (new). The decision, with the store and the
  Daraja client injected, so it can be tested with a fake provider (including database
  failures and concurrent deliveries). `complete` is written with
  `UPDATE … WHERE id = ? AND status = 'pending'` plus `.select()`; losing that race is a
  no-op, not an error.
- **`app/api/mpesa/callback/route.js`**. Thin wrapper. Returns **500** when *we* failed
  (database write, Daraja unreachable) so Safaricom re-delivers; returns 200 when there is
  nothing to do. Never inserts a payment and never writes to `orders`.
- **`app/api/mpesa/stk/route.js`**. The intent row is created **before** the push, then
  `CheckoutRequestID`/`MerchantRequestID` are attached (3 attempts). If the attach fails the
  request fails loudly with the checkout id in the log, because the customer has a live
  prompt. A rejected push closes the intent instead of leaving a phantom pending row.
- **`app/api/mpesa/query/route.js`**. A positive query is reported as
  `confirmedByDaraja`, never as success, and never sets `completed` — Daraja's query
  response carries neither the amount nor the receipt. It no longer claims success from
  local state except for a row that the verified callback already completed.
- **`app/lib/mpesa.js`**: new `stkQuery()`; `ok:false` means "no verdict", never "failed".
- **`app/checkout/page.js`**: new `unconfirmed` state. When the countdown ends without a
  confirmed payment the customer is told we do not know, and explicitly told not to pay
  again if their phone shows the payment.
- **Migration `20261023120000_mpesa_callback_integrity.sql`**: `mpesa_callbacks` table
  (every callback preserved, RLS on, no policies, no grants), unique partial index on
  `mpesa_receipt`, browser write privileges removed from `mpesa_payments`, and a
  `place_order` that requires an exact amount and a real receipt.

### Tests

`scripts/mpesa-callback-smoke.mjs` — 13 sections, mocked Daraja, in-memory store, no network.
Covers: forged success, amount under/over/missing/zero, unknown checkout id, missing record,
callback-before-attach, foreign merchant id, missing receipt, duplicate callback, two
concurrent callbacks, cancelled/timeout/wrong-PIN, database write failure, lookup failure,
missing `mpesa_callbacks` table, reused receipt, verified success, repeated query,
malformed bodies, oversized `ResultDesc`.

**Result: PASS.** Two real defects were found by writing these tests: the failure path did
not set `status='failed'` (a cancelled payment stayed `pending` forever), and the receipt
was not required before completion.

---

## 3. P1 — Roles, RLS, and what browsers may write

### Findings

| # | Finding | Evidence | Status |
| --- | --- | --- | --- |
| 1 | Role guard exists in production but **not in the repository** | `trg_protect_profile_role` present and enabled; no migration created it | **Fixed and applied** |
| 2 | `authenticated` has table-wide `UPDATE` on `profiles` | `information_schema` | **Fixed and applied** — column-level grants |
| 3 | `anon`/`authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE on `orders`, `mpesa_payments`, `books` | table privileges query | **Fixed and applied** — write grants revoked |
| 4 | `newsletter_subscribers` policy `Anyone can subscribe` is `FOR ALL WITH CHECK (true)` with **no USING clause** | `pg_policy.polcmd='a'`, `polqual IS NULL` | **Live gap.** PostgreSQL uses the USING expression for the read side, and a missing USING defaults to true, so `anon` can read — and delete — every row in that table. The table is empty today (0 rows), so no data was exposed, but every subscriber would be as soon as one exists. **Fixed and applied** — the policy was dropped and browser writes revoked |

Rows 1–4 are fixed by `20261023113634_profile_role_and_write_surface.sql`, now applied. It
re-created the live trigger **verbatim**, so the only behaviour change in production was
closing rows 2–4. Re-checked afterwards: a customer still updates their own name, and a
customer updating their own role now fails before the trigger even runs
(`42501 permission denied for table profiles`).

### What is already correct

- Every `/api/admin/*` route calls `requireAdmin()` first (11 route files, checked one by one),
  which verifies the JWT and re-reads `profiles.role` server-side with the service role.
- Role changes go only through `PATCH /api/admin/users`, which uses the service role, refuses
  self-demotion, refuses demoting the owner, refuses removing the last admin, and writes to
  `admin_activity_log`.
- `SUPABASE_SERVICE_ROLE_KEY` is read only in `app/lib/server.js` and server-only modules; no
  client component imports them.
- The browser's only direct write anywhere in the app is
  `profiles.update({ first_name, last_name, phone })` — exactly the three columns the new
  grant allows.
- `orders` and `mpesa_payments` have no write policies at all, so the wide grants are latent,
  not exploitable.

---

## 4. P2 — Order and inventory integrity

Already sound, and verified by reading `place_order` as deployed:

- prices, subtotal and delivery are recomputed from `books`; client prices are ignored;
- the caller is identified by the verified JWT, never by the body;
- `payment_status` is derived, never supplied;
- a completed payment must belong to the same user and must not already have an order;
- `idempotency_key` returns the original order on replay;
- stock is decremented under `SELECT … FOR UPDATE`.

**One real defect found.** `place_order` validated each cart line against stock separately,
so `["3 × book 7", "3 × book 7"]` against a stock of 5 passed both checks and then
decremented 6, leaving stock at −1. `/api/orders` already merged duplicate lines before
calling the function, so this was **not reachable through the shipping UI** — but it was
reachable by anything else that calls the function, and it is exactly the kind of bug that
returns when a caller is added.

Fixed in `20261023113622`: lines are merged per book before stock is checked, and rows are
locked in ascending id order so two concurrent orders cannot deadlock.

Also fixed: a non-numeric `quantity` used to escape the inner `BEGIN…EXCEPTION` block and
surface as a 500; it is now `INVALID_ITEMS` (400).

The intentionally low-priced test product was left alone, as instructed — it is not a
defect; prices are handled server-side.

---

## 5. P3 — Errors, rate limits, request size

- **No secret is logged anywhere.** Every `console.error` in `app/api` and `app/lib` was
  read: they log error codes, HTTP statuses, checkout ids and the *names* of missing
  environment variables, never a key, token, passkey or customer phone number.
- **Rate limits**: `/api/mpesa/stk` is limited in the database (5 attempts / 10 min / user);
  `/api/orders` 8 / 10 min per user; `/api/newsletter` 5 / 10 min per IP; `/api/admin/agent`
  20 / 10 min per admin. The last two are **in-memory and therefore per instance** — on
  Vercel a determined client can exceed them by landing on new instances. That is documented
  in the route comments and remains a known limitation; a durable limiter (Upstash/Redis)
  is the correct follow-up and is deliberately not added here (new dependency, needs an
  account).
- **Body size limits** — new `app/lib/request-guard.js`, applied to `/api/orders`,
  `/api/mpesa/stk` (32 KB), `/api/mpesa/query`, `/api/newsletter` (8 KB) and the callback
  (64 KB, acknowledged without parsing). Next.js does not cap Route Handler bodies, so
  `await request.json()` on a 50 MB body previously parsed 50 MB before any validation ran.
- **Error messages to customers** are generic and actionable; internal detail goes to logs
  keyed by payment or order id.

---

## 6. P4–P7 — Dashboard, email, deployment, accessibility

**P4 — admin dashboard and assistant.** Checked, no changes needed: every operation is
behind `requireAdmin()`; the assistant's seven tools (`store_metrics`, `list_orders`,
`get_order`, `low_stock`, `search_books`, `find_customers`, `stock_movements`) contain **zero**
insert/update/delete calls and use parameterised Supabase query builders; the loop is bounded
to 5 rounds / 10 tool calls; each model request aborts after 45 s; messages are clamped to
14 turns / 4 000 chars and 20 000 chars total; a customer token is rejected before any of
that. Prompt-injection resistance rests on the tools being read-only — a malicious order
note can at worst make the assistant say something wrong, not change data.

**P5 — email.** The outbox is written in the same transaction as the order change;
`dedupe_key` is unique; `status='sent'` is written only after Resend returns 2xx; failures are
retried up to 5 attempts with the error recorded. The edge function is gated on a
`service_role` JWT. **Not configured**: `RESEND_API_KEY` and `EMAIL_FROM` are unset, so
delivery falls back to `onboarding@resend.dev`, which can only send to the Resend account
owner. No domain means no SPF/DKIM/DMARC to document yet — the owner action is: buy a
domain, verify it in Resend, then set both secrets. Nothing in the UI claims an email was
sent.

**P6 — environment and deployment.** `.env.example` documents every variable with a
server-only / `NEXT_PUBLIC_` split; no secret is tracked (`git ls-files` shows only
`.env.example`); `.env*` is ignored. M-Pesa fails closed and explains itself when a variable
is missing. The callback URL resolves to the deployed HTTPS host. Headers (CSP with
`frame-ancestors`, HSTS, nosniff, permissions policy) were left as they are — nothing was
weakened. **The gap is that M-Pesa is currently enabled in production with code that has
never completed a payment** (see 7).

**P7 — contact details and accessibility.** The contact details are **placeholders**:
`hello@bookhaven.co.ke`, `+254 712 345 678`, "The Junction Mall, Nairobi". None were
invented by this work and none were replaced with guesses. They are now centralised and
overridable through `NEXT_PUBLIC_STORE_*` (documented in `.env.example`), with
`STORE_CONTACT.usingPlaceholders` exposed so the owner can be reminded. Accessibility work
in this pass was limited to the new checkout state (a real `role`-free block with plain
language, 44 px targets, text plus colour, no colour-only signal). No device or browser
testing was possible in this environment.

---

## 7. Tests actually run

| Command | Result |
| --- | --- |
| `node scripts/mpesa-callback-smoke.mjs` | **PASS** — 13 sections, ~90 assertions |
| `node scripts/cart-smoke.mjs` / `price-smoke` / `store-wiring` / `delivery-smoke` | PASS |
| `node scripts/mpesa-smoke.mjs` | PASS |
| `node scripts/agent-smoke.mjs` | PASS |
| `npx eslint app/api app/lib` | 0 errors, 0 warnings in changed files (repo-wide: 0 errors, 7 pre-existing warnings) |
| `npx next build` | PASS, 27/27 routes |
| `node scripts/smoke.mjs http://127.0.0.1:3160` | **24 passed, 9 skipped** — identical to the pre-change baseline; the 9 skips are admin routes that need a service-role key, absent locally |

Notes on the build: `app/layout.js` uses `next/font/google`, which cannot fetch fonts in this
sandbox. The build was run with a temporary local shim for the two font objects and the file
was restored immediately afterwards (`git diff` on `app/layout.js` is empty). CI on Vercel is
unaffected.

**Not run, and why:**

- No test against real Daraja. That would move money (rule: no live financial transactions).
  All provider behaviour is mocked.
- No test against the live Supabase database beyond the post-apply verification in section 8.
  No end-to-end order was placed against it.
- No browser or device testing, no screen-reader run, no Lighthouse pass.

---

## 8. Migrations

| File | Status |
| --- | --- |
| `20261023113622_mpesa_callback_integrity.sql` | **APPLIED 2026-10-23.** `mpesa_callbacks`, receipt uniqueness, `place_order` exact-amount + receipt + line aggregation, `mpesa_payments` write revokes |
| `20261023113634_profile_role_and_write_surface.sql` | **APPLIED 2026-10-23.** Creates the role trigger (production already had it, so no behaviour change), column-level `profiles` grants, revokes browser writes on `orders`/`books`/`newsletter_subscribers`, narrows the newsletter policy to INSERT-only |
| `20261020030000_profile_role_hardening.sql` | **Comment-only "superseded" pointer.** Never applied; applying it would have created a second, differently-named trigger |
| `20261020000000`, `20261020010000`, `20261020020000`, `20261021110000` | Unchanged. `20261021110000_delivery_rate.sql` **is live** but was applied by hand and is still **absent from `supabase_migrations.schema_migrations`** |

Both files were applied through the Supabase migration API, so they are recorded as
`20261023113622` and `20261023113634` in `supabase_migrations.schema_migrations` — the file
names were changed to those timestamps so a future `supabase db push` does not try to replay
them. The SQL submitted was these files' statements with the explanatory comments removed;
the post-apply checks below confirm every object and guard is present.

### Post-apply verification (run against the live project)

| Check | Result |
| --- | --- |
| `to_regclass('public.mpesa_callbacks')` | `mpesa_callbacks` |
| `pg_indexes` for `mpesa_payments_receipt_key` | 1 row |
| `has_table_privilege('anon','mpesa_payments','UPDATE')` | `false` |
| `place_order` body | contains `v_wanted` (line merge), `order by key::bigint` (lock order), `v_pay.mpesa_receipt is null` and `v_pay.amount is distinct from v_total` |
| Customer updating their own **name** under RLS | succeeds |
| Customer updating their own **role** under RLS | **fails** — `42501 permission denied for table profiles` |
| `trg_protect_profile_role` | present, enabled (`tgenabled='O'`) |
| `has_table_privilege('authenticated','orders','INSERT')` | `false` |
| `has_table_privilege('authenticated','books','UPDATE')` | `false` |
| `has_table_privilege('anon','newsletter_subscribers','DELETE')` | `false` |

Applying `20261023113622` **replaced the deployed `place_order`**. The new definition was
diffed against `pg_get_functiondef()` before and after; the only differences are the payment
guard and the line aggregation described above.

## 9. Owner actions

1. ~~Apply the two migrations.~~ **Done 2026-10-23** (section 8).
2. **Real contact details**: email, phone, location, hours — or accept that the site publishes
   placeholders.
3. **Email**: buy/verify a domain, then set `RESEND_API_KEY` and `EMAIL_FROM` as Supabase
   edge-function secrets. Until then no customer receives an email.
4. **One real M-Pesa payment** after the migrations are applied, to prove the whole path end
   to end. As of this audit the `mpesa_payments` table contains **16 rows and zero
   completions** — every attempt so far has failed at Safaricom (codes 2002, 2029, 4999,
   1032, 1037). That is a separate problem from everything above and it is still open.
5. **Durable rate limiting** if the store gets real traffic (requires a Redis account).
6. Confirm the Vercel production deployment serves the commit that contains this change
   before announcing anything.

---

## 10. Launch checklist

| Item | Status |
| --- | --- |
| Forged callback cannot complete a payment | **Pass (code, mocked tests)** |
| Callback verified server-to-server with Daraja | **Pass (code)** |
| Exact amount enforced | **Pass** — code and database |
| Receipt stored and unique | **Pass** — unique index live |
| Unmatched callbacks preserved | **Pass** — `mpesa_callbacks` live |
| Role escalation blocked | **Pass** — two layers (trigger + column grants) |
| Browser cannot write orders/books/payments | **Pass** |
| Subscriber list not readable by `anon` | **Pass** |
| Order totals recomputed server-side | **Pass** |
| Duplicate cart lines cannot oversell | **Pass** |
| Idempotent order creation | **Pass** |
| Admin routes authorised server-side | **Pass** |
| Assistant is read-only and bounded | **Pass** |
| Email never claims false success | **Pass (code)**; delivery **not configured** |
| No secrets in the repository or the logs | **Pass** |
| Build, lint, existing tests | **Pass** |
| End-to-end paid order has ever succeeded | **Fail — never observed** |

---

## 11. Appendix — sign-up / sign-in page

Requested separately from the audit: rebuild `/login` to match the supplied reference
(warm cream room, headline and feature list on the left, a white form card on the right,
kittens moving around the scene).

**What was built**

- `app/components/KittenScene.js` + `app/components/kitten-scene.module.css` — the room
  (floor, rug, shelf, plant, book stack, mug) and four kittens: Mochi (cream, navy ribbon),
  Biscuit (orange), Shadow (asleep on the books) and Ash (sitting, tail swishing). Pure SVG
  and CSS transforms; no image files, no animation library, no canvas.
- `app/login/page.js` — now a **server component** that reads `mode`, `tab` and `next` from
  the query string, so the room, headline and labels are in the first HTML byte. It used to
  render nothing but "Loading…" until JavaScript arrived.
- `app/login/AuthClient.js` — the interactive half: the three forms, the password
  checklist, the Supabase calls and the redirects.

**Behaviour that did not change**

- Same `signIn` / `signUp` / `resetPasswordForEmail` calls, same redirect rules
  (`next` must be a same-origin path), same admin-vs-customer destination lookup, same
  "already signed in → leave the page" effect, same email-confirmation state.
- The sign-in form is byte-for-byte the same logic; the reset form is the same.
- No phone field on sign-up: it was optional, it is still collected at checkout, and it can
  be added in `/account`. This matches the reference, which has name, email and password.

**Changes that are deliberate**

- **Password rules are now real.** The reference shows a four-item checklist. The form now
  *enforces* all four (8+ characters, one uppercase, one number, one symbol) rather than
  only the 8-character rule. This is enforced in the sign-up form; Supabase's own project
  minimum is 6 characters and was left alone, so a script calling the auth API directly
  would not be held to it. The checklist is only shown where it applies (sign-up).
- **No "Continue with Google".** Google is disabled on this Supabase project
  (`external_google_enabled: false`) and nothing in the code calls
  `signInWithOAuth`. Showing the button would be a dead control.
- **The primary button is navy on this page**, as in the reference, instead of the store's
  sienna. Sienna stays the colour for inline links; contrast is unchanged at 13:1.
- Names are captured as one "Full name" field and split into first / remaining names for
  the existing profile metadata.

**Accessibility and motion**

- Decorative layer is `aria-hidden` and `pointer-events: none`; it never covers the form or
  takes a click. Kittens are behind the content.
- `prefers-reduced-motion: reduce` stops every animation and parks the kittens in fixed
  positions.
- Labels are real `<label for>` elements; errors are wired with `aria-describedby` and
  `aria-invalid`; the password checklist changes icon as well as colour.
- Two smaller kittens are hidden below `sm` and `lg` so phones get less movement.

**Open redirect**

`next` is accepted only if it starts with a single `/`, does not start with `//`, does not
start with `/\`, and is under 300 characters. Checked against the running build:
`?next=//evil.com` and `?next=\\evil.com` produce plain `/login` links, while
`?next=/account/orders` is carried through the tab links as
`/login?tab=register&next=%2Faccount%2Forders`.

**Also fixed while here**

`app/checkout/page.js` moved to an `unconfirmed` stage when the 60-second M-Pesa window
closed, but no screen was ever written for it, so `MpesaFlow` returned `undefined` and React
threw. In practice a customer whose payment was not confirmed within a minute hit a blank
checkout. There is now a real screen for that state: it does not claim failure, tells the
customer not to pay twice, offers "Check again" (which restarts both the countdown and the
polling) and "Change number".

**Not verified**

- No browser or device was available in this environment, so there is **no screenshot, no
  cross-browser check, no Lighthouse run and no screen-reader run**. Layout was reasoned
  against the four breakpoints and the build, lint and HTTP checks pass, but visual review
  on a real screen is still owed.
- No account was created and no sign-in was performed: that would write real users into the
  production project. The form logic is unchanged apart from the name split and the
  stronger password rule.
