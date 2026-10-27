-- Pin delivery_rate()'s search_path.
--
-- STATUS: APPLIED 2026-10-27, as part of migration 20261027173645
-- (schema_defaults_fk_and_fk_indexes). That migration recreated the function
-- with `set search_path to public` and closed EXECUTE to every end-user role.
-- This file is kept so the record is complete and so a replay lands on the
-- same state instead of undoing it.
--
-- Live definition before the change:
--
--   create or replace function public.delivery_rate()
--   returns integer language sql immutable
--   as $function$ select 20; $function$
--
-- It was the only function in the schema without a pinned search_path. It is
-- SECURITY INVOKER and returns a constant, so the risk was small — but it is
-- called from app/api/orders/route.js as a pricing guard, and a search_path a
-- caller can influence is exactly the shape that becomes a privilege problem
-- when a function later references a table.
--
-- `select 20` resolves no object names; `public` is pinned rather than `''`
-- so the function keeps resolving the way the rest of the schema does.
--
-- EXECUTE: both call sites (app/api/orders/route.js, app/lib/mpesa-availability.js)
-- use the service-role client, so authenticated does not need it either.
-- service_role inherits nothing, so it is granted explicitly.

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

-- Rollback:
--   grant execute on function public.delivery_rate() to anon, authenticated;
--   alter function public.delivery_rate() reset search_path;
