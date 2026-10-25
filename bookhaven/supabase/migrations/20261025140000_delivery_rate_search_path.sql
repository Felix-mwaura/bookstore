-- Book Haven — pin the search_path of delivery_rate()
--
-- STATUS: NOT APPLIED. Prepared 2026-10-25 as part of the security audit.
--
-- WHY THIS EXISTS
--   public.delivery_rate() was created in 20261021110000_delivery_rate.sql
--   without a fixed search_path. It is a SECURITY INVOKER, IMMUTABLE function
--   that returns a constant today, so nothing is exploitable right now — but
--   the function is the one /api/orders calls before it quotes a total, and a
--   SECURITY DEFINER caller that runs it with a hostile search_path (a schema
--   the attacker can create objects in, ahead of `public`) is the classic way
--   a "harmless" helper becomes a privilege boundary. Every other function in
--   this project already pins it (`set search_path = public`); this one was
--   missed.
--
-- WHAT IT CHANGES
--   Exactly one function: the same body (`select 20;`), the same volatility,
--   the same owner, the same grants, plus `set search_path = ''`. An empty
--   search path is correct here because the body references no object at all;
--   if the rate ever has to come from a table, name that table's schema
--   explicitly rather than widening this.
--
-- HOW TO APPLY
--   Supabase dashboard → SQL editor → paste → run. Idempotent.
--
-- ROLLBACK
--   create or replace function public.delivery_rate()
--   returns integer language sql immutable as $function$ select 20; $function$;
--   grant execute on function public.delivery_rate() to service_role;
--
-- VERIFY
--   select proname, proconfig
--     from pg_proc
--    where proname = 'delivery_rate'
--      and pronamespace = 'public'::regnamespace;
--   -- proconfig must be {"search_path=\"\""}
--
--   select public.delivery_rate();   -- still 20

create or replace function public.delivery_rate()
returns integer
language sql
immutable
set search_path = ''
as $function$
  select 20;
$function$;

-- create or replace keeps the privileges of an existing function, but stating
-- them makes this file correct even on a database where it never existed.
revoke all on function public.delivery_rate() from public;
grant execute on function public.delivery_rate() to service_role;
