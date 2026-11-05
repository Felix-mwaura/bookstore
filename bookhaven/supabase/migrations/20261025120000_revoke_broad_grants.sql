-- Revoke the grants the browser roles were given by default, not by design.
--
-- Live state before this migration (information_schema.role_table_grants):
--   anon + authenticated held TRUNCATE, TRIGGER and REFERENCES on every table,
--   full DML on addresses / wishlists / admin_activity_log / stock_movements,
--   INSERT + DELETE on profiles, and all of that on the book_rating_summary
--   view. RLS still protected the rows, but grants are the first layer: a
--   future policy mistake, a SECURITY DEFINER helper or a PostgREST feature
--   that bypasses RLS turns "no policy" into "no protection".
--
-- Kept on purpose:
--   addresses, wishlists  -> SELECT/INSERT/UPDATE/DELETE for authenticated
--                            (row-scoped by "Users manage own ...")
--   book_reviews          -> the existing column-level grants
--   profiles              -> SELECT + column UPDATE (first_name, last_name,
--                            phone) for authenticated; the signup trigger
--                            writes the row as its owner
--   books/orders/payments -> SELECT only, as today
--
-- Not applied by the audit. Apply with `supabase db push` (or the SQL editor)
-- after reviewing; rollback is at the bottom.

-- 1. Table-only privileges, on every table in public.
do $$
declare rel record;
begin
  for rel in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', rel.relname);
  end loop;
end $$;

-- 2. Views cannot be truncated, but they were granted INSERT/UPDATE/DELETE.
do $$
declare rel record;
begin
  for rel in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', rel.relname);
  end loop;
end $$;

-- 3. Writes that only the service role should perform.
revoke insert, update, delete on public.admin_activity_log from anon, authenticated;
revoke insert, update, delete on public.email_outbox from anon, authenticated;
revoke insert, update, delete on public.stock_movements from anon, authenticated;
revoke insert, update, delete on public.mpesa_payments from anon, authenticated;
revoke insert, update, delete on public.newsletter_subscribers from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- 4. anon has no session, so it can never satisfy a "own rows" policy.
revoke insert, update, delete on public.addresses from anon;
revoke insert, update, delete on public.wishlists from anon;

-- 5. Re-assert the reads the app actually needs (no-ops if already granted).
grant select on public.books to anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.book_rating_summary to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- Rollback (grants are additive; re-grant only what you removed):
--   grant insert, delete on public.profiles to anon, authenticated;
--   grant insert, update, delete on public.wishlists to anon, authenticated;
--   grant insert, update, delete on public.addresses to anon, authenticated;
--   grant truncate, trigger, references on all tables in schema public to anon, authenticated;
--   (the TRUNCATE/TRIGGER/REFERENCES grants are never needed by the app; prefer not to restore them)
