-- Book Haven — customer ratings and reviews
--
-- STATUS: APPLIED 2026-10-23 to luniopceavtkljywukyi, recorded as version
-- 20261023162927 (see supabase_migrations.schema_migrations; the file was
-- renamed to that version so `supabase db push` does not replay it). It only
-- ADDS objects — one table, one view, four functions, indexes and policies —
-- and touched no existing row. Verified afterwards:
--
--   to_regclass('public.book_reviews')                          -> book_reviews
--   relrowsecurity on book_reviews                              -> true
--   pg_policy rows for book_reviews                             -> 6
--   trigger book_reviews_before_write enabled                   -> 1
--   has_column_privilege('anon','book_reviews','user_id','SELECT')     -> false
--   has_column_privilege('authenticated','book_reviews','is_published','UPDATE') -> false
--   has_column_privilege('authenticated','book_reviews','rating','UPDATE')       -> true
--   has_function_privilege('authenticated','my_book_review(bigint)','EXECUTE')   -> true
--   has_function_privilege('anon','my_book_review(bigint)','EXECUTE')            -> false
--
-- Everything here is idempotent: running it twice changes nothing the second
-- time. It is wrapped in a single transaction, so a failure half-way leaves
-- the database exactly as it was.
--
-- Verify afterwards:
--   select to_regclass('public.book_reviews');            -- book_reviews
--   select * from public.book_rating_summary limit 5;     -- no rows yet
--   select has_table_privilege('anon','book_reviews','SELECT');          -- true
--   select has_column_privilege('anon','book_reviews','user_id','SELECT');-- false
--   select has_column_privilege('authenticated','book_reviews','is_published','UPDATE'); -- false
--   select has_function_privilege('authenticated','public.my_book_review(bigint)','EXECUTE'); -- true
--
-- WHY THE `books` COLUMNS ARE NOT USED
-- `books.rating` (default 4.5) and `books.reviews` (default 0) already hold
-- invented numbers in production: 16 titles, 10 of them with a review count,
-- summing to 35,556 "reviews" that no customer ever wrote. Nothing in this
-- migration reads or writes those columns, and the application no longer
-- displays them. Average rating and review count now come only from this
-- table. The columns are left in place (dropping them is a destructive
-- change that is not mine to make), but they are inert.

begin;

-- ── 1. The table ────────────────────────────────────────────────────────

create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),

  -- books.id is bigint in this schema (not uuid), so the key must match.
  book_id bigint not null references public.books(id) on delete cascade,

  -- auth.users is the identity; profiles is a 1:1 mirror used for the
  -- display name. Deleting a login removes that person's reviews.
  user_id uuid not null references auth.users(id) on delete cascade,

  rating integer not null,

  -- Optional headline, up to 100 characters (enforced below).
  title text,

  -- The body. 10–2,000 characters, enforced below.
  review_text text not null,

  -- Moderation switch. Defaults to visible; only an administrator (service
  -- role, behind requireAdmin) can change it, because `authenticated` is
  -- not granted UPDATE on this column.
  is_published boolean not null default true,

  -- Derived, never supplied by the browser: set by the trigger below from
  -- the customer's own delivered orders.
  verified_purchase boolean not null default false,

  -- A privacy-safe name captured at write time ("Faith K."), so the public
  -- list never needs to read `profiles` (which contains email and phone)
  -- and never exposes a user id.
  reviewer_name text not null default 'Book Haven reader',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint book_reviews_rating_range check (rating between 1 and 5),

  -- Written as length() so the rule matches the form exactly: a review of
  -- ten characters is accepted, nine is not.
  constraint book_reviews_text_length check (char_length(review_text) between 10 and 2000),
  constraint book_reviews_title_length check (title is null or char_length(title) <= 100),
  constraint book_reviews_name_length check (char_length(reviewer_name) between 1 and 60),

  -- The product rule: one review per person per book. Enforced by the
  -- database, so two tabs racing each other cannot both succeed.
  constraint book_reviews_one_per_customer unique (book_id, user_id)
);

comment on table public.book_reviews is
  'Customer ratings and reviews. Aggregates are computed from is_published rows only; books.rating and books.reviews are legacy and unread.';

-- ── 2. Indexes ──────────────────────────────────────────────────────────
--
-- Partial on is_published: every public read filters on it, and unpublished
-- rows are a small minority, so the index stays small and the sort is served
-- by the index rather than a separate sort step.

create index if not exists book_reviews_book_recent_idx
  on public.book_reviews (book_id, created_at desc)
  where is_published;

create index if not exists book_reviews_book_rating_idx
  on public.book_reviews (book_id, rating)
  where is_published;

-- The aggregate view scans by book and filters to published rows; this is
-- the index that keeps a 16-book homepage to one index scan, not sixteen.
create index if not exists book_reviews_book_published_idx
  on public.book_reviews (book_id)
  where is_published;

-- "My reviews" and the account page.
create index if not exists book_reviews_user_idx
  on public.book_reviews (user_id);

-- Admin moderation: newest first across all books.
create index if not exists book_reviews_admin_idx
  on public.book_reviews (created_at desc);

-- ── 3. Verified purchase ────────────────────────────────────────────────
--
-- Derived from order history, never from anything the browser sends.
--
-- "Qualifying" here means the order actually reached Delivered — not merely
-- placed, and not merely paid. A paid order that was later cancelled never
-- arrives, so it does not earn the badge. `orders.items` is the jsonb array
-- written by place_order(): [{ id, quantity, price, title, author }, …].
--
-- The id cast is guarded because `items` is jsonb written by application
-- code; one malformed line must not make this function throw.

create or replace function public.customer_has_delivered(p_user_id uuid, p_book_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(exists (
    select 1
      from public.orders o
      cross join lateral jsonb_array_elements(o.items) item
     where o.user_id = p_user_id
       and o.status = 'Delivered'
       -- One malformed order row must not break every future review write.
       and jsonb_typeof(o.items) = 'array'
       and case
             when (item ->> 'id') ~ '^[0-9]+$' then (item ->> 'id')::bigint = p_book_id
             else false
           end
  ), false);
$function$;

-- Not callable as an RPC: it answers "did this user buy this book", which is
-- nobody's business but the database's. The trigger calls it as the function
-- owner, so it does not need EXECUTE for anyone else.
revoke all on function public.customer_has_delivered(uuid, bigint) from public;
revoke all on function public.customer_has_delivered(uuid, bigint) from anon, authenticated;

-- ── 4. The write trigger ────────────────────────────────────────────────
--
-- A BEFORE trigger, not a DEFAULT expression: it needs to read another table
-- (profiles for the name, orders for the badge) and it must re-derive the
-- badge on every write. Because it is SECURITY DEFINER, the assignment to
-- `verified_purchase` succeeds even though `authenticated` has no UPDATE
-- privilege on that column — which is the whole point: the browser can send
-- `verified_purchase: true` all day and it will be overwritten.

create or replace function public.book_reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_first text;
  v_last  text;
begin
  if tg_op = 'INSERT' then
    -- Snapshot the display name. First name plus a last initial: enough to
    -- feel human, not enough to identify anyone. Falls back rather than
    -- failing if the profile row has no name yet.
    select nullif(btrim(coalesce(p.first_name, '')), ''),
           nullif(btrim(coalesce(p.last_name, '')), '')
      into v_first, v_last
      from public.profiles p
     where p.id = new.user_id;

    -- Fallback for anyone who has just signed up. The sign-up form puts the
    -- name in the auth user's metadata, but handle_new_user() only writes
    -- (id, role) into profiles — so the profile name stays empty until the
    -- customer saves it on the account page. Without this, every new
    -- customer would review as "Book Haven reader" despite having typed
    -- their name a minute earlier.
    if v_first is null then
      select nullif(btrim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), ''),
             nullif(btrim(coalesce(u.raw_user_meta_data ->> 'last_name', '')), '')
        into v_first, v_last
        from auth.users u
       where u.id = new.user_id;
    end if;

    new.reviewer_name := case
      when v_first is null then 'Book Haven reader'
      when v_last  is null then left(v_first, 40)
      else left(v_first, 29) || ' ' || left(v_last, 1) || '.'
    end;

    new.created_at := coalesce(new.created_at, now());
    new.updated_at := new.created_at;

    -- Never trust these three from the client, whichever client it is.
    new.is_published     := coalesce(new.is_published, true);
    new.verified_purchase := false;
  else
    -- Ownership and target cannot move, and the name is a snapshot of the
    -- moment the review was written, not of whoever the profile is today.
    new.id            := old.id;
    new.book_id       := old.book_id;
    new.user_id       := old.user_id;
    new.created_at    := old.created_at;
    new.reviewer_name := old.reviewer_name;

    if new.rating is distinct from old.rating
       or new.title is distinct from old.title
       or new.review_text is distinct from old.review_text then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;

  new.title := nullif(btrim(new.title), '');

  -- Re-derived on every write, including moderation edits and delivery
  -- events, so the badge cannot go stale.
  new.verified_purchase := public.customer_has_delivered(new.user_id, new.book_id);

  return new;
end;
$function$;

revoke all on function public.book_reviews_before_write() from public;
-- Same default-privileges note as my_book_review. A function returning
-- `trigger` cannot be called directly anyway, but it should not be callable
-- by name at all.
revoke all on function public.book_reviews_before_write() from anon, authenticated;

drop trigger if exists book_reviews_before_write on public.book_reviews;
create trigger book_reviews_before_write
  before insert or update on public.book_reviews
  for each row execute function public.book_reviews_before_write();

-- ── 5. Aggregates ───────────────────────────────────────────────────────
--
-- One row per book that has at least one published review. Computed on read:
-- a 16-book catalogue does not need a materialised rollup, and a rollup is
-- exactly the kind of cache that goes stale after a delete or an unpublish.
--
-- security_invoker = true means the caller's own RLS applies to the base
-- table, so this cannot become a way to read unpublished rows. The explicit
-- `where is_published` keeps the intent obvious either way.

create or replace view public.book_rating_summary
with (security_invoker = true)
as
select
  r.book_id,
  round(avg(r.rating)::numeric, 2) as average_rating,
  count(*)::integer                as review_count,
  count(*) filter (where r.rating = 5)::integer as five,
  count(*) filter (where r.rating = 4)::integer as four,
  count(*) filter (where r.rating = 3)::integer as three,
  count(*) filter (where r.rating = 2)::integer as two,
  count(*) filter (where r.rating = 1)::integer as one,
  max(r.created_at)                as last_review_at
from public.book_reviews r
where r.is_published
group by r.book_id;

comment on view public.book_rating_summary is
  'Average rating, review count and 5→1 distribution per book, from published reviews only.';

-- ── 6. Row Level Security ───────────────────────────────────────────────

alter table public.book_reviews enable row level security;

-- Public: published rows only. Anyone — signed in or not — sees these.
drop policy if exists "Published reviews are public" on public.book_reviews;
create policy "Published reviews are public"
  on public.book_reviews for select
  to anon, authenticated
  using (is_published);

-- A signed-in customer can always see their own row, published or not, so
-- an unpublished review of theirs does not vanish without explanation.
drop policy if exists "Customers read their own reviews" on public.book_reviews;
create policy "Customers read their own reviews"
  on public.book_reviews for select
  to authenticated
  using (auth.uid() = user_id);

-- The admin dashboard reads with the admin's own JWT (see app/admin/page.js),
-- so it needs a policy to read unpublished rows too.
drop policy if exists "Admins can read all reviews" on public.book_reviews;
create policy "Admins can read all reviews"
  on public.book_reviews for select
  to authenticated
  using (
    exists (select 1 from public.profiles
             where profiles.id = auth.uid() and profiles.role = 'admin')
  );

-- Writes. Ownership comes from auth.uid(), never from the payload: a client
-- that posts somebody else's user_id fails the WITH CHECK.
drop policy if exists "Customers write their own reviews" on public.book_reviews;
create policy "Customers write their own reviews"
  on public.book_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Customers edit their own reviews" on public.book_reviews;
create policy "Customers edit their own reviews"
  on public.book_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers delete their own reviews" on public.book_reviews;
create policy "Customers delete their own reviews"
  on public.book_reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── 7. Grants ───────────────────────────────────────────────────────────
--
-- Column-level, in the same style as the profiles hardening: RLS decides
-- which ROWS, these grants decide which COLUMNS. Both have to pass.
--
-- `user_id` is deliberately absent from the anon SELECT list, so a refresh
-- token — which carries no email — still cannot be used to correlate two
-- reviews to the same person, and `select *` on this table fails loudly
-- rather than leaking an internal identifier.

revoke all on public.book_reviews from anon, authenticated;

grant select (id, book_id, rating, title, review_text, is_published,
              verified_purchase, reviewer_name, created_at, updated_at)
  on public.book_reviews to anon, authenticated;

-- A customer may set: the book, their own id, the rating and the text.
-- Everything else is defaulted or computed.
grant insert (book_id, user_id, rating, title, review_text)
  on public.book_reviews to authenticated;

-- Editing covers the rating and the words only. Not is_published (that is
-- moderation) and not verified_purchase (that is order history).
grant update (rating, title, review_text)
  on public.book_reviews to authenticated;

grant delete on public.book_reviews to authenticated;

grant select on public.book_rating_summary to anon, authenticated;

-- ── 8. Finding your own review ──────────────────────────────────────────
--
-- A customer cannot ask "which row belongs to me?" themselves: `user_id` is
-- not in their SELECT grant (section 7), precisely so that no browser can
-- read or correlate other people's ids. Without this function the form
-- would have no way to know whether the reader has already reviewed a book,
-- and a client-side UPDATE filtered by user_id is refused by Postgres for
-- the same reason (proved in scripts/reviews-sql-test.mjs).
--
-- So: one SECURITY DEFINER function, scoped to auth.uid(), returning only
-- the caller's own row. It cannot be pointed at anybody else, and an
-- anonymous caller gets zero rows because auth.uid() is null.

create or replace function public.my_book_review(p_book_id bigint)
returns table (
  id uuid,
  book_id bigint,
  rating integer,
  title text,
  review_text text,
  is_published boolean,
  verified_purchase boolean,
  reviewer_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  select r.id, r.book_id, r.rating, r.title, r.review_text,
         r.is_published, r.verified_purchase, r.reviewer_name,
         r.created_at, r.updated_at
    from public.book_reviews r
   where r.user_id = auth.uid()
     and r.book_id = p_book_id
   limit 1;
$function$;

revoke all on function public.my_book_review(bigint) from public;
-- Supabase's default privileges grant EXECUTE on new functions in `public`
-- to anon and authenticated explicitly, which `revoke ... from public` does
-- not undo. On the live project anon turned out to still hold this one; it
-- was revoked by hand and is revoked here so a fresh database matches.
-- (Harmless either way — with no token auth.uid() is null, so the function
-- returns no rows — but "harmless" is not the same as "intended".)
revoke all on function public.my_book_review(bigint) from anon;
grant execute on function public.my_book_review(bigint) to authenticated;

-- ── 9. Delivery → badge refresh ─────────────────────────────────────────
--
-- When an order is marked Delivered, any review that customer already left
-- for a book in that order should gain the badge. The trigger above derives
-- the value; this function just forces the affected rows to be re-written.
-- Service role only: it takes a user id, so it must never be a public RPC.

create or replace function public.refresh_review_verification(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer;
begin
  update public.book_reviews
     set verified_purchase = public.customer_has_delivered(user_id, book_id)
   where user_id = p_user_id
     and verified_purchase is distinct from public.customer_has_delivered(user_id, book_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.refresh_review_verification(uuid) from public;
revoke all on function public.refresh_review_verification(uuid) from anon, authenticated;

commit;

-- ── Rollback (manual, if ever needed) ───────────────────────────────────
-- No production data is touched by this file beyond the rows customers
-- themselves create. To undo it entirely:
--
--   drop view if exists public.book_rating_summary;
--   drop function if exists public.my_book_review(bigint);
--   drop function if exists public.refresh_review_verification(uuid);
--   drop function if exists public.book_reviews_before_write();
--   drop function if exists public.customer_has_delivered(uuid, bigint);
--   drop table if exists public.book_reviews;
--
-- Dropping the table also discards every review written through it. Export
-- it first if that day ever comes.
