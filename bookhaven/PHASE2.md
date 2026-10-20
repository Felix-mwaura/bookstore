# Phase 2 — operations, live updates and notifications

Scope: turn the storefront + dashboard into something that stays correct as order
volume grows. Phase 1 stabilised the money and auth paths; this phase makes the
store observable and operable.

## 1. Separate state machines (2.3)

`orders.status` and `orders.payment_status` are independent.

| Fulfilment | Meaning |
|---|---|
| `Pending` | accepted, not picked |
| `Processing` | being prepared (the default at checkout) |
| `Packed` | boxed, awaiting courier |
| `Shipped` | handed to the courier (labelled "Dispatched" in the UI) |
| `Delivered` | terminal |
| `Cancelled` | terminal, restocks once |

| Payment | Meaning |
|---|---|
| `pending` | COD or waiting for confirmation |
| `paid` | money received |
| `failed` | payment attempt failed |
| `refund_pending` | refund initiated |
| `refunded` | money returned |

Transitions are forward-only and enforced in `set_order_status()` /
`set_order_payment_status()` in Postgres, not in React. A `failed` payment can
never be dispatched. A non-COD order cannot be shipped unless `paid`. Cash on
delivery is exempt: its payment stays `pending` until the courier collects.

The constraints were **widened, not replaced** — all six existing orders kept
their values, so no data migration was required.

## 2. Metrics that can be defended (2.1)

`admin_dashboard_metrics(from, to)` computes every number in SQL. Definitions:

- **Net revenue** — `SUM(total)` where `payment_status = 'paid'` **and** the
  order is not `Cancelled`. Refunds fall out automatically because the payment
  status changes to `refunded`.
- **Gross order value** — every non-cancelled order, paid or not. Never shown
  as "revenue".
- **Awaiting dispatch** — `Pending`/`Processing`/`Packed` with a non-failed
  payment.
- **Best sellers** — units inside `Delivered` orders only.

The dashboard fetches this for a date range (today / 7 / 30 / 90 days) and
renders loading, empty and error states. It no longer computes money in the
browser from a 500-row slice.

## 3. Bulk order processing (2.5)

`bulk_set_order_status(uuid[], status, admin, email, courier)` runs each order in
its own subtransaction:

- one invalid order cannot roll back the valid ones;
- the response lists `succeeded` and `failed[{id, reason}]`;
- the UI only offers statuses **every** selected order can actually reach;
- each success is audited individually, and the batch itself is logged.

Nothing bypasses the single-order rules: the batch calls `set_order_status()`,
so payment guards and restock-once logic still apply.

## 4. Inventory traceability (2.6)

Every change to `books.stock_quantity` is captured by an `AFTER UPDATE` trigger
into `stock_movements` (`delta`, `before`, `after`, `reason`, `note`, `order_id`,
`admin`, `correlation_id`). That includes:

- sales (`place_order`, reason `sale`, linked to the order afterwards),
- cancellations (`restock_order`, reason `cancellation`, linked to the order),
- manual adjustments (`adjust_book_stock`, reason + required note + admin).

Because it is a trigger, **future code paths cannot move stock untraceably**.
The stock label (`In Stock` / `Only N left` / `Out of Stock`) is still derived
from `stock_quantity` by the existing trigger, so there is one source of truth.

`CHECK (stock_quantity >= 0)` plus row locks in `place_order` mean concurrent
checkouts cannot drive stock negative.

## 5. Realtime (2.4)

- Storefront: `useLiveBooks()` subscribes to `books` (INSERT/UPDATE/DELETE) on
  the home, catalogue and category pages. Bursts are coalesced, the event
  payload is ignored in favour of a refetch (RLS-safe and consistent), a
  reconnect triggers one refetch, and a 60 s poll covers networks that drop
  websockets silently.
- Dashboard: one channel for `orders` + `books`, debounced, refetching through
  the authenticated API. Admin reads are authorised by the existing RLS policy
  "Admins can read all orders"; a customer's socket only ever receives their own
  rows because RLS filters the changes.
- Realtime never authorises anything. Every mutation still goes through
  `requireAdmin()` and a database function.

## 6. Email notifications (2.7)

`public.email_outbox` is written **in the same transaction** as the order change
(`enqueue_order_email`), with a unique `dedupe_key` of `order_id:template`. A
replayed transition therefore cannot send a second email, and a crashed mail
provider cannot lose the notification.

The `send-email` edge function drains the queue: it claims up to 20 rows, sends
through Resend, records `sent` / `failed` with the provider error, and retries
up to 5 attempts. A missing `RESEND_API_KEY` marks rows `skipped` with an
explicit reason instead of failing silently. The dashboard's **Emails** tab
shows the queue and has a "Retry pending" button.

Email failure never affects an order: the enqueue function swallows its own
errors, and dispatch happens after the response via `after()`.

Templates: `order_confirmed`, `payment_received`, `order_dispatched`,
`order_delivered`, `order_cancelled`, `refund_refund_pending`, `refund_refunded`.

### Required secret

`RESEND_API_KEY` must exist as a Supabase **edge function secret** for delivery.
Without it the queue fills with `skipped` rows and the UI says why.

## Migrations

Applied to `luniopceavtkljywukyi` as five transactions (a single mega-migration
aborted safely on an ordering mistake, hence the split):

1. `phase2a_states_inventory_outbox` — constraints, dispatch columns,
   `stock_movements` + trigger, `email_outbox`.
2. `phase2b_order_functions` — `enqueue_order_email`, `restock_order`,
   `set_order_status`, `set_order_payment_status`, `adjust_book_stock`.
3. `phase2c_metrics_and_bulk` — `bulk_set_order_status`,
   `admin_dashboard_metrics`, mpesa admin-read policy.
4. `phase2d_place_order_attribution` — `place_order` with stock correlation and
   the confirmation email.
5. `phase2e_lock_down_functions` — revokes the default `PUBLIC` execute grant
   that rebuilt functions inherit (a customer could otherwise call
   `set_order_status` over PostgREST with their own JWT).

## Verification performed

- All 6 existing orders unchanged; constraints accept every historical value.
- `adjust_book_stock` → movement row with reason, note, actor (rolled back).
- `place_order` → stock decrement, movement linked to the order, confirmation
  email queued (rolled back).
- Cancel → restock movement linked to the order, cancellation email queued
  (rolled back).
- Bulk with one invalid id → 1 succeeded, 1 failed with `ORDER_NOT_FOUND`.
- Refund chain `paid → refund_pending → refunded` → emails + audit rows.
- Function ACLs: all mutating/aggregate functions are `service_role` only.
- `next build --webpack` succeeds; `npx eslint .` → 0 errors.

## Known gaps

- `orders.payment_status` still defaults to `'paid'`. Every write path sets it
  explicitly, but the default should become `'pending'` in a follow-up.
- The dashboard drains the email queue on open and after mutations; there is no
  scheduler, so a queue only flushes when an admin uses the dashboard or places
  an order. A cron (Vercel or `pg_cron`) would close that window.
