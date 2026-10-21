# BookHaven

Kenyan online bookstore built with Next.js 16 (App Router), React 19, Supabase
(Postgres, Auth, Storage, Realtime) and Tailwind CSS 4. Payments: M-Pesa STK
Push and cash on delivery.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm run build                # production build
npx eslint .                 # lint
```

Node 20+ is required.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Admin reads, order writes, storage cleanup |
| `ADMIN_EMAIL` | **server only** | Optional owner account that cannot be demoted |
| `MPESA_CONSUMER_KEY` | **server only** | Daraja app consumer key |
| `MPESA_CONSUMER_SECRET` | **server only** | Daraja app consumer secret |
| `MPESA_SHORTCODE` | **server only** | Paybill / till number |
| `MPESA_PASSKEY` | **server only** | STK push passkey |
| `MPESA_CALLBACK_URL` | **server only** | Optional. Defaults to `https://<site>/api/mpesa/callback`; must be public HTTPS |
| `MPESA_ENV` | **server only** | `sandbox` (default) or `production` |
| `MPESA_TRANSACTION_TYPE` | **server only** | Optional. `CustomerPayBillOnline` (default) or `CustomerBuyGoodsOnline` for a till |
| `ANTHROPIC_API_KEY` | **server only** | Optional. Enables the read-only assistant in `/admin` |
| `ANTHROPIC_MODEL` | **server only** | Optional model override (default `claude-sonnet-4-5`) |

M-Pesa switches itself on when the four credentials above are present **and**
the delivery rule in the database matches `DELIVERY_FEE` in `app/lib/site.js`.
Until then the checkout offers cash on delivery only, and `/admin → Payments`
says which of the two is missing. Checkout never shows a payment method that
would fail at the last step.

If the two `NEXT_PUBLIC_*` values are missing, the app falls back to the
project's public URL and anon key so an existing deployment keeps working.
Everything else must be configured explicitly; the server refuses to run a
privileged operation without `SUPABASE_SERVICE_ROLE_KEY` rather than silently
degrading.

## Database

The schema lives in Supabase (project `luniopceavtkljywukyi`). Key objects:

- `books`, `orders`, `profiles`, `addresses`, `wishlists`, `mpesa_payments`,
  `admin_activity_log` — all with Row Level Security enabled.
- `place_order(p_user_id, p_items, p_delivery_details, p_payment_method,
  p_checkout_request_id, p_idempotency_key)` — service-role only. Locks book
  rows, validates stock, prices from the catalogue, stores explicit
  `subtotal` / `delivery_fee` / `cod_fee` / `total`, verifies M-Pesa payments,
  and is idempotent per `(user_id, idempotency_key)`.
- `set_order_status(p_order_id, p_new_status, p_admin_id, p_admin_email)` —
  service-role only. Atomic transition + single restock on cancellation +
  activity log entry.
- `delivery_fee_rule()` — returns the delivery charge the app uses (currently
  `0`). `/api/mpesa/status` refuses to enable M-Pesa when this is missing or
  disagrees with `DELIVERY_FEE`, so a customer is never charged a total the
  database would reject.
- `restock_order`, `book_has_orders` — internal helpers.
- Storage bucket `book-covers` (public read, 2 MB limit, JPEG/PNG/WebP).

Pricing before an M-Pesa prompt is deliberately *not* a database round-trip
any more: `/api/mpesa/stk` reads `books.price` with the service role and
applies `DELIVERY_FEE`, and `place_order()` recomputes both before it writes
anything. That removes the old `quote_cart()` dependency, which was never in a
migration in this repository.

Orders cannot be written directly by any browser role: the `orders` table has
only SELECT policies. All inserts and status changes go through the functions
above, called with the service role from `/api/orders` and `/api/admin/orders`.

Delivery rule: delivery is free, so an order total is the sum of the books.
`DELIVERY_FEE` in `app/lib/site.js` is the number the checkout, the basket and
the STK route use; `place_order()` writes the same figure, and
`delivery_fee_rule()` exposes it so M-Pesa can refuse to switch on while the
two disagree. There is no COD surcharge.

## Security model

- Authorization is `profiles.role = 'admin'`, checked server-side by
  `requireAdmin()` on every `/api/admin/*` route. Hiding a button is never the
  control; `ADMIN_EMAIL` is only an anti-lockout marker.
- `proxy.js` (Next 16's replacement for `middleware.js`) gates `/admin`
  pages; `app/admin/page.js` and each admin API route re-check independently.
- Row Level Security restricts customers to their own orders, addresses and
  wishlist entries.
- The service-role key is only read inside server modules (`app/lib/server.js`,
  `app/lib/admin-auth.js`) and never with a `NEXT_PUBLIC_` prefix.
- M-Pesa callback can only *update* a pending payment that the server created
  before sending the STK prompt; it cannot insert payments and never writes to
  `orders`.

## Deployment (Vercel)

1. Import the GitHub repository and set the production branch.
2. Add every variable from `.env.example` under
   **Settings → Environment Variables** (Production + Preview).
3. Mark `SUPABASE_SERVICE_ROLE_KEY`, `MPESA_CONSUMER_SECRET` and
   `MPESA_PASSKEY` as **Sensitive**.
4. Set `MPESA_CALLBACK_URL` to `https://<your-domain>/api/mpesa/callback` and
   whitelist that URL in the Daraja portal. Daraja cannot call `localhost`.
5. Deploy, then sign in as an admin and open `/admin` to confirm the role
   check passes.

## Known limitations

- Email notifications are not implemented yet (order confirmation, dispatch,
  etc. are silent). The UI does not claim otherwise.
- Card payments are not implemented; only M-Pesa and cash on delivery are
  offered.
- `app/books.js` contains the original static demo catalogue. Pages read from
  Supabase; the file is not imported by any route.

## Admin assistant

`/admin` → **Assistant** is a read-only natural-language interface over the
store. It answers questions about orders, stock, customers and sales, and it
cannot change anything: every tool in `app/lib/admin-agent-tools.js` is a
SELECT, and the tab states that in the UI. Order edits, stock adjustments and
role changes stay in their own screens, behind confirmation and the audit log.

- Auth: the route reuses `requireAdmin()` (verified JWT → `profiles.role`).
  There is no unauthenticated path and no key in the browser.
- Grounding: the system prompt requires every number to come from a tool
  result, and the response shows which tools were read. Tool output is treated
  as data, never as instruction.
- Limits: 5 tool rounds, 10 calls, 20 questions per admin per 10 minutes.
- No key: the tab still renders a real 7-day snapshot and setup steps, and
  chat stays disabled rather than inventing answers.

Checks that need no credentials:

```bash
node scripts/agent-smoke.mjs   # mocked provider + stub DB: tool loop, clamping, errors
node scripts/smoke.mjs http://127.0.0.1:3000   # status codes, headers, auth guards
```
