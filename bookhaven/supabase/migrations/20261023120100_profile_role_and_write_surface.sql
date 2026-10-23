-- Book Haven — roles, RLS and write surfaces (production-aligned)
--
-- STATUS: NEW — created 2026-10-23. Every statement below is idempotent, and
-- the parts that already exist in production (§1) are re-created with their
-- live definitions so this file brings a fresh database to the same state
-- without changing the current one. NOT APPLIED from this repository.
--
-- WHY THIS EXISTS
--   Production already blocks role escalation: an attempt to promote a real
--   customer with their own JWT is rejected with
--       ERROR 42501: Role changes are not permitted from this context
--   by the trigger public.trg_protect_profile_role → public.protect_profile_role().
--   That trigger is not created by any migration in this repository, so a
--   database rebuilt from source would be wide open:
--
--       profiles_update_own   using (auth.uid() = id)      -- any column
--       authenticated         GRANT UPDATE ON profiles     -- any column
--       → PATCH /rest/v1/profiles?id=eq.<own> {"role":"admin"}   (succeeds)
--
--   This file makes the repository the source of truth again, and adds the
--   second layer (column privileges) so a permissive policy added later
--   cannot re-open the same hole.
--
-- WHAT IT CHANGES
--   1. public.profiles — the live role guard is re-created verbatim; anon and
--      authenticated lose table-wide UPDATE and keep UPDATE on exactly
--      first_name, last_name and phone (the only columns the account page
--      writes).
--   2. public.orders, public.books — browser write privileges removed. Order
--      creation is place_order() (service role); book editing is
--      /api/admin/books (service role). Browsers keep SELECT, which RLS then
--      narrows.
--   3. public.newsletter_subscribers — the "Anyone can subscribe" policy was
--      created FOR ALL with WITH CHECK (true) and no USING clause. Postgres
--      treats an omitted USING as true, so `anon` could UPDATE or DELETE
--      every subscriber through PostgREST. The API only ever inserts, and it
--      does so with the service role, so the policy is narrowed to INSERT
--      and browser write grants are removed.
--
-- NOT CHANGED
--   * wishlists and addresses keep "users manage their own rows" — the
--     policies already restrict them to auth.uid() = user_id.
--   * The RLS policies on orders/mpesa_payments/books are untouched; this
--     only removes privileges that no shipped feature uses.
--
-- ROLLBACK
--   grant update on public.profiles to anon, authenticated;
--   grant insert, update, delete on public.orders to anon, authenticated;
--   grant insert, update, delete on public.books to anon, authenticated;
--   drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
--   create policy "Anyone can subscribe" on public.newsletter_subscribers
--     for all with check (true);
--   (leaving the role trigger in place — it is what production runs today)

begin;

-- ── 1. Role changes: database refuses, only the admin API can change roles ─
-- Verbatim copy of the live definition, so applying this to production does
-- not change behaviour there.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' and new.role is distinct from 'customer' then
      raise exception 'Not permitted to create a profile with role %', new.role
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Role changes are not permitted from this context'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Column-level privileges. A row policy cannot grant access to a column the
-- role has no UPDATE privilege on, so this survives any future policy.
revoke update, references, trigger on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- ── 2. Orders and books: read-only from a browser ─────────────────────────
revoke insert, update, delete, truncate, references, trigger
  on public.orders from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.books from anon, authenticated;

-- ── 3. Newsletter: insert-only, and not from a browser at all ─────────────
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
-- /api/newsletter uses the service role, which bypasses RLS. No client-side
-- insert path exists, so no policy is required; SELECT stays admin-only
-- through "Admins can read newsletter subscribers".
revoke insert, update, delete, truncate, references, trigger
  on public.newsletter_subscribers from anon, authenticated;

commit;

-- ── Verification, after applying ──────────────────────────────────────────
-- Run these as the roles that matter, not as postgres.
--
-- 1. A signed-in customer cannot promote themselves (expect 42501 or a
--    permission error, never UPDATE 1):
--      set local role authenticated;
--      select set_config('request.jwt.claims',
--        '{"sub":"<customer uuid>","role":"authenticated"}', true);
--      update public.profiles set role = 'admin' where id = '<customer uuid>';
--      → ERROR: Role changes are not permitted from this context
--
-- 2. The same customer can still edit their own details:
--      update public.profiles set first_name = 'Test' where id = '<customer uuid>';
--      → UPDATE 1
--
-- 3. Column privileges are in place:
--      select column_name, privilege_type
--        from information_schema.column_privileges
--       where table_name = 'profiles' and grantee = 'authenticated'
--         and privilege_type = 'UPDATE';
--      → exactly first_name, last_name, phone
--
-- 4. Browsers cannot write orders, books or payments:
--      select has_table_privilege('authenticated','public.orders','INSERT'),
--             has_table_privilege('authenticated','public.books','UPDATE'),
--             has_table_privilege('anon','public.mpesa_payments','UPDATE');
--      → false, false, false
--
-- 5. The admin role workflow still works:
--      /admin → Users → change a test account's role. The service role is
--      exempt from both the trigger and the column grants.
