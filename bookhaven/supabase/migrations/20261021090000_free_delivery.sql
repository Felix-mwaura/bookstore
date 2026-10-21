-- Free delivery, and M-Pesa that can be enabled without a second migration.
--
-- WHY THIS EXISTS
--   The shop no longer charges for delivery: checkout adds nothing to the price
--   of the books and says so on screen, in the basket and on the book page.
--   place_order() is what actually writes the order, so the rule has to change
--   here too or the database would bill KSh 300 the customer was never shown.
--
-- WHAT IT CHANGES
--   • public.place_order(): v_delivery becomes 0 for every order.
--   • Nothing else. No column, no policy, no grant, no trigger, no data.
--     Existing orders keep the delivery fee they were actually charged.
--
-- WHY IT MATTERS FOR M-PESA
--   place_order() refuses an M-Pesa order unless the payment it can see covers
--   the total it computes (`coalesce(amount, expected_amount) < v_total`).
--   /api/mpesa/stk charges subtotal + DELIVERY_FEE. While this shop charged
--   KSh 300 below KSh 3,000, a customer who paid the subtotal would be charged
--   correctly but refused an order. Run this migration before or together with
--   the deployment that removes the fee — not after taking a payment.
--
-- HOW TO APPLY
--   Supabase dashboard → SQL editor → paste this file → run, or
--   `supabase db push` if the project is linked. It is idempotent
--   (create or replace) and safe to run twice.
--
-- ROLLBACK
--   Re-run the place_order() definition from
--   20261020020000_phase2_operations.sql (it restores the KSh 300 rule).

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

  -- Delivery is included in the book price, so the order total is the sum of
  -- the books. This must stay identical to DELIVERY_FEE in app/lib/site.js:
  -- place_order() is what the M-Pesa amount is checked against.
  v_delivery := 0;
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
-- 2. A readable copy of the delivery rule
-- ---------------------------------------------------------------------------
-- The checkout only offers M-Pesa when this function exists and returns the
-- same number as DELIVERY_FEE in app/lib/site.js. Until this migration runs,
-- the function is absent, /api/mpesa/status reports "not ready", and the shop
-- quietly takes cash on delivery instead of charging a customer whose order
-- the database would then refuse. That is the safe direction to fail in.

create or replace function public.delivery_fee_rule()
returns integer
language sql
immutable
as $function$
  select 0;
$function$;

revoke all on function public.delivery_fee_rule() from public;
grant execute on function public.delivery_fee_rule() to service_role;
