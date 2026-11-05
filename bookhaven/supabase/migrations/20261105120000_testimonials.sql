-- ─────────────────────────────────────────────────────────────
-- Reader testimonials, with an optional book recommendation.
--
-- Written for the homepage's testimonials section. NOT APPLIED: this adds a
-- table and RLS policies, which is a schema change the shop owner runs.
--
-- The rules this encodes:
--
--   • Anyone may read a testimonial the shop has published. Nobody may read
--     an unpublished one — including the person who wrote it, whose own row
--     comes back through the "own" policy below.
--   • A signed-in reader may write exactly one testimonial under their own
--     id. They cannot set is_published; a moderator publishes from /admin.
--   • Nothing is editable after it is written except by an admin. A
--     testimonial is a statement made in public; quietly rewriting somebody
--     else's would be worse than deleting it.
--   • The book a reader recommends is stored as both an id (for the link,
--     with ON DELETE SET NULL so a removed book cannot block the row) and a
--     title snapshot (so the quote still reads when the book is gone).
--
-- Idempotent: safe to run more than once.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  author_name text not null,
  body        text not null,
  rating      smallint,
  book_id     bigint references public.books (id) on delete set null,
  book_title  text,
  is_published boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Lengths are enforced in the database as well as the route: the route is the
-- only writer today, but a constraint is what survives a second writer.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'testimonials_body_length') then
    alter table public.testimonials
      add constraint testimonials_body_length check (char_length(btrim(body)) between 20 and 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'testimonials_author_length') then
    alter table public.testimonials
      add constraint testimonials_author_length check (char_length(btrim(author_name)) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'testimonials_rating_range') then
    alter table public.testimonials
      add constraint testimonials_rating_range check (rating is null or rating between 1 and 5);
  end if;
end $$;

-- One testimonial per account. A wall of quotes from one person is not a wall
-- of quotes; the "edit yours" path lives in the account page, not here.
create unique index if not exists testimonials_one_per_user
  on public.testimonials (user_id)
  where user_id is not null;

-- The homepage reads published rows, newest first.
create index if not exists testimonials_published_created_idx
  on public.testimonials (created_at desc)
  where is_published;

alter table public.testimonials enable row level security;

drop policy if exists "testimonials: published are public" on public.testimonials;
create policy "testimonials: published are public"
  on public.testimonials for select
  using (is_published = true);

drop policy if exists "testimonials: read your own" on public.testimonials;
create policy "testimonials: read your own"
  on public.testimonials for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "testimonials: write your own" on public.testimonials;
create policy "testimonials: write your own"
  on public.testimonials for insert
  to authenticated
  with check (user_id = auth.uid() and is_published = false);

-- Grants follow the rest of the shop: the browser reads published rows as
-- anon, and signed-in readers write only their own row. No update or delete
-- grant for either role — moderation runs through the service role in
-- /api/admin, which bypasses RLS by design and is already audited.
revoke all on public.testimonials from anon, authenticated;
grant select on public.testimonials to anon;
grant select, insert on public.testimonials to authenticated;
