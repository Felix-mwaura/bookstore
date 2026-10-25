-- Book Haven — cash-on-delivery abuse limits and auto-cancel
--
-- STATUS: NOT APPLIED. Prepared 2026-10-25 as part of the security audit.
-- The owner applies migrations; this file has never been run against
-- luniopceavtkljywukyi.
--
-- WHY THIS EXISTS
--   1. Cash on delivery reserves stock without any money changing hands. One
--      account could place order after order and hold the catalogue hostage
--      while real buyers see "out of stock". /api/orders now checks the same
--      limits before writing, but two tabs (or a script) can pass that check
--      concurrently — the database has to be the one that cannot be raced.
--   2. A COD order nobody ever confirms should not hold stock forever. Nothing
--      in the app cancels it today; it stays "Processing" and the books stay
--      reserved.
--
-- WHAT IT CHANGES (additive; no data is rewritten)
--   * public.enforce_cod_order_limits() + BEFORE INSERT trigger on
--     public.orders:
--       - total units in one COD order <= 20
--       - at most 3 COD orders in Pending/Processing/Packed with
--         payment_status = 'pending'
--       - a per-customer advisory lock so concurrent inserts cannot both read
--         "2 open" and both succeed
--   * public.cancel_stale_cod_orders(p_hours integer default 48): cancels and
--     restocks unconfirmed COD orders through set_order_status(), so the
--     normal transition rules, the restock and the customer email all happen
--     exactly as they do for a manual cancellation.
--   * A partial index for the open-COD count.
--
-- ORDER OF OPERATIONS
--   1. Apply this migration (nothing breaks if you do: the trigger only
--      rejects orders that already exceed the limits, and the cancel function
--      is not called by anything until step 3).
--   2. Deploy the code that ships with it (/api/orders checks first, for a
--      friendly message; /api/cron/cancel-stale-cod calls the function).
--   3. Set CRON_SECRET in Vercel (an arbitrary long random string). The daily
--      cron in vercel.json then starts cancelling COD orders older than 48 h.
--      Without CRON_SECRET the route answers 503 and does nothing.
--
-- PRE-FLIGHT — run these two queries first
--   -- a) admin_activity_log.admin_id must allow NULL, because the automatic
--   --    cancellation has no human actor. If 'NO', either make it nullable or
--   --    replace the NULL in cancel_stale_cod_orders() with the owner's
--   --    profiles.id and say so in the log.
--   select is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'admin_activity_log'
--      and column_name = 'admin_id';
--
--   -- b) Nobody is currently over the limit (the trigger does not validate
--   --    existing rows, but you should know):
--   select user_id, count(*) from public.orders
--    where payment_method ~* 'cod|cash' and payment_status = 'pending'
--      and status in ('Pending','Processing','Packed')
--    group by user_id having count(*) > 3;
--
-- ROLLBACK
--   drop trigger if exists trg_enforce_cod_order_limits on public.orders;
--   drop function if exists public.enforce_cod_order_limits();
--   drop function if exists public.cancel_stale_cod_orders(integer);
--   drop index if exists public.idx_orders_open_cod;
--   (Nothing else is touched: no column, no row, no policy, no grant to a
--    browser role.)
--
-- VERIFICATION after applying
--   -- 1. The trigger rejects a fourth open COD order. As a test customer with
--   --    three open COD orders:
--   select place_order('<customer uuid>', '[{"id":1,"quantity":1}]'::jsonb,
--          '{"firstName":"A","lastName":"B","phone":"07","address":"C","city":"D"}'::jsonb,
--          'cod', null, null);
--   -- → ERROR: TOO_MANY_OPEN_COD_ORDERS:3
--
--   -- 2. A 21-unit COD order is refused, an M-Pesa order is unaffected:
--   select place_order('<customer uuid>', '[{"id":1,"quantity":21}]'::jsonb,
--          '{"firstName":"A","lastName":"B","phone":"07","address":"C","city":"D"}'::jsonb,
--          'cod', null, null);
--   -- → ERROR: COD_ORDER_TOO_LARGE:21
--
--   -- 3. The cancel sweep only touches stale, unconfirmed COD orders:
--   select * from public.cancel_stale_cod_orders(48);
--   -- → zero rows on a healthy shop; each returned id is now Cancelled,
--   --    restocked once, logged, and has an order_cancelled email queued.

begin;

-- ── 1. Limits, enforced where concurrency cannot win ──────────────────────
create or replace function public.enforce_cod_order_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_units integer := 0;
  v_open  integer := 0;
begin
  -- Only unpaid cash-on-delivery rows are capped. M-Pesa orders have already
  -- been paid for, so holding stock for them is a sale, not a hold.
  if coalesce(new.payment_method, '') !~* 'cod|cash' then
    return new;
  end if;
  if coalesce(new.payment_status, 'pending') <> 'pending' then
    return new;
  end if;

  -- Serialise this customer's concurrent inserts. The lock is held until the
  -- transaction ends, so the count below cannot miss a row another request is
  -- inserting at the same moment. Different customers never block each other.
  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(new.user_id::text, 'anonymous'), 0)
  );

  -- A quantity that is not a whole number is counted as zero rather than
  -- raising a cast error: place_order() is what rejects it, and this trigger
  -- must never turn a malformed row into an obscure 500.
  select coalesce(sum(
           case
             when (item->>'quantity') ~ '^[0-9]+$'
               then greatest((item->>'quantity')::integer, 0)
             else 0
           end
         ), 0)
    into v_units
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) as item;

  if v_units > 20 then
    raise exception 'COD_ORDER_TOO_LARGE:%', v_units using errcode = 'P0001';
  end if;

  select count(*)
    into v_open
    from public.orders
   where user_id = new.user_id
     and coalesce(payment_method, '') ~* 'cod|cash'
     and coalesce(payment_status, 'pending') = 'pending'
     and status in ('Pending', 'Processing', 'Packed');

  if v_open >= 3 then
    raise exception 'TOO_MANY_OPEN_COD_ORDERS:%', v_open using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

comment on function public.enforce_cod_order_limits() is
  'BEFORE INSERT guard on orders: max 20 units and max 3 open COD orders per customer. Pairs with codLimitProblem() in app/lib/order-limits.js.';

drop trigger if exists trg_enforce_cod_order_limits on public.orders;
create trigger trg_enforce_cod_order_limits
  before insert on public.orders
  for each row execute function public.enforce_cod_order_limits();

-- Trigger functions cannot be called directly, but there is no reason to
-- leave a default EXECUTE grant on it either.
revoke all on function public.enforce_cod_order_limits() from public, anon, authenticated;

-- The count above runs on every COD insert; this keeps it an index scan as
-- the order table grows.
create index if not exists idx_orders_open_cod
  on public.orders (user_id, created_at)
  where coalesce(payment_status, 'pending') = 'pending'
    and status in ('Pending', 'Processing', 'Packed');

-- ── 2. Auto-cancel unconfirmed COD ────────────────────────────────────────
create or replace function public.cancel_stale_cod_orders(p_hours integer default 48)
returns table (cancelled_order_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_hours integer := greatest(coalesce(p_hours, 48), 1);
  r record;
begin
  for r in
    select id
      from public.orders
     where coalesce(payment_method, '') ~* 'cod|cash'
       and coalesce(payment_status, 'pending') = 'pending'
       and status in ('Pending', 'Processing')
       and created_at < now() - make_interval(hours => v_hours)
     order by created_at
     limit 200
  loop
    begin
      -- The canonical path: locks the row, enforces the transition, restocks
      -- exactly once, writes admin_activity_log and queues the email.
      perform public.set_order_status(
        r.id, 'Cancelled', null, 'system:cod-auto-cancel', null, null
      );
      cancelled_order_id := r.id;
      return next;
    exception when others then
      -- One bad row must not abort the sweep. The warning is visible in the
      -- Postgres logs; the order stays where it was for a human to look at.
      raise warning 'cancel_stale_cod_orders: could not cancel % (%): %',
        r.id, sqlstate, sqlerrm;
    end;
  end loop;
end;
$function$;

comment on function public.cancel_stale_cod_orders(integer) is
  'Cancels COD orders still Pending/Processing after p_hours (default 48), restocking through set_order_status(). Called by /api/cron/cancel-stale-cod with the service role.';

revoke all on function public.cancel_stale_cod_orders(integer) from public, anon, authenticated;
grant execute on function public.cancel_stale_cod_orders(integer) to service_role;

commit;

-- ── Optional: run it in the database instead of on Vercel ─────────────────
-- If you would rather not add a Vercel cron, Supabase supports pg_cron:
--
--   select cron.schedule(
--     'cancel-stale-cod', '0 6 * * *',
--     $$select public.cancel_stale_cod_orders(48)$$
--   );
--
-- Do ONE of the two, not both: two schedules would race, and the second would
-- simply find nothing left to cancel (harmless, but noisy in the logs).
