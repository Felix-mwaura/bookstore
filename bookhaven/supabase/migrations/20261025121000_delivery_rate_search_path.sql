-- Pin delivery_rate()'s search_path.
--
-- Live definition before this migration:
--
--   create or replace function public.delivery_rate()
--   returns integer language sql immutable
--   as $function$ select 20; $function$
--
-- It is the only function in the schema without a pinned search_path. It is
-- SECURITY INVOKER and returns a constant, so the current risk is small — but
-- it is called from app/api/orders/route.js as a pricing guard, and a
-- search_path that a caller can influence is exactly the shape that becomes a
-- privilege problem when a function later references a table.
--
-- `select 20` resolves no object names, so an empty search_path is correct.
-- EXECUTE stays with authenticated (the app calls it through the user's
-- client) and is removed from anon, which never prices a cart.

alter function public.delivery_rate() set search_path = '';

revoke execute on function public.delivery_rate() from anon;

-- Rollback:
--   alter function public.delivery_rate() reset search_path;
--   grant execute on function public.delivery_rate() to anon;
