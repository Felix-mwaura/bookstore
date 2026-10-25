-- Book Haven — grant hygiene: nothing more than the app uses
--
-- STATUS: NOT APPLIED. Prepared 2026-10-25 as part of the security audit.
--
-- WHY THIS EXISTS
--   Supabase's default grants are generous: every table in `public` is handed
--   to `anon` and `authenticated` with ALL privileges, including TRUNCATE,
--   TRIGGER and REFERENCES, which PostgREST cannot even expose. Row Level
--   Security still decides *which rows* are visible, but it is not the only
--   lock: `anon` (a role literally printed in the browser bundle) holding
--   INSERT/UPDATE/DELETE on `addresses`, `wishlists` and `admin_activity_log`
--   means a single mistaken policy — or a policy added next month by someone
--   in a hurry — becomes anonymous write access. This migration removes the
--   privileges that no code path uses, so the mistake has to be made twice.
--
-- WHAT IT CHANGES (privileges only: no table, row, column or policy)
--   1. TRUNCATE, TRIGGER, REFERENCES: removed from anon and authenticated on
--      every table in `public`, and from the default privileges that apply to
--      tables created later. No PostgREST request can use any of them.
--   2. anon: no INSERT/UPDATE/DELETE on any table in `public`, and none on
--      future tables. Every write in this app goes through a Next.js route
--      that either uses the service role or the caller's own JWT — the browser
--      anon key is only ever used to SELECT.
--   3. anon: no SELECT on the tables that hold customer or operational data
--      (orders, profiles, addresses, wishlists, payments, callbacks, the email
--      outbox, stock movements, the admin log). RLS already hides these; this
--      is the second lock. The public catalogue (books, reviews, categories,
--      the rating summary) is deliberately left readable.
--   4. authenticated: keeps SELECT/INSERT/UPDATE/DELETE on addresses and
--      wishlists (the API routes use the caller's JWT under RLS), and keeps
--      SELECT where the app reads. admin_activity_log loses every write
--      privilege: rows are written by SECURITY DEFINER functions and the
--      service role, never by a customer.
--
-- WHAT IT DELIBERATELY LEAVES ALONE
--   * Sequences: addresses and wishlists may use serial keys, and an
--     authenticated INSERT needs USAGE on its sequence. Revoking blind would
--     break checkout; it is not worth the risk for no gain.
--   * EXECUTE on functions: `is_admin()`, `my_book_review()` and
--     `set_order_status()` are called by signed-in customers and are
--     individually reviewed in the audit report.
--   * Supabase-managed schemas (auth, storage, realtime).
--
-- HOW TO APPLY
--   Supabase dashboard → SQL editor → paste → run. Then run the VERIFY query
--   at the bottom: it must return zero rows for both roles.
--
-- ROLLBACK
--   Privileges are the easiest thing in Postgres to restore, which is exactly
--   why this is safe to apply:
--
--     grant all on all tables in schema public to anon, authenticated;
--     alter default privileges in schema public
--       grant all on tables to anon, authenticated;
--
--   That returns the project to Supabase's stock grants — the state this
--   migration exists to leave. Nothing is dropped, so there is no data loss
--   in either direction.

begin;

-- ── 1. Privileges PostgREST never uses ────────────────────────────────────
revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;

alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- ── 2. The anon role writes nothing ───────────────────────────────────────
revoke insert, update, delete on all tables in schema public from anon;
alter default privileges in schema public
  revoke insert, update, delete on tables from anon;

-- ── 3. anon cannot read customer or operational data ──────────────────────
-- Table by table, guarded: a project that does not have one of these tables
-- (or has it in another schema) must not make the migration fail half-way.
do $$
declare
  t text;
  sensitive text[] := array[
    'orders',
    'profiles',
    'addresses',
    'wishlists',
    'admin_activity_log',
    'mpesa_payments',
    'mpesa_callbacks',
    'email_outbox',
    'stock_movements'
  ];
begin
  foreach t in array sensitive loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('revoke select on public.%I from anon', t);
    end if;
  end loop;
end;
$$;

-- ── 4. The admin log is written by functions, never by a customer ─────────
do $$
begin
  if to_regclass('public.admin_activity_log') is not null then
    execute 'revoke insert, update, delete on public.admin_activity_log
               from anon, authenticated';
    -- SELECT stays: an admin session may read it under RLS, and an admin-only
    -- read policy without a grant is a trap for the next person to debug it.
  end if;
end;
$$;

-- ── 5. Catalogues stay public ─────────────────────────────────────────────
-- Stated explicitly rather than left implicit: these are what the shop is.
grant select on public.books to anon, authenticated;
grant select on public.book_reviews to anon, authenticated;
grant select on public.book_rating_summary to anon, authenticated;
do $$
begin
  if to_regclass('public.categories') is not null then
    execute 'grant select on public.categories to anon, authenticated';
  end if;
  if to_regclass('public.book_rating_summary') is not null then
    execute 'grant select on public.book_rating_summary to anon, authenticated';
  end if;
end;
$$;

commit;

-- ── VERIFY ────────────────────────────────────────────────────────────────
-- Expect ZERO rows. Anything listed here is a privilege this migration meant
-- to remove — most likely a table created after it ran, which is what the
-- default-privilege statements above prevent.
--
--   select grantee, table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and grantee in ('anon', 'authenticated')
--      and (
--        privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
--        or (grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
--        or (grantee = 'authenticated' and table_name = 'admin_activity_log'
--            and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
--      )
--    order by grantee, table_name, privilege_type;
--
-- And this must still list the public catalogue for anon (books, book_reviews,
-- book_rating_summary, categories), or the shopfront will render empty:
--
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'
--    order by table_name;
