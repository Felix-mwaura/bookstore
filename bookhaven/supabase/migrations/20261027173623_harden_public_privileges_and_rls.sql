-- Least-privilege pass on the public schema.
--
-- STATUS: APPLIED 2026-10-27 to luniopceavtkljywukyi as version 20261027173623
-- (applied through the Supabase MCP, not `supabase db push`; this file is the
-- record of exactly what ran). It changes grants and policy definitions only —
-- no table is created, dropped or rewritten, and no row is touched.
--
-- Two problems, one file:
--
--   1. anon and authenticated held TRUNCATE, REFERENCES and TRIGGER on every
--      table in public, plus INSERT/UPDATE/DELETE on tables the browser never
--      writes. RLS stops row access but does not stop TRUNCATE (it is not
--      row-filtered) nor REFERENCES (it lets a role add a foreign key that
--      blocks deletes).
--   2. Twenty-one policies called auth.uid()/is_admin() directly, which
--      Postgres re-evaluates per row instead of once per query.
--
-- Verified after applying (live): 23 policies, 0 duplicates, anon cannot
-- execute is_admin(), authenticated can, profiles.role is not updatable,
-- anon TRUNCATE refused, admin_activity_log INSERT refused for authenticated.

-- ── 1. Table privileges ────────────────────────────────────────────────

-- TRUNCATE ignores RLS; REFERENCES lets a role pin a row in place with a
-- foreign key. No browser session needs either.
revoke truncate, references, trigger on all tables in schema public
  from anon, authenticated;

-- ...and stop new tables from picking the grants back up.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- Written only by the service role (admin routes, edge functions, triggers).
revoke insert, update, delete on table
  public.admin_activity_log,
  public.email_outbox,
  public.stock_movements,
  public.mpesa_payments,
  public.newsletter_subscribers
from anon, authenticated;

-- profiles: a customer may change their name and phone (app/account/page.js
-- writes exactly these), never their role. Column-level UPDATE means a
-- request that tries another column is rejected by the database.
revoke update on table public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, email) on table public.profiles
  to authenticated;

-- book_reviews already carries the column-level grants from migration
-- 20261023162927: SELECT on every column except user_id, INSERT on
-- (book_id, user_id, rating, title, review_text), UPDATE on (rating, title,
-- review_text). Deliberately NOT widened to table-level SELECT/INSERT/UPDATE
-- here: that would expose user_id to anon and let a customer set
-- is_published / verified_purchase on their own review. Verified after apply:
-- anon `select *` is still refused, and an insert carrying is_published is
-- still refused.

-- ── 2. Function privileges ─────────────────────────────────────────────

-- SECURITY DEFINER, returns whether the caller is an admin. Policies that
-- use it belong to `authenticated` only (below), so anon has no use for it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ── 3. Duplicate permissive policies ───────────────────────────────────

-- Exact duplicate of "Books are publicly readable" (same command, roles and
-- `true` qual), so it only doubled the evaluation.
drop policy if exists "Public books read" on public.books;

-- Superseded by "Admins can read mpesa payments" (authenticated + is_admin()).
drop policy if exists "Admins can read payments" on public.mpesa_payments;

-- ── 4. Policies rewritten with (select ...) ────────────────────────────
--
-- `(select auth.uid())` / `(select public.is_admin())` are InitPlans: the
-- function runs once per query, not once per row. Semantics are unchanged.

-- addresses
drop policy if exists "Users manage own addresses" on public.addresses;
create policy "Users manage own addresses" on public.addresses
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- admin_activity_log (was `to public`; anon no longer has EXECUTE on
-- is_admin(), and never had anything to read here anyway)
drop policy if exists "Admins can read activity log" on public.admin_activity_log;
create policy "Admins can read activity log" on public.admin_activity_log
  for select to authenticated
  using ((select public.is_admin()));

-- book_reviews
drop policy if exists "Admins can read all reviews" on public.book_reviews;
create policy "Admins can read all reviews" on public.book_reviews
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Customers delete their own reviews" on public.book_reviews;
create policy "Customers delete their own reviews" on public.book_reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers edit their own reviews" on public.book_reviews;
create policy "Customers edit their own reviews" on public.book_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers read their own reviews" on public.book_reviews;
create policy "Customers read their own reviews" on public.book_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers write their own reviews" on public.book_reviews;
create policy "Customers write their own reviews" on public.book_reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- books (admin writes run through the service role, which bypasses RLS;
-- these exist for completeness and no longer need to face anon)
drop policy if exists "Admins can delete books" on public.books;
create policy "Admins can delete books" on public.books
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can insert books" on public.books;
create policy "Admins can insert books" on public.books
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update books" on public.books;
create policy "Admins can update books" on public.books
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- email_outbox
drop policy if exists "Admins can read email outbox" on public.email_outbox;
create policy "Admins can read email outbox" on public.email_outbox
  for select to authenticated
  using ((select public.is_admin()));

-- mpesa_payments
drop policy if exists "Admins can read mpesa payments" on public.mpesa_payments;
create policy "Admins can read mpesa payments" on public.mpesa_payments
  for select to authenticated
  using ((select public.is_admin()));

-- newsletter_subscribers
drop policy if exists "Admins can read newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can read newsletter subscribers" on public.newsletter_subscribers
  for select to authenticated
  using ((select public.is_admin()));

-- orders
drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders" on public.orders
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders" on public.orders
  for select to public
  using ((select auth.uid()) = user_id);

-- profiles
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to public
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to public
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to public
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- stock_movements
drop policy if exists "Admins can read stock movements" on public.stock_movements;
create policy "Admins can read stock movements" on public.stock_movements
  for select to authenticated
  using ((select public.is_admin()));

-- wishlists
drop policy if exists "Users manage own wishlist" on public.wishlists;
create policy "Users manage own wishlist" on public.wishlists
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── Rollback ───────────────────────────────────────────────────────────
-- The dropped policies cannot be restored verbatim from this file; recreate
-- them from the definitions replaced above, then:
--   grant execute on function public.is_admin() to anon;
--   grant update on table public.profiles to authenticated;
--   grant insert, update, delete on table public.admin_activity_log,
--     public.email_outbox, public.stock_movements, public.mpesa_payments,
--     public.newsletter_subscribers to anon, authenticated;
--   grant truncate, references, trigger on all tables in schema public
--     to anon, authenticated;
-- Nothing is dropped here, so no data is at risk.
