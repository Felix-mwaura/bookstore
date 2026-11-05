-- Schema defaults, nullability, the missing wishlist foreign key, and the
-- five foreign keys that had no index.
--
-- STATUS: APPLIED 2026-10-27 to luniopceavtkljywukyi as version 20261027173645
-- (through the Supabase MCP; this file is the record). Verified after apply:
-- payment_status default 'pending'; addresses/wishlists user_id NOT NULL;
-- wishlists_book_id_fkey present; five new indexes; delivery_rate() pinned to
-- search_path=public, still returning 20, executable only by service_role.
--
-- Checked before writing (read-only):
--   addresses : 1 row, 0 with a null user_id
--   wishlists : 0 rows, 0 book_id values missing from books
--   orders    : 2 rows, 0 with a null user_id — left nullable on purpose,
--               see the note at the bottom
--   orders.payment_status default was 'paid', the wrong default for an order
--               that has not been paid yet

-- A new order is unpaid until something says otherwise. place_order() still
-- writes the value explicitly ('paid' for a cleared M-Pesa payment, 'pending'
-- for cash on delivery); this only fixes the value a direct insert inherits.
alter table public.orders
  alter column payment_status set default 'pending';

-- Both tables are keyed by user; a row without one is unreachable and can
-- never match an RLS policy (auth.uid() = user_id is never true for NULL).
alter table public.addresses alter column user_id set not null;
alter table public.wishlists  alter column user_id set not null;

-- wishlists.book_id had no foreign key, so a deleted book left a wish that
-- points nowhere (the app then hides it, silently). Cascade matches
-- book_reviews, which already does this.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'wishlists_book_id_fkey'
       and conrelid = 'public.wishlists'::regclass
  ) then
    alter table public.wishlists
      add constraint wishlists_book_id_fkey
      foreign key (book_id) references public.books(id) on delete cascade;
  end if;
end $$;

-- delivery_rate() returns the constant 20 and was already IMMUTABLE, but it
-- had no pinned search_path. Recreated with search_path = public and then
-- closed to anon/authenticated: both call sites (app/api/orders/route.js and
-- app/lib/mpesa-availability.js) run on the service role, and an IMMUTABLE
-- function is evaluated with the caller's privileges anyway.
create or replace function public.delivery_rate()
returns integer
language sql
immutable
set search_path to public
as $function$
  select 20;
$function$;

revoke execute on function public.delivery_rate() from public, anon, authenticated;
grant execute on function public.delivery_rate() to service_role;

-- Five foreign keys with no supporting index: each one makes a delete or
-- update on the parent table scan the child. Created plainly (not
-- CONCURRENTLY) because they run inside a transaction and the tables are
-- small; the write lock lasts milliseconds.
create index if not exists idx_admin_activity_admin_id
  on public.admin_activity_log (admin_id);

create index if not exists idx_email_outbox_order_id
  on public.email_outbox (order_id);

create index if not exists idx_mpesa_callbacks_payment
  on public.mpesa_callbacks (matched_payment_id);

create index if not exists idx_mpesa_payments_order_id
  on public.mpesa_payments (order_id);

create index if not exists idx_stock_movements_order_id
  on public.stock_movements (order_id);

-- Deliberately NOT done here:
--   * orders.user_id NOT NULL. The app never inserts an order with a null
--     user_id and there are no guest orders today (0 of 2 rows), but
--     place_order() is the single writer on the money path and that
--     constraint belongs in its own change, with a test.
--   * featured vs is_featured, stock vs stock_quantity. Catalog code should
--     use is_featured and stock_quantity; nothing is renamed in this pass.

-- Rollback:
--   drop index if exists public.idx_admin_activity_admin_id;
--   drop index if exists public.idx_email_outbox_order_id;
--   drop index if exists public.idx_mpesa_callbacks_payment;
--   drop index if exists public.idx_mpesa_payments_order_id;
--   drop index if exists public.idx_stock_movements_order_id;
--   grant execute on function public.delivery_rate() to anon, authenticated;
--   alter function public.delivery_rate() reset search_path;
--   alter table public.wishlists drop constraint if exists wishlists_book_id_fkey;
--   alter table public.wishlists alter column user_id drop not null;
--   alter table public.addresses alter column user_id drop not null;
--   alter table public.orders alter column payment_status set default 'paid';
