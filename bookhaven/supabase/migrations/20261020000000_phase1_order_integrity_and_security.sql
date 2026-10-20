-- Phase 1: money integrity, idempotency, atomic order transitions.
-- Applied to project luniopceavtkljywukyi on 2026-10-20.
-- Additive except for the two function replacements and the orders UPDATE
-- policy removal described at the bottom.

begin;

-- 1. Explicit money breakdown on orders -------------------------------------
alter table public.orders add column if not exists subtotal integer;
alter table public.orders add column if not exists delivery_fee integer not null default 0;
alter table public.orders add column if not exists cod_fee integer not null default 0;
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists updated_at timestamp without time zone not null default now();

update public.orders set subtotal = total where subtotal is null;
alter table public.orders alter column subtotal set default 0;
alter table public.orders alter column subtotal set not null;

create unique index if not exists idx_orders_user_idempotency
  on public.orders (user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_orders_checkout_request
  on public.orders (checkout_request_id);

-- 2. One default address per user -------------------------------------------
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id) rn
    from public.addresses where is_default
)
update public.addresses a set is_default = false
  from ranked r where a.id = r.id and r.rn > 1;

create unique index if not exists idx_addresses_one_default
  on public.addresses (user_id) where is_default;

-- 3. Catalogue integrity -----------------------------------------------------
alter table public.books drop constraint if exists books_price_check;
alter table public.books add constraint books_price_check check (price >= 0);
alter table public.books drop constraint if exists books_low_stock_threshold_check;
alter table public.books add constraint books_low_stock_threshold_check
  check (low_stock_threshold is null or low_stock_threshold >= 1);

-- 4. Realtime: send full rows on UPDATE --------------------------------------
alter table public.books replica identity full;
alter table public.orders replica identity full;

-- 5. Remove a broken legacy function (text arithmetic on books.stock) -------
drop function if exists public.decrement_book_stock(bigint, integer);

-- 6. place_order: server-computed money, idempotency, verified payment -------
drop function if exists public.place_order(uuid, jsonb, integer, jsonb, text, text, text);

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

  -- Pass 2: decrement stock (rows are already locked).
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

  if v_status = 'paid' then
    update public.mpesa_payments
       set order_id = v_order.id
     where id = v_pay.id;
  end if;

  return v_order;
end;
$function$;

revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from public;
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from anon;
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text, text) from authenticated;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text, text) to service_role;

-- 7. set_order_status: one atomic, validated status transition --------------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid,
  p_admin_email text
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
  if p_new_status not in ('Processing', 'Shipped', 'Delivered', 'Cancelled') then
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

  if not (
       (v_from = 'Processing' and p_new_status in ('Shipped', 'Cancelled'))
    or (v_from = 'Shipped'    and p_new_status in ('Delivered', 'Cancelled'))
  ) then
    raise exception 'INVALID_TRANSITION:%:%', coalesce(v_from, 'unknown'), p_new_status;
  end if;

  update public.orders
     set status = p_new_status,
         updated_at = now()
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
    jsonb_build_object('from', v_from, 'to', p_new_status, 'restocked', p_new_status = 'Cancelled')
  );

  return v_order;
end;
$function$;

revoke all on function public.set_order_status(uuid, text, uuid, text) from public;
revoke all on function public.set_order_status(uuid, text, uuid, text) from anon;
revoke all on function public.set_order_status(uuid, text, uuid, text) from authenticated;
grant execute on function public.set_order_status(uuid, text, uuid, text) to service_role;

-- 8. Order writes must go through set_order_status() (validated + restocking).
--    The admin API uses the service role, which bypasses RLS. Browsers keep
--    SELECT-only access to orders.
drop policy if exists "Admins can update all orders" on public.orders;

commit;
