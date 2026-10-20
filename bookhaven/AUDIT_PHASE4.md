# Book Haven — UI, Responsive & Security Audit

**Date:** 20 October 2026
**Scope:** `bookhaven/` (Next.js app router), Supabase schema/migrations, Vercel production deployment
**Base commit:** `90be087` → **head:** PRs #17–#25 (assistant + Phase 7)
**Production:** https://bookstore-puce-sigma.vercel.app

---

## How this was verified — read this first

| Check | Method | Result |
| --- | --- | --- |
| Build | `npx next build --webpack` (Next 16.4.2) | ✅ compiled successfully, 31 routes |
| Lint | `npx eslint .` | ✅ 0 errors, 7 warnings (unused vars, `<img>` in admin) |
| Dependencies | `npm audit` / `npm audit --omit=dev` | ✅ 0 production vulnerabilities; 5 high **dev-only** advisories in the ESLint toolchain |
| Security headers | `scripts/smoke.mjs` against a local `next start` | ✅ 24 checks pass, 9 skipped (no service-role key locally) |
| Admin assistant loop | `scripts/agent-smoke.mjs` — mocked provider + stub DB | ✅ 6 turns: tool dispatch, clamping, reference search, error mapping |
| Admin assistant UI | build + code review | ⚠️ needs an admin session; see limitation 5 |
| Public pages | `fetch_page` against production after each deploy | ✅ home, `/books`, `/books?page=2`, `/category/finance`, `/books/deep-work-4`, `/checkout` gate |
| Redirects | production fetch | ✅ `/books/2` → canonical slug, unauthenticated `/orders/<uuid>` → `/login` |
| Layout at 320–1920 | **Static review only** | ⚠️ see limitation below |
| Authenticated admin UI | **Code review + build only** | ⚠️ see limitation below |
| M-Pesa | **Not exercised** | ⚠️ by your instruction (configure at go-live) |

**Environment limitations, stated plainly:**

1. **No browser or device was available.** The sandbox cannot download a headless browser (the Playwright CDN is outside the network allow-list), so no screenshots were taken. Responsive work was verified by reading every layout, auditing Tailwind breakpoints in the markup, and confirming the production HTML — not by looking at pixels. A real pass at 320/360/375/390/430, 600/768/820/1024 and 1280/1366/1440/1920 on physical devices is still owed.
2. **Dribbble was not inspected.** Browsing to Dribbble was not possible from this environment, so the visual direction came from your written brief (cream/navy/sienna, Playfair + Inter, no gradients or glass) and from established typographic/bookshop conventions. No claim is made that specific Dribbble shots were studied.
3. **No database credentials.** RLS policies for the *base* tables are not in this repository, so their live state could not be read. Findings that depend on them are marked **unverified** rather than "fixed".
4. **This was not a penetration test.** It is a source-level review plus targeted verification of what could be exercised without production data.
5. **The assistant was verified without a live model or admin session.** The tool loop, argument clamping and error mapping are exercised against a scripted mock provider and a stub database; the panel is build-checked and the route's anonymous guard is checked over HTTP. No real model answer and no signed-in click-through of the panel has been observed.

---

## A. UI/UX

**Design system (unchanged direction, now applied consistently).** Cream `#FAF6EE`, navy `#1B2A4A`, sienna `#B5532F` as the single action colour, ink/muted/line neutrals, 8/12 px radii, Playfair headings and Inter body. Contrast was measured for every text token (see §E). There are no gradients in UI chrome and no glassmorphism; the only gradients left are inside the generated CSS book covers, where they act as printed texture on an object rather than as interface styling.

**Storefront**
- Home is a server component: hero, real catalogue counts, genre strip with live per-genre counts, newest titles, how-ordering-works, shop facts, trust strip, newsletter. Every number comes from `books`; no invented ratings, review counts, staff bios or delivery promises.
- Catalogue and category pages are server-rendered from URL state (`q`, `category`, `sort`, `price`, `availability`, `page`), so the HTML a crawler receives matches the URL. Loading skeletons, an error panel with a retry, and an empty state that names the query and offers "clear filters".
- Book detail: real stock label, quantity capped at the shelf count, delivery rule stated before checkout, related titles.
- Checkout: one page, delivery then payment, server-computed totals. An empty basket now answers before the sign-in gate and has the shop header, so it is not a dead end. Signed-out users see a sign-in gate that explains *why* an account is required.
- Account: rebuilt on the shared store shell. No gradient banner, no emoji tabs, no duplicated header. Orders show fulfilment and payment as two separate, labelled states; money owed is stated explicitly ("KSh X due on delivery").
- Copy honesty pass: removed an invented "1–2 business days / 2–4 business days" delivery estimate and an unverified "we confirm every order by phone before dispatch". The confirmation now says no receipt email is sent yet, because SMTP is deliberately off.
- Removed dead/fake affordances: the admin search field that did nothing, the notification bell with a hard-coded red dot, an orphaned `Navbar.js`, and the unused live-books hook.

**Admin assistant (`/admin` → Assistant)**

A read-only natural-language layer over the store, added in Phase 7. Ask "what needs my attention today?", "summarise the last 7 days", "which titles are low on stock?" and it answers from seven SELECT-only tools (metrics, orders, one order, low stock, book search, customers, stock movements).

- **No write path exists.** There is no tool that mutates anything. A prompt injected through an order note or a confused model cannot mark an order paid, delete a book or move stock — the capability is absent, not merely discouraged.
- **Authorization is the existing one.** `/api/admin/agent` calls `requireAdmin()` first; the model never sees a request from a non-admin.
- **Secrets stay server-side.** `ANTHROPIC_API_KEY` is read only in `app/lib/agent-provider.js`. The browser talks to `/api/admin/agent`, never to the provider.
- **Grounded answers.** The system prompt forbids estimating and requires the time window to be stated; each answer lists the tools it read. Missing numbers are reported as missing.
- **Bounded.** 20 questions per admin per 10 minutes, 5 tool rounds, 10 tool calls, 14 messages, 20k characters; tool arguments are clamped in code (asking for 5,000 rows returns 25).
- **Honest when unconfigured.** With no key the tab shows a real 7-day snapshot computed in SQL and the exact setup steps, with chat disabled — it never fakes an answer.
- Tool output is truncated and treated as data; the panel renders plain text only, so model output cannot inject HTML.

**Admin** — see §C.

---

## B. Responsive

Breakpoint strategy, applied in markup: `320–430` single column; `600–820` two columns; `1024+` the full desktop layout. Tailwind's `lg` (1024) is the point where the admin sidebar and the orders table appear.

**Header** — 44 px targets throughout. Menu button and search toggle below `lg`/`md`; search collapses to an icon and expands to a full-width form; account menu collapses to an icon below `sm` and hides its label text (the control keeps its `aria-label`). The announcement bar wraps to two lines at 320 px rather than overflowing.

**Grids** — catalogue `2 → 3 → 4 → 5` columns; genres `2 → 4 → 8`; product facts `1 → 2`; checkout `1 → [form | 360 px summary]` with the summary sticky only at `lg`.

**Footer** — 2 columns on phones (brand spans both), 4 from `md`.

**Tables** — the brief's real problem. Orders had eleven columns that could only scroll horizontally on a phone. Below `lg` they are now **cards**: reference, customer, phone, town, total, payment state with its label, status badge, an inline status selector with 44 px targets, and a "Details" disclosure containing the full item list with covers, delivery address, subtotal/delivery/total, payment reference, and the cancel action. The table is only rendered at `lg+`.

Books and inventory columns collapse rather than scroll: category/featured/rating and threshold/last-updated are hidden below `md`/`lg`, while price moves under the title on phones so it is never lost. Row actions in Products were `opacity-0 group-hover` — invisible on every touch device — and are now always visible below `md`.

**Dialogs** — one `Modal` wrapper: bottom sheet on phones, centred panel from `sm`, `max-h-[92dvh]` with internal scrolling, `role="dialog"`, `aria-modal`, labelled heading, Escape to close, focus trapped and restored. The admin shell uses `100dvh` so mobile browser chrome cannot clip the sidebar.

**Known remaining risk:** the stock-history table inside its dialog still scrolls horizontally on a 320 px screen (five dense columns). It is inside a scroll container and does not overflow the page, but it is the one table where a phone user must swipe.

---

## C. Admin dashboard

- **Navigation:** permanent 240 px sidebar only at `lg+`. Below that, a slide-over drawer with section headers, `aria-current`, 44 px rows, focus trap and body-scroll lock. The topbar shows the current section name so the admin always knows where they are.
- **Identity:** the topbar used to say "Felix Mwaura" regardless of who was signed in. It now reads the session's metadata/email.
- **Mobile orders:** full detail is reachable in one tap; nothing is hidden behind a hover.
- **Sensitive actions:** delete book, cancel order, restock, role change and bulk status changes all go through a confirm dialog. Role changes cannot be applied to your own account. Every mutation hits `/api/admin/*`, which re-verifies the JWT and the `profiles.role` server-side — the UI is never the boundary.
- **No fabricated metrics:** the overview reads real orders/books/users and labels its time range. Empty and error states are distinct (a failed request no longer looks like "zero books").
- **Remaining admin gaps:** no CSV export, no bulk book import, payments/reports/reviews/coupons/settings are explicit placeholders rather than pretend screens. That is honest, but it means the dashboard is an operations tool for orders/stock/customers only.

---

## D. Security findings

Severity is my assessment of impact in this deployment. "Confirmed" means I reproduced it in source or over HTTP; "unverified" means it depends on database state I could not read.

### Fixed in this pass

| # | Severity | Finding | Impact | Fix | Verification |
| --- | --- | --- | --- | --- | --- |
| D1 | **High** | Password reset was a dead end: the email link redirected to `/account`, which had no password field at all | A locked-out customer could never regain access; support burden, lost orders | Account page opens a password panel for both link shapes (implicit `#type=recovery` and PKCE `?code=`), waits for the session exchange instead of bouncing to sign-in, validates length/letters+digits/match, calls `updateUser`, then strips the token from the URL | Build + code path; **not** exercised against a real inbox |
| D2 | **High** | `next@16.2.4` was inside the affected range of GHSA-8h8q-6873-q5fj (Server Components DoS), plus 4 transitive advisories (`postcss`, `sharp`, `nanoid`, `source-map-js`) | Remote denial of service against a public site | Upgraded `next` and `eslint-config-next` to 16.4.2 | `npm audit --omit=dev` → **0 vulnerabilities**; build + all production pages verified after the upgrade |
| D3 | **Medium** | No security headers at all (no CSP, no frame protection, no HSTS) | Clickjacking of admin actions; MIME sniffing; referrer leakage | `next.config.ts` adds `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`, a permissions policy, HSTS, and `poweredByHeader: false` | `curl -I` on a local production build shows all six |
| D4 | **Medium** | `POST /api/orders` had no throttle | A stolen session could create orders/stock holds in a loop | Database-backed per-user ceiling (8 orders / 10 min → 429), so it holds across serverless instances | Code review; not load-tested |
| D5 | **Medium** | Newsletter signup inserted straight from the browser with the public anon key — no validation, no ceiling, rows written by any script | Table flooding; a spam list you would have to clean | New `POST /api/newsletter`: server-side format/length validation, honeypot, duplicate-as-success, per-instance IP limiter, service-role insert | Route + client wired; build verified |
| D6 | **Medium** | Touch devices could not reach Edit/Delete on Products (hover-only reveal) | Admin cannot manage stock from a phone | Actions always visible below `md` | Code + class audit |
| D7 | **Low** | Invented delivery ETAs and an unverified phone-confirmation promise | Consumer-protection / trust risk | Removed; replaced with the actual flat-rate delivery rule | Production copy checked |

### Already correct, confirmed by reading the code (no change needed)

- **Server-side authorisation.** Every `/api/admin/*` handler starts with `requireAdmin()` → verified JWT → `profiles.role === "admin"` read server-side → 401/403/500. `proxy.js` is a UX gate only; the page and the APIs re-check.
- **Price integrity.** `POST /api/orders` accepts only `{ id, quantity }` and lets `place_order()` re-read prices, stock and delivery from the database. The client's total is never sent. `POST /api/mpesa/stk` prices the cart with `quote_cart()` and stores `expected_amount` before Safaricom is called.
- **Payment integrity.** `/api/mpesa/callback` can only update a pre-created `pending` row, requires `amount ≥ expected_amount`, is idempotent, and never writes to `orders`. A forged success needs a valid unguessed `CheckoutRequestID`.
- **Order ownership.** Order reads use the caller's JWT with `user_id = auth.uid()` RLS; `/orders/[id]` returns 404 for someone else's id, so it does not confirm the order exists.
- **Inventory.** Stock changes are atomic inside `place_order()`/`adjust_book_stock()` with an audit trail in `stock_movements`; insufficient stock returns 409 with the real remaining count.
- **CSRF posture.** No cookie-authenticated mutations exist: the browser talks to Supabase with its own token and to the app's APIs with `Authorization: Bearer`. There is nothing for a cross-site form post to ride. `SameSite` cookie defaults still apply to the SSR session.
- **XSS.** No `dangerouslySetInnerHTML` on user data (only the JSON-LD constants). Book titles/descriptions render as text. The one rich-text component escapes parity through React.
- **Secrets.** `SUPABASE_SERVICE_ROLE_KEY`, Daraja credentials and `RESEND_API_KEY` are read only in server modules; nothing sensitive is prefixed `NEXT_PUBLIC_`.

### Open — needs your database or dashboard

| # | Severity | Finding | Why it matters | Remediation | Status |
| --- | --- | --- | --- | --- | --- |
| D8 | **High** | `profiles.role` may be self-editable. The base schema is not in version control, so the UPDATE policy cannot be inspected. If it is the common `using (auth.uid() = id)`, any signed-in customer can promote themselves to admin | Full takeover of orders, customers, stock and payment status | `supabase/migrations/20261020030000_profile_role_hardening.sql`: revokes table-wide UPDATE from `anon`/`authenticated`, grants only `(first_name, last_name, phone)`, and adds a trigger that rejects role changes made with an end-user JWT | **Prepared, not applied.** Apply it, then run the four checks at the bottom of the file |
| D9 | **High** (deployment) | `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_MPESA_ENABLED` are not set in Vercel | Canonicals/OG/sitemap point at the `.vercel.app` host (so a future domain would split SEO), and M-Pesa stays hidden even after you configure Daraja | Set both in Vercel → Settings → Environment Variables, then redeploy | Open |
| D10 | **Medium** | `mpesa/callback` is unauthenticated by design (Daraja does not sign callbacks) | Relies entirely on the unguessable checkout id, the pending-row rule and the amount check | When you go live: append a secret path/query to `MPESA_CALLBACK_URL` and reject mismatches, or allow-list Safaricom's IPs. Test in the sandbox first | Open — deliberately deferred with M-Pesa |
| D11 | **Medium** | Policies for `profiles`, `orders`, `wishlist`, `addresses`, `newsletter_subscribers` are not in the repo | Cannot review or reproduce the security model from source; drift is invisible | `supabase db pull` and commit the schema; keep migrations the only way changes reach the DB | Open |
| D12 | **Medium** | `book-covers` storage bucket policy is unverified; uploads happen from the admin browser with the user's JWT | A permissive policy would let any signed-in user upload/replace covers; no server-side MIME sniffing | Confirm the bucket allows INSERT/UPDATE only when `is_admin()`, sets a 2 MB limit and an image MIME allow-list | Open |
| D13 | **Medium** | Rate limiting is per-instance for `/api/newsletter` | On Vercel, fresh instances reset the counter | Move to a shared store (Upstash/Redis) or Vercel Firewall rules | Open |
| D14 | **Low** | CSP has no `script-src` (Next inline bootstrap would break without a nonce) | Weakens defence-in-depth against injected scripts; the rest of the policy still blocks framing, base-tag hijacking and foreign form posts | Add a nonce-based `script-src` once the app is on a custom domain and can be re-tested | Open |
| D15 | **Low** | No automated tests | Regressions are caught by hand | Playwright smoke tests for the six public routes + one admin mutation | Open |

### The assistant (new surface, reviewed on its own terms)

| Risk | Mitigation | Status |
| --- | --- | --- |
| Model performs a destructive action | No write tool exists; the route has no mutation path | Confirmed by code |
| Prompt injection via order notes / customer names | Tool output is data-only text; system prompt forbids following it; no capability to abuse even if followed | Confirmed by design |
| Key leaked to the browser | Key read only in a server module; browser calls the app route | Confirmed by code |
| Unauthenticated use | `requireAdmin()` runs before body parsing | Verified over HTTP (401/403) |
| Cost abuse / loops | 20 questions/10 min per admin, 5 rounds, 10 calls, 14 messages, 20k chars, 45 s provider timeout | Verified in the mocked loop for rounds/calls; the limiter is per instance |
| Data over-exposure | Tools return trimmed rows; customer contact only where an order needs it; results truncated at 12k chars | Confirmed by code |
| Provider text leaking internals | Provider errors are mapped to fixed sentences; raw bodies go to `console.error` only | Verified in the smoke test |

### Ground truth on what "fixed" means here

D1–D7 were changed and built, and the public-facing ones were re-fetched from production. None of them is a claim that the app is now secure end to end: **D8 and D11 are the two that decide whether the admin surface is actually protected**, and both need the database.

---

## E. Performance & accessibility

**Performance**
- Home, catalogue, category, book detail and order pages render on the server; only the header, cart, wishlist and the admin client ship as client components.
- Covers use `next/image` with `fill` and explicit `sizes` (`(min-width: 1024px) 220px, …`), so no layout shift and no full-size image on a phone. Remote patterns are restricted to the configured Supabase host.
- Fonts are self-hosted by `next/font` with `display: swap`; no third-party font request.
- Catalogue queries filter and paginate in Postgres (`range`, `count: exact`), not in the browser.
- Removed a client hook that opened a Realtime channel plus a 60 s poll for catalogues that are now server-rendered. The storefront now holds no Realtime subscription at all. The admin dashboard keeps one (`orders` + `books`), debounces refetches by 400 ms, ignores event payloads, and removes the channel and its timer on unmount.
- Home is ISR (`revalidate = 60`); dynamic pages are dynamic because stock must be accurate, which is the right trade for this shop.

**Accessibility (WCAG 2.2 AA where practical)**
- Skip link, one `<h1>` per page, labelled landmarks and `<nav>` elements, `aria-current` on navigation.
- All form controls have labels (visible or `sr-only`), errors use `role="alert"` and `aria-invalid`, and the checkout's phone/email validation is announced.
- Status is never colour alone: badges carry a mark and the word ("✓ Paid", "× Cancelled"); stock labels say "Only 3 left".
- 44 px minimum targets across header, drawers, tables and dialogs; a visible focus ring on every interactive element.
- Dialogs trap focus, restore it, close on Escape and stop background scrolling.
- Measured contrast (WCAG formula): ink/cream 14.4:1, navy/cream 13.2:1, muted/cream 5.7:1, muted/white 6.1:1, sienna/cream 4.6:1, white/sienna 5.0:1, white/navy 14.2:1, success/white 5.0:1, error/white 6.5:1, muted/subtle 5.2:1. All pass AA for normal text. The `warning` token alone is 3.6:1 — it is only used as a tint/border, never as small text.
- Residual issues: the mobile drawer duplicates the desktop nav in the DOM (hidden with `display:none`, so not announced, but it is extra markup); the book page's sticky buy bar repeats the purchase controls that also appear inline.

---

## F. Testing results

| Test | Result |
| --- | --- |
| `npx next build --webpack` (Next 16.4.2) | ✅ compiled; 31 routes (18 API, 13 pages/static) |
| `npx eslint .` | ✅ 0 errors, 7 warnings |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| `npm audit` (incl. dev) | ⚠️ 5 high in `eslint-config-next`'s `fast-glob`/`braces`/`micromatch` chain — build-time only, no fix without an ESLint major |
| Security headers on a production build | ✅ all six present |
| `/` production | ✅ 14 titles, live genre counts, no broken images |
| `/books` | ✅ 14 titles, 12 per page, pagination, stock labels, discount chips |
| `/books?page=2` | ✅ 2 remaining titles, no error state |
| `/books?sort=price-asc&price=under-1000` | ✅ empty state with removable filter chip |
| `/category/finance` | ✅ 2 titles, correct title tag, breadcrumb |
| `/books/deep-work-4` | ✅ "Only 3 left", quantity stepper, add to basket, related row |
| `/books/2` | ✅ redirect to canonical slug |
| `/checkout` signed out | ✅ gate with `?next=%2Fcheckout`; empty basket answered first |
| `/orders/<uuid>` signed out | ✅ redirect to `/login` |
| Admin at 1280+ | ✅ build + code review (authenticated UI not re-exercised) |
| Admin below `lg` | ⚠️ code-level only |
| `scripts/smoke.mjs` (local production build) | ✅ 24 passed, 9 skipped (privileged routes need the service key) |
| `scripts/agent-smoke.mjs` | ✅ 6 turns passed |
| `POST /api/admin/agent` unauthenticated | ✅ 401/403 on the deployed build |
| Assistant answered by a real model | ⚠️ not run — no API key in this environment |

**Failures encountered and fixed during the pass:** none in production. One regression risk was found and corrected before deploy (the basket could flash "empty" before `localStorage` finished loading — now gated on `cartReady`).

---

### Phase 7 — final validation

1. `npm run agent:smoke` — 6 turns through the real loop with a scripted provider: metrics, low stock, reference search, town search, `get_order`, argument clamping, unknown-tool rejection and 401 mapping.
2. `npm run build` — 31 routes compile, including `/api/admin/agent`.
3. `npm run smoke http://127.0.0.1:3126` — 13 public pages, 2 redirects, 7 headers, 9 admin guards, order API and newsletter validation: **24 passed, 9 skipped** (the skips are the service-role guard on a machine without the key, each correctly naming the missing variable).
4. Deployed to production, then the same script was pointed at the live host to confirm the guards return 401/403 there rather than the local 500.
5. `npx eslint .` — 0 errors.
6. Unresolved: no signed-in pass over the assistant panel and no live model answer (no key, no admin session here).

## G. Files changed

```
app/account/page.js                     rebuilt on the store shell; password recovery + change
app/admin/admin-client.js               drawer nav, mobile order cards, responsive tables,
                                        shared Modal, topbar identity, touch-visible actions
app/api/orders/route.js                 per-user order throttle (429)
app/api/newsletter/route.js             new: validated server-side signup + limiter
app/checkout/page.js                   empty-basket first, focused chrome, honest copy, cartReady
app/components/HomeClient.js           server-side newsletter call; dl semantics
app/components/StoreShell.js           footer wordmark (emoji removed)
app/components/Navbar.js               deleted (orphaned)
app/lib/useLiveBooks.js                deleted (no remaining consumer)
next.config.ts                         security headers, poweredByHeader off
package.json / package-lock.json       next + eslint-config-next → 16.4.2
supabase/migrations/20261020030000_profile_role_hardening.sql   new, NOT applied
app/admin/assistant-tab.js             new: assistant panel (read-only, snapshot, setup state)
app/api/admin/agent/route.js           new: admin-only GET snapshot / POST conversation
app/lib/admin-agent-tools.js           new: 7 read-only tools with validation and clamping
app/lib/agent-runner.js                new: bounded tool-use loop (max 5 rounds / 10 calls)
app/lib/agent-provider.js              new: Anthropic Messages adapter, no SDK, no key leakage
app/admin/admin-client.js              Assistant entry in nav, topbar label, tab route
scripts/agent-smoke.mjs                new: offline tool-loop test (mock provider + stub DB)
scripts/smoke.mjs                      new: HTTP status/header/auth-guard smoke test
README.md / .env.example               assistant setup, env vars, test commands
AUDIT_PHASE4.md                        this report
```

---

## H. Remaining work

**Must happen before you take real money**

1. **Apply and verify `20261020030000_profile_role_hardening.sql`**, then run its four checks. Until then D8 is an open high-severity risk.
2. **Commit the schema.** `supabase db pull` so policies are reviewable and reproducible (D11).
3. **Set `NEXT_PUBLIC_SITE_URL`** to the final domain and **`NEXT_PUBLIC_MPESA_ENABLED=true`** only once Daraja is tested (D9).
4. **Test M-Pesa end-to-end in the Daraja sandbox**: STK → callback → `query` reconciliation → `place_order`. Include the failure paths (timeout, wrong amount, duplicate callback) and confirm the confirmation screen never claims success before the server does.
5. **Confirm the storage bucket policy** for `book-covers` (admin-only writes, 2 MB, image MIME list) — D12.
6. **Replace or confirm the contact details** in `app/lib/site.js`: `hello@bookhaven.co.ke`, `+254 712 345 678`, "The Junction Mall, Nairobi", "Mon–Sat 9am–7pm". These read like placeholders; if they are, customers are being given a phone number and address that do not exist — the single most damaging honesty problem left.

**Should happen soon**

7. Device pass at every required width (320/360/375/390/430, 600/768/820/1024, 1280/1366/1440/1920) with a real browser; fix anything the static review could not see.
8. Durable rate limiting shared across instances (D13).
9. Decide the stock-history dialog: card layout or a wider sheet.
10. SMTP (when you have the domain): set `RESEND_API_KEY` + `EMAIL_FROM`, deploy `supabase/functions/send-email`, and replace the "no receipt email is sent yet" notice on the confirmation screen.
11. Add the password-recovery email template review in Supabase (the redirect URL must be in the allow-list, or the link silently fails).
12. Automated smoke tests (D15) and a nonce-based CSP (D14). **Partly done:** `scripts/smoke.mjs` and `scripts/agent-smoke.mjs` cover the public surface, headers, admin guards and the assistant loop. They are not wired to CI yet.
13. **Assistant:** add `ANTHROPIC_API_KEY` in Vercel to switch chat on, then ask two or three real questions as the admin and confirm the answers match the Orders/Inventory screens. Pin `ANTHROPIC_MODEL` if the default is unavailable on your account.
14. **Assistant cost control:** each answer is at most 5 model calls. If usage grows, add a monthly token budget and log token counts per admin (the route already returns `usage`).

---

## I. MVP readiness

**As a shop that takes cash on delivery: functionally ready, with one security gate.**

The admin now also has a read-only assistant. It is an operations convenience, not a launch dependency: with no key the dashboard is exactly as it was, and with a key it can only read. Nothing in the launch decision depends on it.

The storefront is fast, honest, server-rendered and usable from a 320 px phone through a desktop. Orders are priced and stock-checked server-side, duplicate submissions are idempotent, and the admin can run orders and inventory from a phone. That is a working MVP for pay-on-delivery.

**I am not declaring it production-ready as a business yet**, because four things are outside what this pass could verify or fix:

- **D8** (possible privilege escalation via `profiles.role`) is unresolved until the migration is applied and checked. If the policy is permissive, an attacker with any customer account can become an admin.
- **D9** (missing environment variables) leaves SEO pointing at a temporary host and M-Pesa invisible.
- **M-Pesa is untested** by your own instruction, so the payment path is a well-reviewed design rather than a proven one.
- **Contact details look provisional**, which is a trust problem no amount of code can fix.

Close those, do the device pass, and the answer changes to yes. Everything else on the list is improvement, not a blocker.
