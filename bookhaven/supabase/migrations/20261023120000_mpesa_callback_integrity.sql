-- Book Haven — M-Pesa callback integrity
--
-- STATUS: NEW — created 2026-10-23, NOT APPLIED. Nothing in this file has
-- been executed against the live project. Verify each statement against the
-- target database before running it:
--
--     select indexname from pg_indexes where tablename = 'mpesa_payments';
--     select to_regclass('public.mpesa_callbacks');
--
-- WHY THIS EXISTS
--   1. A payment may only be marked completed by a callback that matches an
--      intent the server wrote before the push, reports the exact amount,
--      carries a receipt, and is confirmed by Daraja's STK query. The code
--      enforces that (app/api/mpesa/callback/route.js +
--      app/lib/mpesa-verify.js); this migration adds the database backstops
--      so a bug in the code cannot become a paid order.
--   2. Nothing preserved callbacks that arrived before (or without) a
--      matching intent, so a genuine payment could be lost with no evidence.
--      public.mpesa_callbacks keeps every callback verbatim.
--   3. A receipt number could be stored twice, so the same M-Pesa
--      transaction could, in principle, settle two payments.
--
-- WHAT IT CHANGES
--   * public.mpesa_callbacks — new table, RLS on, no policies, no grants to
--     anon/authenticated. Written only by the service role.
--   * mpesa_payments — unique index on mpesa_receipt (where not null), and
--     browser write privileges removed: only the server writes payments.
--   * public.place_order() — two changes:
--       a) the payment check demands an exact amount match and a stored
--          receipt, instead of "at least the total" and a fallback to the
--          locally written expected_amount;
--       b) duplicate lines for the same book are merged before stock is
--          checked, and book rows are locked in ascending id order. Before
--          this, ["3 × book 7", "3 × book 7"] against a stock of 5 passed
--          each check separately and then decremented 6, leaving stock at -1;
--          and two concurrent orders sharing books could deadlock.
--
-- ROLLBACK
--   drop table if exists public.mpesa_callbacks;
--   drop index if exists public.mpesa_payments_receipt_key;
--   grant insert, update, delete on public.mpesa_payments to anon, authenticated;
--   -- and re-run place_order() from 20261021110000_delivery_rate.sql
--
-- ORDER OF OPERATIONS
--   Apply this BEFORE deploying the new callback code. The new code works
--   against the old schema (it tolerates a missing mpesa_callbacks table),
--   but the exact-amount rule only becomes a hard guarantee once this has
--   run. Until it has, treat the deployment as protected by application code
--   alone.

begin;

-- ── 1. Every callback, verbatim ────────────────────────────────────────────
create table if not exists public.mpesa_callbacks (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text,
  merchant_request_id text,
  result_code integer,
  result_desc text,
  -- The whole Body.stkCallback object, unmodified: the only evidence of what
  -- Safaricom actually sent, needed to resolve a disputed charge.
  payload jsonb not null,
  matched_payment_id uuid references public.mpesa_payments(id) on delete set null,
  outcome text not null default 'received',
  reason text,
  received_at timestamptz not null default now()
);

comment on table public.mpesa_callbacks is
  'Raw M-Pesa callbacks, matched or not. Written by /api/mpesa/callback with the service role. Never deleted automatically.';

create index if not exists mpesa_callbacks_checkout_idx
  on public.mpesa_callbacks (checkout_request_id);
create index if not exists mpesa_callbacks_unmatched_idx
  on public.mpesa_callbacks (received_at desc)
  where matched_payment_id is null;

alter table public.mpesa_callbacks enable row level security;

-- No policies: RLS plus no grants means neither anon nor a signed-in customer
-- can read, write or even count these rows through PostgREST. The service
-- role bypasses both.
revoke all on table public.mpesa_callbacks from anon, authenticated;
revoke all on table public.mpesa_callbacks from public;

-- ── 2. A receipt settles at most one payment ──────────────────────────────
-- Fails loudly if duplicates already exist. Before applying, check:
--   select mpesa_receipt, count(*) from public.mpesa_payments
--    where mpesa_receipt is not null group by 1 having count(*) > 1;
create unique index if not exists mpesa_payments_receipt_key
  on public.mpesa_payments (mpesa_receipt)
  where mpesa_receipt is not null;

-- ── 3. Payments are written by the server only ────────────────────────────
-- Every write in this repository goes through a route using the service
-- role. There is no policy permitting a browser to write this table, so the
-- grants were only ever a latent hazard: the day someone adds a permissive
-- policy, a customer could settle their own payment.
revoke insert, update, delete, truncate, references, trigger
  on public.mpesa_payments from anon, authenticated;

-- ── 4. place_order(): exact amount, real receipt ──────────────────────────
-- Identical to the live definition (20261021110000_delivery_rate.sql) except
-- for the PAYMENT_NOT_VERIFIED guard, which now also rejects:
--   * an amount that is not exactly the order total (overpayment included);
--   * a completed payment with no MpesaReceiptNumber;
--   * a NULL amount, which previously fell back to expected_amount — a value
--     this application wrote itself, and therefore not evidence of payment.
create or replace function public.place_order(
  p_user_id uuid,
  p_items jsonb,
  p_delivery_details jsonb,
  p_payment_method text,
  p_checkout_request_id text default null,
  p_idempotency_key text default null
)
returns public.orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_existing public.orders;
  v_pay public.mpesa_payments;
  v_item jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_book_id bigint;
  v_qty integer;
  v_available integer;
  v_title text;
  v_author text;
  v_price integer;
  v_subtotal integer := 0;
  v_delivery integer;
  v_total integer;
  v_status text;
  v_ref text := null;
  v_correlation uuid := gen_random_uuid();
  -- requested quantity per book, after merging duplicate cart lines
  v_wanted jsonb := '{}'::jsonb;
  v_key text;
begin
  if p_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  if p_delivery_details is null or jsonb_typeof(p_delivery_details) <> 'object'
     or coalesce(nullif(btrim(p_delivery_details->>'firstName'), ''), '') = ''
     or coalesce(nullif(btrim(p_delivery_details->>'lastName'), ''), '') = ''
     or coalesce(nullif(btrim(p_delivery_details->>'phone'), ''), '') = ''
     or coalesce(nullif(btrim(p_delivery_details->>'address'), ''), '') = ''
     or coalesce(nullif(btrim(p_delivery_details->>'city'), ''), '') = '' then
    raise exception 'INVALID_DELIVERY_DETAILS';
  end if;

  -- Idempotent replay: the same user posting the same checkout twice gets the
  -- original order back instead of a duplicate order and a second stock hit.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.orders
     where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- Pass 1a: validate every line and merge duplicate lines for the same book.
  --
  -- Two lines of "3 × book 7" against a stock of 5 used to pass: each line was
  -- checked separately against the same stock value, and the second pass then
  -- decremented 6, leaving stock at -1. Aggregating first means stock is
  -- always compared with the total this order actually needs.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_book_id := (v_item->>'id')::bigint;
      v_qty := coalesce((v_item->>'quantity')::integer, 1);
    exception when others then
      -- A non-numeric id or quantity is a bad request, not a server error.
      raise exception 'INVALID_ITEMS';
    end;

    if v_book_id is null or v_book_id < 1 or v_qty < 1 or v_qty > 50 then
      raise exception 'INVALID_QUANTITY:%', coalesce(v_item->>'id', '?');
    end if;

    v_wanted := jsonb_set(
      v_wanted,
      array[v_book_id::text],
      to_jsonb(coalesce((v_wanted->>v_book_id::text)::integer, 0) + v_qty),
      true
    );
  end loop;

  -- Pass 1b: lock each book row, validate stock, price from the database,
  -- and rebuild trusted item lines (client prices are never trusted).
  --
  -- Locked in ascending id order so two concurrent orders that share books
  -- acquire the same locks in the same order and cannot deadlock.
  for v_key, v_qty in
    select key, value::integer from jsonb_each_text(v_wanted) order by key::bigint
  loop
    v_book_id := v_key::bigint;

    select stock_quantity, title, author, price
      into v_available, v_title, v_author, v_price
      from public.books
     where id = v_book_id and coalesce(is_archived, false) = false
       for update;

    if v_available is null then
      raise exception 'BOOK_NOT_FOUND:%', v_book_id;
    end if;

    if v_available < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', jsonb_build_object(
        'id', v_book_id, 'title', v_title,
        'available', v_available, 'requested', v_qty
      )::text;
    end if;

    v_subtotal := v_subtotal + v_price * v_qty;
    v_clean := v_clean || jsonb_build_array(
      jsonb_build_object(
        'id', v_book_id, 'quantity', v_qty, 'price', v_price,
        'title', v_title, 'author', v_author
      )
    );
  end loop;

  -- Delivery is 20% of the book total, rounded to the nearest shilling with
  -- integer arithmetic only. This must stay identical to deliveryFeeFor() in
  -- app/lib/site.js: /api/mpesa/stk charges that amount, and this function is
  -- what the payment is checked against before an order is written.
  --   (subtotal * 20 + 50) / 100   -- integer division, so it rounds half up
  v_delivery := (v_subtotal * 20 + 50) / 100;
  v_total := v_subtotal + v_delivery;

  -- Payment status is derived here, never supplied by the caller.
  if p_payment_method ~* 'cod|cash' then
    v_status := 'pending';
  elsif p_payment_method ~* 'mpesa' then
    if p_checkout_request_id is null then
      raise exception 'PAYMENT_NOT_VERIFIED';
    end if;

    select * into v_pay
      from public.mpesa_payments
     where checkout_request_id = p_checkout_request_id
       for update;

    -- "is distinct from" rather than "<": an overpayment is not the amount
    -- this order was priced at, and a NULL amount is not evidence of
    -- anything. Both fail closed.
    if not found
       or v_pay.status <> 'completed'
       or v_pay.user_id is distinct from p_user_id
       or v_pay.order_id is not null
       or v_pay.mpesa_receipt is null
       or v_pay.amount is distinct from v_total then
      raise exception 'PAYMENT_NOT_VERIFIED';
    end if;

    v_status := 'paid';
    v_ref := v_pay.mpesa_receipt;
  else
    v_status := 'pending';
  end if;

  -- Pass 2: decrement stock (rows are already locked). The trigger on books
  -- records each movement; the correlation id ties them to this order below.
  perform set_config('bookhaven.stock_reason', 'sale', true);
  perform set_config('bookhaven.correlation_id', v_correlation::text, true);

  for v_item in select * from jsonb_array_elements(v_clean)
  loop
    update public.books
       set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
     where id = (v_item->>'id')::bigint;
  end loop;

  insert into public.orders (
    user_id, items, subtotal, delivery_fee, cod_fee, total,
    delivery_details, payment_method, payment_status,
    checkout_request_id, payment_ref, status, idempotency_key
  )
  values (
    p_user_id, v_clean, v_subtotal, v_delivery, 0, v_total,
    p_delivery_details, p_payment_method, v_status,
    case when v_status = 'paid' then p_checkout_request_id else null end,
    v_ref, 'Processing', p_idempotency_key
  )
  returning * into v_order;

  -- Attach the movements to the order now that its id exists.
  update public.stock_movements
     set order_id = v_order.id, correlation_id = null
   where correlation_id = v_correlation;

  if v_status = 'paid' then
    update public.mpesa_payments
       set order_id = v_order.id
     where id = v_pay.id;
  end if;

  perform set_config('bookhaven.stock_reason', '', true);
  perform set_config('bookhaven.correlation_id', '', true);

  perform public.enqueue_order_email(v_order.id, 'order_confirmed', 'We received your Book Haven order');

  return v_order;
end;
$function$;

revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from public;
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from anon;
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from authenticated;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text, text) to service_role;

commit;

-- ── Verification, after applying ──────────────────────────────────────────
-- 1. The table exists and is not readable by a browser:
--      select to_regclass('public.mpesa_callbacks');
--      -- with the anon key: select * from mpesa_callbacks;  → must fail
--
-- 2. A receipt cannot be reused:
--      select mpesa_receipt from public.mpesa_payments where mpesa_receipt is not null;
--      -- every value appears once
--
-- 3. A browser cannot write a payment (anon key, signed-in customer):
--      PATCH /rest/v1/mpesa_payments?id=eq.<own>  {"status":"completed"}
--      → 401/403 (permission denied), not a row count
--
-- 4. place_order refuses an overpayment. In the SQL editor:
--      -- with a real completed payment of 113 against an order total of 112
--      select place_order(<user>, '[{"id":<book>,"quantity":1}]'::jsonb,
--             '{"firstName":"A","lastName":"B","phone":"07","address":"C","city":"D"}'::jsonb,
--             'mpesa', '<checkout id>', null);
--      → ERROR: PAYMENT_NOT_VERIFIED
