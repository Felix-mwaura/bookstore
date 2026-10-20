-- Book Haven — profile role hardening + write-surface reduction
--
-- STATUS: prepared, NOT APPLIED. This environment has no database
-- credentials, so nothing here has been executed or verified against the
-- live project. Apply it in the Supabase SQL editor (or `supabase db push`)
-- after reading it, then re-run the checks at the bottom.
--
-- Why it exists
-- -------------
-- The base schema (tables, policies, trigger functions) predates this
-- repository and is not in version control, so the `profiles` UPDATE policy
-- cannot be inspected from source. The common shape is
--
--     create policy "Users can update own profile"
--       on public.profiles for update using (auth.uid() = id);
--
-- which permits *every* column, including `role`. A signed-in customer could
-- then promote themselves with one PostgREST request. The application never
-- writes `role` from the browser, so removing that column's UPDATE right
-- cannot break any shipped feature.
--
-- `orders` and `mpesa_payments` are likewise only written by server routes
-- using the service role. Removing browser write rights makes the existing
-- "browsers are read-only here" intent enforced by the database rather than
-- by convention.

begin;

-- ── 1. profiles: customers may edit their own contact details, never role ──
--
-- Column privileges beat RLS here: even a permissive row policy cannot grant
-- access to a column the role has no UPDATE privilege on.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- Second layer: if a future migration re-grants table-level UPDATE, the
-- trigger still refuses a role change made with an end-user JWT.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for the service role, migrations and the SQL
    -- editor; those are trusted administrative paths.
    if auth.uid() is not null then
      raise exception 'ROLE_CHANGE_FORBIDDEN'
        using hint = 'Roles are changed by an administrator through the admin API.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── 2. orders: browser access stays SELECT-only ────────────────────────────
-- Creation is place_order() via the service role; status changes go through
-- set_order_status()/bulk_set_order_status() via /api/admin/*.
revoke insert, update, delete on public.orders from anon, authenticated;

-- ── 3. mpesa_payments: written only by the server ──────────────────────────
revoke insert, update, delete on public.mpesa_payments from anon, authenticated;

commit;

-- ── Verification (run after applying) ──────────────────────────────────────
-- 1. As a signed-in customer (anon key + their JWT), this must fail with
--    "permission denied for table profiles" or "ROLE_CHANGE_FORBIDDEN":
--      update public.profiles set role = 'admin' where id = auth.uid();
--
-- 2. The same customer updating their name must still succeed:
--      update public.profiles set first_name = 'Test' where id = auth.uid();
--
-- 3. From the dashboard REST tab with a customer token, an INSERT into
--    `orders` must return 401/403, while a SELECT of their own orders works.
--
-- 4. Sign in as the admin and change a test user's role from
--    /admin → Users. It must still succeed (service role is unaffected).
