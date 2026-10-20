-- Phase 2 — operations, inventory traceability, metrics and notifications.
--
-- Design notes (read before changing):
--
--  * Fulfilment and payment are separate state machines on purpose. An order
--    can be packed but unpaid (COD), or paid but cancelled (refund). Nothing
--    in this migration derives one from the other.
--  * Every change to books.stock_quantity is captured by an AFTER trigger, so
--    no code path — including future ones — can move stock without leaving a
--    row in stock_movements. Callers set bookhaven.stock_reason /
--    .stock_note / .actor_id / .order_id via set_config() for attribution.
--  * Revenue counts a row only when payment_status = 'paid' AND the order is
--    not Cancelled. Refunds drop out because payment_status becomes
--    'refunded'. Cancelled orders are never counted as sales.
--  * Emails are queued in the same transaction as the order change (so a
--    notification can never be lost), then delivered out-of-band by the
--    send-email edge function. Failures are recorded, never raised: a broken
--    mail provider must not roll back an order.

begin;

-- ---------------------------------------------------------------------------
-- 1. State vocabularies
-- ---------------------------------------------------------------------------
-- Widening only: every existing value stays valid, so the 6 live orders need
-- no data migration. 'Shipped' remains the dispatch state (the UI labels it
-- "Dispatched") so historical rows keep their meaning.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array['Pending', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled']));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status = any (array['pending', 'paid', 'failed', 'refund_pending', 'refunded']));

-- Fulfilment metadata (2.2 order details, 2.5 dispatch batches).
alter table public.orders
  add column if not exists courier text,
  add column if not exists tracking_ref text,
  add column if not exists dispatched_at timestamp without time zone,
  add column if not exists delivered_at timestamp without time zone,
  add column if not exists cancelled_at timestamp without time zone;

-- ---------------------------------------------------------------------------
-- 2. Stock movement history
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete restrict,
  delta integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  reason text not null,
  note text,
  order_id uuid references public.orders(id) on delete set null,
  admin_id uuid,
  admin_email text,
  correlation_id uuid,
  created_at timestamp without time zone not null default now(),
  constraint stock_movements_math check (quantity_after = quantity_before + delta)
);

create index if not exists idx_stock_movements_book
  on public.stock_movements (book_id, created_at desc);
create index if not exists idx_stock_movements_created
  on public.stock_movements (created_at desc);
create index if not exists idx_stock_movements_correlation
  on public.stock_movements (correlation_id) where correlation_id is not null;

alter table public.stock_movements enable row level security;

drop policy if exists "Admins can read stock movements" on public.stock_movements;
create policy "Admins can read stock movements"
  on public.stock_movements for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.stock_movements from anon, authenticated;

-- The trigger. Reads attribution from transaction-local settings so that
-- SECURITY DEFINER functions (place_order, restock_order, adjust_book_stock)
-- can label the change without the caller passing anything.
create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reason text := coalesce(nullif(current_setting('bookhaven.stock_reason', true), ''), 'unspecified');
  v_note   text := nullif(current_setting('bookhaven.stock_note', true), '');
  v_actor  uuid := nullif(current_setting('bookhaven.actor_id', true), '')::uuid;
  v_email  text := nullif(current_setting('bookhaven.actor_email', true), '');
  v_order  uuid := nullif(current_setting('bookhaven.order_id', true), '')::uuid;
  v_corr   uuid := nullif(current_setting('bookhaven.correlation_id', true), '')::uuid;
begin
  if new.stock_quantity is distinct from old.stock_quantity then
    insert into public.stock_movements (
      book_id, delta, quantity_before, quantity_after,
      reason, note, order_id, admin_id, admin_email, correlation_id
    )
    values (
      new.id, new.stock_quantity - old.stock_quantity, old.stock_quantity, new.stock_quantity,
      v_reason, v_note, v_order, v_actor, v_email, v_corr
    );
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_log_stock_movement on public.books;
create trigger trg_log_stock_movement
  after update of stock_quantity on public.books
  for each row execute function public.log_stock_movement();

-- ---------------------------------------------------------------------------
-- 3. Email outbox
-- ---------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  to_email text not null default '',
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamp without time zone not null default now(),
  sent_at timestamp without time zone
);

create index if not exists idx_email_outbox_pending
  on public.email_outbox (created_at) where status in ('queued', 'failed');

alter table public.email_outbox enable row level security;

drop policy if exists "Admins can read email outbox" on public.email_outbox;
create policy "Admins can read email outbox"
  on public.email_outbox for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.email_outbox from anon, authenticated;

-- Queue one notification per (order, event). ON CONFLICT DO NOTHING makes a
-- replayed transition a no-op instead of a duplicate email.
create or replace function public.enqueue_order_email(
  p_order_id uuid,
  p_template text,
  p_subject text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_email text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  select p.email into v_email from public.profiles p where p.id = v_order.user_id;

  insert into public.email_outbox (
    dedupe_key, to_email, template, subject, payload, order_id, status, last_error
  )
  values (
    p_order_id::text || ':' || p_template,
    coalesce(v_email, ''),
    p_template,
    p_subject,
    jsonb_build_object(
      'order_id', v_order.id,
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'payment_method', v_order.payment_method,
      'total', v_order.total,
      'items', v_order.items,
      'delivery', v_order.delivery_details,
      'courier', v_order.courier,
      'tracking_ref', v_order.tracking_ref
    ),
    p_order_id,
    case when coalesce(v_email, '') = '' then 'skipped' else 'queued' end,
    case when coalesce(v_email, '') = '' then 'No email address on file for this customer' end
  )
  on conflict (dedupe_key) do nothing;
exception
  -- Notifications must never break the order transaction.
  when others then
    raise warning 'enqueue_order_email(%): %', p_order_id, sqlerrm;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. place_order — same contract, plus stock attribution and a receipt email
-- ---------------------------------------------------------------------------
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

  -- Pass 1: lock each book row, validate stock, price from the database,
  -- and rebuild trusted item lines (client prices are never trusted).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_book_id := (v_item->>'id')::bigint;
    exception when others then
      raise exception 'INVALID_ITEMS';
    end;

    v_qty := coalesce((v_item->>'quantity')::integer, 1);

    if v_book_id is null or v_qty < 1 or v_qty > 50 then
      raise exception 'INVALID_QUANTITY:%', coalesce(v_item->>'id', '?');
    end if;

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
      v_item || jsonb_build_object(
        'id', v_book_id, 'quantity', v_qty, 'price', v_price,
        'title', v_title, 'author', v_author
      )
    );
  end loop;

  v_delivery := case when v_subtotal >= 3000 then 0 else 300 end;
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

    if not found
       or v_pay.status <> 'completed'
       or v_pay.user_id is distinct from p_user_id
       or v_pay.order_id is not null
       or coalesce(v_pay.amount, v_pay.expected_amount, 0) < v_total then
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

-- ---------------------------------------------------------------------------
-- 5. restock_order — now attributed to the order it restores
-- ---------------------------------------------------------------------------
create or replace function public.restock_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_items jsonb;
  v_item jsonb;
begin
  select items into v_items from public.orders where id = p_order_id;
  if v_items is null then return; end if;

  perform set_config('bookhaven.stock_reason', 'cancellation', true);
  perform set_config('bookhaven.order_id', p_order_id::text, true);

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    update public.books
       set stock_quantity = stock_quantity + coalesce((v_item->>'quantity')::integer, 1)
     where id = (v_item->>'id')::bigint;
  end loop;

  perform set_config('bookhaven.stock_reason', '', true);
  perform set_config('bookhaven.order_id', '', true);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. set_order_status — wider state machine, payment guard, dispatch data
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid,
  p_admin_email text,
  p_courier text default null,
  p_tracking_ref text default null
)
returns public.orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_from text;
  v_template text;
  v_subject text;
begin
  if p_new_status not in ('Pending', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled') then
    raise exception 'INVALID_STATUS:%', p_new_status;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_from := v_order.status;
  if v_from = p_new_status then
    return v_order;
  end if;

  -- Forward-only. Delivered and Cancelled are terminal.
  if not (
       (v_from = 'Pending'    and p_new_status in ('Processing', 'Cancelled'))
    or (v_from = 'Processing' and p_new_status in ('Packed', 'Shipped', 'Cancelled'))
    or (v_from = 'Packed'     and p_new_status in ('Shipped', 'Cancelled'))
    or (v_from = 'Shipped'    and p_new_status in ('Delivered', 'Cancelled'))
  ) then
    raise exception 'INVALID_TRANSITION:%:%', coalesce(v_from, 'unknown'), p_new_status;
  end if;

  -- A failed payment must never be treated as a successful sale. Cash on
  -- delivery is exempt: the money is collected at the door, so its payment
  -- stays 'pending' until the courier is paid.
  if p_new_status in ('Shipped', 'Delivered')
     and coalesce(v_order.payment_method, '') !~* 'cod|cash'
     and v_order.payment_status <> 'paid' then
    raise exception 'PAYMENT_NOT_CLEARED:%', v_order.payment_status;
  end if;

  if v_order.payment_status = 'failed' and p_new_status in ('Shipped', 'Delivered') then
    raise exception 'PAYMENT_FAILED';
  end if;

  update public.orders
     set status = p_new_status,
         updated_at = now(),
         courier = coalesce(p_courier, courier),
         tracking_ref = coalesce(p_tracking_ref, tracking_ref),
         dispatched_at = case when p_new_status = 'Shipped' then now() else dispatched_at end,
         delivered_at  = case when p_new_status = 'Delivered' then now() else delivered_at end,
         cancelled_at  = case when p_new_status = 'Cancelled' then now() else cancelled_at end
   where id = p_order_id
   returning * into v_order;

  -- Cancelled is terminal, so stock can only be restored once.
  if p_new_status = 'Cancelled' then
    perform public.restock_order(p_order_id);
  end if;

  insert into public.admin_activity_log (
    admin_id, admin_email, action, target_type, target_id, details
  )
  values (
    p_admin_id, p_admin_email, 'order_status_updated', 'order', p_order_id::text,
    jsonb_build_object(
      'from', v_from, 'to', p_new_status,
      'restocked', p_new_status = 'Cancelled',
      'courier', v_order.courier,
      'tracking_ref', v_order.tracking_ref
    )
  );

  v_template := case p_new_status
    when 'Shipped' then 'order_dispatched'
    when 'Delivered' then 'order_delivered'
    when 'Cancelled' then 'order_cancelled'
  end;
  v_subject := case p_new_status
    when 'Shipped' then 'Your Book Haven order is on its way'
    when 'Delivered' then 'Your Book Haven order was delivered'
    when 'Cancelled' then 'Your Book Haven order was cancelled'
  end;

  if v_template is not null then
    perform public.enqueue_order_email(p_order_id, v_template, v_subject);
  end if;

  return v_order;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. set_order_payment_status — the other state machine
-- ---------------------------------------------------------------------------
create or replace function public.set_order_payment_status(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid,
  p_admin_email text,
  p_payment_ref text default null
)
returns public.orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_from text;
begin
  if p_new_status not in ('pending', 'paid', 'failed', 'refund_pending', 'refunded') then
    raise exception 'INVALID_STATUS:%', p_new_status;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_from := v_order.payment_status;
  if v_from = p_new_status then
    return v_order;
  end if;

  if not (
       (v_from = 'pending'        and p_new_status in ('paid', 'failed'))
    or (v_from = 'failed'         and p_new_status in ('pending', 'paid'))
    or (v_from = 'paid'           and p_new_status in ('refund_pending', 'refunded'))
    or (v_from = 'refund_pending' and p_new_status in ('refunded', 'paid'))
  ) then
    raise exception 'INVALID_PAYMENT_TRANSITION:%:%', coalesce(v_from, 'unknown'), p_new_status;
  end if;

  -- Money cannot be recorded as received for an order that was cancelled
  -- before it was ever paid; refunds are the correct path once paid.
  if p_new_status = 'paid' and v_order.status = 'Cancelled' then
    raise exception 'ORDER_CANCELLED';
  end if;

  update public.orders
     set payment_status = p_new_status,
         payment_ref = coalesce(p_payment_ref, payment_ref),
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  insert into public.admin_activity_log (
    admin_id, admin_email, action, target_type, target_id, details
  )
  values (
    p_admin_id, p_admin_email, 'order_payment_updated', 'order', p_order_id::text,
    jsonb_build_object('from', v_from, 'to', p_new_status, 'payment_ref', v_order.payment_ref)
  );

  if p_new_status = 'paid' then
    perform public.enqueue_order_email(p_order_id, 'payment_received', 'Payment received for your Book Haven order');
  elsif p_new_status in ('refund_pending', 'refunded') then
    perform public.enqueue_order_email(
      p_order_id,
      'refund_' || p_new_status,
      case when p_new_status = 'refunded' then 'Your Book Haven refund was processed'
           else 'Your Book Haven refund is being processed' end
    );
  end if;

  return v_order;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. bulk_set_order_status — per-order validation, partial success is data
-- ---------------------------------------------------------------------------
create or replace function public.bulk_set_order_status(
  p_order_ids uuid[],
  p_new_status text,
  p_admin_id uuid,
  p_admin_email text,
  p_courier text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_ok uuid[] := '{}';
  v_failed jsonb := '[]'::jsonb;
  v_requested integer;
begin
  if p_order_ids is null or array_length(p_order_ids, 1) is null then
    raise exception 'NO_ORDERS_SELECTED';
  end if;

  select count(distinct x) into v_requested from unnest(p_order_ids) x;

  if v_requested > 100 then
    raise exception 'TOO_MANY_ORDERS:%', v_requested;
  end if;

  for v_id in select distinct unnest(p_order_ids) loop
    -- Each iteration is its own subtransaction: one invalid order cannot
    -- undo the orders that were valid, and cannot hide the reason either.
    begin
      perform public.set_order_status(v_id, p_new_status, p_admin_id, p_admin_email, p_courier, null);
      v_ok := v_ok || v_id;
    exception when others then
      v_failed := v_failed || jsonb_build_object('id', v_id, 'reason', sqlerrm);
    end;
  end loop;

  insert into public.admin_activity_log (
    admin_id, admin_email, action, target_type, target_id, details
  )
  values (
    p_admin_id, p_admin_email, 'orders_bulk_status_updated', 'order_batch', null,
    jsonb_build_object(
      'to', p_new_status,
      'requested', v_requested,
      'succeeded', coalesce(array_length(v_ok, 1), 0),
      'failed', jsonb_array_length(v_failed)
    )
  );

  return jsonb_build_object(
    'requested', v_requested,
    'succeeded', coalesce(to_jsonb(v_ok), '[]'::jsonb),
    'failed', v_failed
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 9. adjust_book_stock — manual inventory changes, always explained
-- ---------------------------------------------------------------------------
create or replace function public.adjust_book_stock(
  p_book_id bigint,
  p_new_quantity integer,
  p_reason text,
  p_note text,
  p_admin_id uuid,
  p_admin_email text
)
returns public.books
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_book public.books;
  v_before integer;
  v_delta integer;
begin
  if p_reason not in ('restock', 'correction', 'damage', 'return', 'manual_adjustment') then
    raise exception 'INVALID_REASON:%', p_reason;
  end if;

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED';
  end if;

  select * into v_book from public.books where id = p_book_id for update;
  if not found then
    raise exception 'BOOK_NOT_FOUND';
  end if;

  v_before := v_book.stock_quantity;
  v_delta := p_new_quantity - v_before;
  if v_delta = 0 then
    return v_book;
  end if;

  perform set_config('bookhaven.stock_reason', p_reason, true);
  perform set_config('bookhaven.stock_note', p_note, true);
  perform set_config('bookhaven.actor_id', coalesce(p_admin_id::text, ''), true);
  perform set_config('bookhaven.actor_email', coalesce(p_admin_email, ''), true);

  update public.books
     set stock_quantity = p_new_quantity
   where id = p_book_id
   returning * into v_book;

  perform set_config('bookhaven.stock_reason', '', true);
  perform set_config('bookhaven.stock_note', '', true);
  perform set_config('bookhaven.actor_id', '', true);
  perform set_config('bookhaven.actor_email', '', true);

  insert into public.admin_activity_log (
    admin_id, admin_email, action, target_type, target_id, details
  )
  values (
    p_admin_id, p_admin_email, 'stock_adjusted', 'book', p_book_id::text,
    jsonb_build_object(
      'from', v_before, 'to', p_new_quantity, 'delta', v_delta,
      'reason', p_reason, 'note', p_note
    )
  );

  return v_book;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Dashboard metrics
-- ---------------------------------------------------------------------------
-- Definitions, so the numbers on screen can be defended:
--   total_orders        every order created in range, any status
--   awaiting_processing status Pending/Processing
--   awaiting_dispatch   status Pending/Processing/Packed and not failed payment
--   delivered           status Delivered
--   cancelled           status Cancelled
--   net_revenue         SUM(total) where payment_status = 'paid' and not Cancelled
--   gross_order_value   SUM(total) of every non-cancelled order, paid or not
--   pending_value       SUM(total) where payment_status = 'pending' and not Cancelled
--   refunded_value      SUM(total) where payment_status in ('refund_pending','refunded')
--   best_sellers        units in Delivered orders only (money actually earned)
create or replace function public.admin_dashboard_metrics(
  p_from timestamp,
  p_to timestamp
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'INVALID_RANGE';
  end if;

  with scope as (
    select * from public.orders
     where created_at >= p_from and created_at < p_to
  ),
  counts as (
    select
      count(*) as total_orders,
      count(*) filter (where status in ('Pending', 'Processing')) as awaiting_processing,
      count(*) filter (where status in ('Pending', 'Processing', 'Packed')
                         and payment_status is distinct from 'failed') as awaiting_dispatch,
      count(*) filter (where status = 'Shipped') as shipped,
      count(*) filter (where status = 'Delivered') as delivered,
      count(*) filter (where status = 'Cancelled') as cancelled,
      count(*) filter (where payment_status = 'paid') as paid_orders
    from scope
  ),
  money as (
    select
      coalesce(sum(total) filter (
        where payment_status = 'paid' and status <> 'Cancelled'), 0) as net_revenue,
      coalesce(sum(total) filter (where status <> 'Cancelled'), 0) as gross_order_value,
      coalesce(sum(total) filter (
        where payment_status = 'pending' and status <> 'Cancelled'), 0) as pending_value,
      coalesce(sum(total) filter (
        where payment_status in ('refund_pending', 'refunded')), 0) as refunded_value
    from scope
  ),
  inventory as (
    select
      count(*) as titles,
      count(*) filter (where stock_quantity > 0
                         and stock_quantity <= coalesce(low_stock_threshold, 5)) as low_stock,
      count(*) filter (where stock_quantity <= 0) as out_of_stock
    from public.books
    where coalesce(is_archived, false) = false
  ),
  best as (
    select
      (item->>'id')::bigint as book_id,
      max(item->>'title') as title,
      sum(coalesce((item->>'quantity')::integer, 1)) as units,
      sum(coalesce((item->>'quantity')::integer, 1) * coalesce((item->>'price')::integer, 0)) as revenue
    from scope,
         lateral jsonb_array_elements(
           case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
         ) item
    where status = 'Delivered'
      and jsonb_typeof(item) = 'object'
      and item ? 'id' and item ? 'quantity'
    group by 1
    order by units desc, revenue desc
    limit 5
  ),
  daily as (
    select
      date_trunc('day', created_at) as day,
      count(*) as orders,
      coalesce(sum(total) filter (
        where payment_status = 'paid' and status <> 'Cancelled'), 0) as revenue
    from scope
    group by 1
    order by 1
  ),
  recent as (
    select id, status, payment_status, payment_method, total, created_at,
           delivery_details->>'firstName' as first_name,
           delivery_details->>'lastName' as last_name,
           case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) else 0 end as item_lines
    from scope
    order by created_at desc
    limit 8
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'counts', (select to_jsonb(c) from counts c),
    'money', (select to_jsonb(m) from money m),
    'inventory', (select to_jsonb(i) from inventory i),
    'best_sellers', coalesce((select jsonb_agg(to_jsonb(b)) from best b), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'), 'orders', d.orders, 'revenue', d.revenue
      ) order by d.day) from daily d), '[]'::jsonb),
    'recent_orders', coalesce((select jsonb_agg(to_jsonb(r)) from recent r), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 11. Privileges
-- ---------------------------------------------------------------------------
-- These functions are called by server code holding the service key, never by
-- the browser. RLS continues to govern anything read with a user JWT.
revoke all on function public.admin_dashboard_metrics(timestamp, timestamp) from public, anon, authenticated;
revoke all on function public.bulk_set_order_status(uuid[], text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.adjust_book_stock(bigint, integer, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.set_order_payment_status(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_order_email(uuid, text, text) from public, anon, authenticated;

grant execute on function public.admin_dashboard_metrics(timestamp, timestamp) to service_role;
grant execute on function public.bulk_set_order_status(uuid[], text, uuid, text, text) to service_role;
grant execute on function public.adjust_book_stock(bigint, integer, text, text, uuid, text) to service_role;
grant execute on function public.set_order_payment_status(uuid, text, uuid, text, text) to service_role;
grant execute on function public.enqueue_order_email(uuid, text, text) to service_role;

-- set_order_status gained two optional parameters, so the old 4-argument
-- signature must go or PostgREST would have two overloads to choose from.
revoke all on function public.set_order_status(uuid, text, uuid, text) from public, anon, authenticated;
drop function if exists public.set_order_status(uuid, text, uuid, text);

-- A rebuilt function inherits Postgres's default EXECUTE grant to PUBLIC.
-- set_order_status trusts p_admin_id and does no internal role check, so
-- leaving that grant in place would let any signed-in customer call it over
-- PostgREST and ship or cancel an arbitrary order.
revoke all on function public.set_order_status(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid, text, text, text) to service_role;

revoke all on function public.log_stock_movement() from public, anon, authenticated;

revoke all on function public.restock_order(uuid) from public, anon, authenticated;
grant execute on function public.restock_order(uuid) to service_role;

-- Close the outstanding RLS gap: admins may read payment rows for the orders
-- they are already allowed to see. Customers still see only their own.
drop policy if exists "Admins can read mpesa payments" on public.mpesa_payments;
create policy "Admins can read mpesa payments"
  on public.mpesa_payments for select to authenticated
  using (public.is_admin());

commit;
