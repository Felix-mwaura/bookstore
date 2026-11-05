-- A shared counter for the rate limiter in app/lib/rate-limit.js.
--
-- NOT APPLIED. The routes that use it fail open (with a warning) until this
-- runs, so nothing breaks in the meantime — but nothing is limited across
-- instances either, which is the whole point. Apply with `supabase db push`
-- or the SQL editor after reviewing.
--
-- Why a table and not an extension: the shop already has a service-role
-- client, so this needs no new dependency, no new host and no new secret.
-- Upstash (if configured) is preferred at runtime because it keeps the
-- counter off the database that serves the shop; this is the fallback that
-- always exists.
--
-- Keys are SHA-256 pseudonyms of an IP address or a user id, produced in
-- app/lib/rate-limit.js. No raw IP or phone number is stored here.

create table if not exists public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  count integer not null default 0
);

comment on table public.rate_limits is
  'Fixed-window counters for app/lib/rate-limit.js. Written only by check_rate_limit().';

-- Service role only: no policy means no access through the API for anyone
-- else, and the grants are removed explicitly so the default PUBLIC grant on
-- a new table cannot be exercised.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Index for the opportunistic sweep below.
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_started_at);

-- One atomic increment-and-report, so two instances cannot both read "4" and
-- both decide the 5th request is fine.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key is null or p_key = '' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'check_rate_limit: invalid arguments' using errcode = '22023';
  end if;

  insert into public.rate_limits as rl (key, window_started_at, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
              when rl.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
              else rl.count + 1
            end,
    window_started_at = case
              when rl.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
              else rl.window_started_at
            end
  returning rl.window_started_at, rl.count into v_window_start, v_count;

  allowed := v_count <= p_limit;
  retry_after := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))
    )::integer
  end;

  -- Rows are never read again once their window has passed. Sweep them
  -- occasionally rather than on every call: 1 in 50 requests pays for one
  -- bounded delete, which keeps the table small without a cron job.
  if random() < 0.02 then
    delete from public.rate_limits
    where window_started_at < now() - interval '1 day';
  end if;

  return next;
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is
  'Atomically count one attempt in a fixed window. Called by the server with the service role.';

-- The app calls this with the service-role key, which bypasses RLS. No
-- end-user role has any business counting here, and SECURITY DEFINER would
-- otherwise let any signed-in user write rows.
revoke execute on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

-- ...but `service_role` inherits nothing, so revoking the default PUBLIC grant
-- takes EXECUTE away from it too: PostgREST would answer 42501 permission
-- denied and both routes would sit in their failure path. Grant it back
-- explicitly, the way set_order_status() and place_order() already are.
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

-- Rollback:
--   drop function if exists public.check_rate_limit(text, integer, integer);
--   drop table if exists public.rate_limits;
