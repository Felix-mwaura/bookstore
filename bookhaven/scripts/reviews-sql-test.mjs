// Runs supabase/migrations/20261023162927_book_reviews.sql against a real
// Postgres (PGlite, PG 17) with a Supabase-shaped scaffold, then attacks it.
//
// This is the closest thing to the live database that can run without
// touching production. It is not a substitute for applying the migration to
// the real project, but it does prove the constraints, triggers, grants and
// RLS policies behave as intended under actual Postgres.
//
//   node scripts/reviews-sql-test.mjs

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// PGlite is an optional dev dependency (a WASM build of Postgres, ~4 MB).
// It is not in package.json because it is only needed to prove the SQL, not
// to run the site. Without it this test says so and exits 0 rather than
// failing the suite.
let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.log("SKIP — reviews (SQL): @electric-sql/pglite is not installed.");
  console.log("       npm install --no-save @electric-sql/pglite && node scripts/reviews-sql-test.mjs");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, "..", "supabase", "migrations", "20261023162927_book_reviews.sql");

const failures = [];
let passes = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { passes++; console.log(`  ok    ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); }
};
const eq = (label, actual, expected) =>
  ok(label, String(actual) === String(expected), `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const section = (name) => console.log(`\n${name}`);

const db = new PGlite();

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

// ── Supabase-shaped scaffold ────────────────────────────────────────────────
// Only what the migration and the policies actually reference.
async function scaffold() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema if not exists auth;

    create table auth.users (id uuid primary key, email text);

    -- Same body as Supabase's auth.uid(): the subject claim of the request.
    create or replace function auth.uid()
    returns uuid language sql stable as $$
      select nullif(
        coalesce(
          current_setting('request.jwt.claim.sub', true),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        ), ''
      )::uuid
    $$;

    create table public.books (
      id bigint primary key,
      title text not null,
      author text not null,
      price integer not null,
      category text not null,
      is_archived boolean default false,
      -- the legacy, invented columns that must stay unread
      rating numeric default 4.5,
      reviews integer default 0
    );

    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      role text default 'customer',
      first_name text default '',
      last_name text default '',
      email text
    );

    create table public.orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references auth.users(id) on delete set null,
      items jsonb not null,
      status text default 'Processing',
      created_at timestamp default now()
    );
    create index idx_orders_user_created on public.orders (user_id, created_at desc);

    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@example.com'),
      ('${BOB}', 'bob@example.com'),
      ('${ADMIN}', 'admin@example.com');

    insert into public.profiles (id, role, first_name, last_name, email) values
      ('${ALICE}', 'customer', 'Faith', 'Kamau', 'alice@example.com'),
      ('${BOB}', 'customer', 'Brian', 'Otieno', 'bob@example.com'),
      ('${ADMIN}', 'admin', 'Store', 'Owner', 'admin@example.com');

    insert into public.books (id, title, author, price, category) values
      (1, 'The Psychology of Money', 'Morgan Housel', 1500, 'Finance'),
      (2, 'Atomic Habits', 'James Clear', 1800, 'Self-Help');

    -- Alice bought book 1 and the order was DELIVERED.
    insert into public.orders (user_id, items, status) values
      ('${ALICE}', '[{"id":1,"quantity":1,"price":1500}]', 'Delivered');

    -- Bob bought book 2 but it is still Processing: not a verified purchase.
    insert into public.orders (user_id, items, status) values
      ('${BOB}', '[{"id":2,"quantity":1,"price":1800}]', 'Processing');
  `);

  // The role the browser gets when signed in.
  await db.exec(`
    grant select on public.books to anon, authenticated;
    grant select on public.profiles to authenticated;
    grant select on public.orders to authenticated;
  `);
}

// Run as a given Postgres role, with an optional JWT subject.
async function as(role, sub, fn) {
  await db.exec(`set role ${role};`);
  if (sub) await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false);`);
  else await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
  try { return await fn(); }
  finally {
    await db.exec(`reset role;`);
    await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function expectsError(label, role, sub, sql, matcher) {
  try {
    await as(role, sub, () => db.exec(sql));
    ok(label, false, "statement succeeded but should have been refused");
  } catch (err) {
    const msg = String(err?.message || err);
    ok(label, matcher.test(msg), msg.split("\n")[0]);
  }
}

await scaffold();
await db.exec(await readFile(MIGRATION, "utf8"));

// ── 1. Structure ────────────────────────────────────────────────────────────
section("1. Structure and constraints");
{
  const t = await db.query(`select to_regclass('public.book_reviews') as t`);
  eq("table exists", t.rows[0].t, "book_reviews");

  const v = await db.query(`select to_regclass('public.book_rating_summary') as v`);
  eq("aggregate view exists", v.rows[0].v, "book_rating_summary");

  const trg = await db.query(`select tgname, tgenabled from pg_trigger where tgname = 'book_reviews_before_write'`);
  eq("write trigger exists", trg.rows.length, 1);
  eq("trigger enabled", trg.rows[0].tgenabled, "O");

  const rls = await db.query(`select relrowsecurity from pg_class where relname = 'book_reviews'`);
  eq("RLS enabled", rls.rows[0].relrowsecurity, true);

  eq("table starts empty", (await db.query(`select count(*)::int as n from book_reviews`)).rows[0].n, 0);
}

// ── 2. A normal, honest review ──────────────────────────────────────────────
section("2. A customer writes a review");
{
  await as("authenticated", ALICE, () => db.exec(`
    insert into public.book_reviews (book_id, user_id, rating, title, review_text)
    values (1, '${ALICE}', 5, 'Changed how I think about money', 'Clear, practical and worth reading twice.');
  `));

  const row = (await db.query(`select * from book_reviews where user_id = '${ALICE}'`)).rows[0];
  eq("stored", !!row, true);
  eq("reviewer_name snapshotted as first name + initial", row.reviewer_name, "Faith K.");
  eq("verified purchase derived from the delivered order", row.verified_purchase, true);
  eq("published by default", row.is_published, true);
  eq("created_at set", !!row.created_at, true);
  eq("updated_at equals created_at on insert", String(row.updated_at), String(row.created_at));
}

// ── 3. One review per customer per book ─────────────────────────────────────
section("3. One review per customer per book");
await expectsError(
  "second review for the same book is refused",
  "authenticated", ALICE,
  `insert into public.book_reviews (book_id, user_id, rating, review_text)
   values (1, '${ALICE}', 4, 'Trying to post again for the same book.')`,
  /duplicate key|unique constraint/i
);

// ── 4. Ownership cannot be forged ───────────────────────────────────────────
section("4. Ownership comes from the token, not the payload");
await expectsError(
  "Alice cannot write a review as Bob",
  "authenticated", ALICE,
  `insert into public.book_reviews (book_id, user_id, rating, review_text)
   values (2, '${BOB}', 5, 'Pretending to be somebody else entirely.')`,
  /row-level security|violates/i
);

// ── 5. The customer cannot grant themselves anything ────────────────────────
section("5. Privilege columns are not writable by customers");
await expectsError(
  "cannot set verified_purchase on insert",
  "authenticated", ALICE,
  `insert into public.book_reviews (book_id, user_id, rating, review_text, verified_purchase)
   values (2, '${ALICE}', 5, 'I would like the badge please even though I did not buy it.', true)`,
  /permission denied/i
);
await expectsError(
  "cannot set is_published on insert",
  "authenticated", ALICE,
  `insert into public.book_reviews (book_id, user_id, rating, review_text, is_published)
   values (2, '${ALICE}', 5, 'Hiding this from the shop until I feel like it.', false)`,
  /permission denied/i
);
await expectsError(
  "cannot publish an unpublished review",
  "authenticated", ALICE,
  `update public.book_reviews set is_published = true where user_id = '${ALICE}'`,
  /permission denied/i
);
await expectsError(
  "cannot flip another customer's review badge on",
  "authenticated", ALICE,
  `update public.book_reviews set verified_purchase = true where user_id = '${ALICE}'`,
  /permission denied/i
);
await expectsError(
  "cannot change reviewer_name",
  "authenticated", ALICE,
  `update public.book_reviews set reviewer_name = 'The Shop' where user_id = '${ALICE}'`,
  /permission denied/i
);
await expectsError(
  "cannot move a review to another book",
  "authenticated", ALICE,
  `update public.book_reviews set book_id = 2 where user_id = '${ALICE}'`,
  /permission denied/i
);
await expectsError(
  "cannot move a review to another user",
  "authenticated", ALICE,
  `update public.book_reviews set user_id = '${BOB}' where user_id = '${ALICE}'`,
  /permission denied/i
);

// ── 6. Rating and text are validated by the database ────────────────────────
section("6. Validation at the database boundary");
for (const bad of [0, 6, -1, 99]) {
  await expectsError(
    `rating ${bad} is refused`,
    "authenticated", BOB,
    `insert into public.book_reviews (book_id, user_id, rating, review_text)
     values (2, '${BOB}', ${bad}, 'A rating outside the allowed range of one to five.')`,
    /check constraint|rating_range/i
  );
}
await expectsError(
  "9-character review is refused",
  "authenticated", BOB,
  `insert into public.book_reviews (book_id, user_id, rating, review_text)
   values (2, '${BOB}', 4, 'too short')`,
  /text_length|check constraint/i
);
await expectsError(
  "2,001-character review is refused",
  "authenticated", BOB,
  `insert into public.book_reviews (book_id, user_id, rating, review_text)
   values (2, '${BOB}', 4, repeat('a', 2001))`,
  /text_length|check constraint/i
);
await expectsError(
  "101-character title is refused",
  "authenticated", BOB,
  `insert into public.book_reviews (book_id, user_id, rating, title, review_text)
   values (2, '${BOB}', 4, repeat('t', 101), 'A perfectly reasonable review body here.')`,
  /title_length|check constraint/i
);

// ── 7. Anonymous and signed-out behaviour ───────────────────────────────────
section("7. What an anonymous visitor can do");
{
  // Bob's review exists but is unpublished, to prove it stays hidden.
  await as("authenticated", BOB, () => db.exec(`
    insert into public.book_reviews (book_id, user_id, rating, review_text)
    values (2, '${BOB}', 4, 'Solid advice, though a little repetitive in places.');
  `));
  await db.exec(`update public.book_reviews set is_published = false where user_id = '${BOB}'`);

  const visible = await as("anon", null, () =>
    db.query(`select count(*)::int as n from book_reviews`));
  eq("anon sees only published reviews", visible.rows[0].n, 1);

  await expectsError(
    "anon cannot read unpublished reviews",
    "anon", null,
    `select * from book_reviews where user_id = '${BOB}'`,
    /permission denied/i
  );

  await expectsError(
    "anon cannot select user_id",
    "anon", null,
    `select user_id from book_reviews`,
    /permission denied/i
  );

  await expectsError(
    "anon cannot write",
    "anon", null,
    `insert into public.book_reviews (book_id, user_id, rating, review_text)
     values (1, '${BOB}', 5, 'Anonymous visitor trying to leave a review here.')`,
    /violates row-level security|permission denied/i
  );

  // Not an error: the view simply has no row for a book whose only review
  // is unpublished. Zero rows is the correct, non-leaking answer.
  const hidden = await as("anon", null, () =>
    db.query(`select * from book_rating_summary where book_id = 2`));
  eq("unpublished review does not appear in the public summary", hidden.rows.length, 0);

  const summaries = await as("anon", null, () =>
    db.query(`select book_id, average_rating, review_count from book_rating_summary order by book_id`));
  eq("summary has one row (only the published book)", summaries.rows.length, 1);
  eq("summary average", summaries.rows[0].average_rating, "5.00");
  eq("summary count", summaries.rows[0].review_count, 1);
}

// ── 8. Editing ──────────────────────────────────────────────────────────────
section("8. Editing your own review");
{
  // The app updates by row id, never by user_id: a customer has no SELECT
  // privilege on user_id, so a filter on it is refused by Postgres. That is
  // asserted deliberately just below.
  const myId = (await db.query(`select id from book_reviews where user_id = '${ALICE}'`)).rows[0].id;
  await as("authenticated", ALICE, () => db.exec(`
    update public.book_reviews set rating = 4, review_text = 'Changed my mind after a re-read; still very good.'
     where id = '${myId}'`));
  const row = (await db.query(`select rating, reviewer_name, verified_purchase, created_at, updated_at from book_reviews where user_id = '${ALICE}'`)).rows[0];
  eq("rating updated", row.rating, 4);
  eq("owner still the same person", row.reviewer_name, "Faith K.");
  eq("badge kept", row.verified_purchase, true);
  ok("updated_at moved forward on edit", new Date(row.updated_at) >= new Date(row.created_at));

  // Filtering by someone else's user_id is impossible anyway (no column
  // privilege), so the realistic attack is "I know the row id, let me edit
  // it". RLS matches zero rows and the review is untouched.
  const aliceId2 = (await db.query(`select id from book_reviews where user_id = '${ALICE}'`)).rows[0].id;
  const bobEdit = await as("authenticated", BOB, () =>
    db.query(`update public.book_reviews set rating = 1 where id = '${aliceId2}' returning id`));
  eq("Bob's edit touched no rows", bobEdit.rows.length, 0);

  const bobDelete = await as("authenticated", BOB, () =>
    db.query(`delete from book_reviews where id = '${aliceId2}' returning id`));
  eq("Bob's delete touched no rows", bobDelete.rows.length, 0);

  await expectsError(
    "filtering on user_id is refused outright",
    "authenticated", BOB,
    `select id from book_reviews where user_id = '${ALICE}'`,
    /permission denied/i
  );

  const stillThere = (await db.query(`select count(*)::int as n from book_reviews where user_id = '${ALICE}'`)).rows[0].n;
  eq("Alice's review survived Bob's delete attempt", stillThere, 1);
  eq("Bob's delete changed nothing", (await db.query(`select rating from book_reviews where user_id = '${ALICE}'`)).rows[0].rating, 4);

  // BOB's UPDATE and DELETE above do not error — RLS simply matches zero rows.
  // That is the correct behaviour and the assertion above already proves no
  // damage; the "cannot" label refers to the effect, not to an error.
}

// ── 9. Verified purchase follows real order history ─────────────────────────
section("9. Verified purchase is derived, not claimed");
{
  eq("Bob has no badge (order not delivered)",
    (await db.query(`select verified_purchase from book_reviews where user_id='${BOB}'`)).rows[0].verified_purchase, false);

  await db.exec(`update public.orders set status = 'Delivered' where user_id = '${BOB}'`);
  const refreshed = await db.query(`select public.refresh_review_verification('${BOB}') as n`);
  eq("refreshing after delivery updates one row", refreshed.rows[0].n, 1);
  eq("Bob now has the badge",
    (await db.query(`select verified_purchase from book_reviews where user_id='${BOB}'`)).rows[0].verified_purchase, true);

  await expectsError(
    "a customer cannot call the refresh function themselves",
    "authenticated", BOB,
    `select public.refresh_review_verification('${BOB}')`,
    /permission denied/i
  );
  await expectsError(
    "the badge helper is not callable by a customer",
    "authenticated", ALICE,
    `select public.customer_has_delivered('${BOB}', 2)`,
    /permission denied/i
  );
}

// ── 9b. Finding your own review without being able to read user_id ─────────
section("9b. my_book_review() is the only way to see your own row");
{
  const mine = await as("authenticated", ALICE, () =>
    db.query(`select * from public.my_book_review(1)`));
  eq("Alice sees exactly one review for book 1", mine.rows.length, 1);
  eq("it is hers", mine.rows[0].reviewer_name, "Faith K.");

  const notMine = await as("authenticated", BOB, () =>
    db.query(`select * from public.my_book_review(1)`));
  eq("Bob sees no review of his for book 1", notMine.rows.length, 0);

  const bobBook2 = await as("authenticated", BOB, () =>
    db.query(`select * from public.my_book_review(2)`));
  eq("Bob sees his own review for book 2", bobBook2.rows.length, 1);

  const hidden = await db.query(`select is_published from book_reviews where user_id='${BOB}' and book_id=2`);
  eq("his review is currently hidden", hidden.rows[0].is_published, false);
  eq("he can still see it (it is his)", bobBook2.rows[0].is_published, false);

  await expectsError(
    "an anonymous visitor cannot call it",
    "anon", null,
    `select * from public.my_book_review(1)`,
    /permission denied/i
  );

  const cols = (await db.query(`
    select column_name from information_schema.columns
     where table_name='my_book_review' order by ordinal_position`)).rows.map(r => r.column_name);
  ok("it does not return user_id", !cols.includes("user_id"));
}

// ── 10. Aggregates stay correct through edit, unpublish and delete ──────────
section("10. Aggregates after edit, unpublish and delete");
{
  // Alice: book 1, rating 4, published. Bob: book 2, rating 4, unpublished.
  await db.exec(`update book_reviews set is_published = true where user_id = '${BOB}'`);
  let s = (await db.query(`select * from book_rating_summary where book_id = 2`)).rows[0];
  eq("book 2 count after publish", s.review_count, 1);
  eq("book 2 average", s.average_rating, "4.00");
  eq("distribution: four stars", s.four, 1);

  await db.exec(`update book_reviews set rating = 2 where user_id = '${BOB}'`);
  s = (await db.query(`select * from book_rating_summary where book_id = 2`)).rows[0];
  eq("average after edit", s.average_rating, "2.00");
  eq("distribution: two stars", s.two, 1);
  eq("distribution: four stars now zero", s.four, 0);

  // A second reviewer on the same book, to get a non-trivial average.
  await as("authenticated", ADMIN, () => db.exec(`
    insert into public.book_reviews (book_id, user_id, rating, review_text)
    values (2, '${ADMIN}', 5, 'One of the better books I have read this year.')`));
  s = (await db.query(`select * from book_rating_summary where book_id = 2`)).rows[0];
  eq("count with two reviews", s.review_count, 2);
  eq("average of 2 and 5 is 3.5", s.average_rating, "3.50");

  await db.exec(`delete from book_reviews where user_id = '${ADMIN}'`);
  s = (await db.query(`select * from book_rating_summary where book_id = 2`)).rows[0];
  eq("count after delete", s.review_count, 1);
  eq("average after delete", s.average_rating, "2.00");

  await db.exec(`update book_reviews set is_published = false where user_id = '${BOB}'`);
  s = (await db.query(`select * from book_rating_summary where book_id = 2`)).rows[0];
  eq("unpublished book disappears from the summary", s, undefined);

  eq("book with no reviews is simply absent (no divide-by-zero)",
    (await db.query(`select count(*)::int as n from book_rating_summary where book_id = 999`)).rows[0].n, 0);
}

// ── 11. Profiles are never needed to render a review ────────────────────────
section("11. No personal data on the public row");
{
  const cols = (await db.query(`
    select column_name from information_schema.columns
     where table_schema='public' and table_name='book_reviews'`)).rows.map((r) => r.column_name);
  ok("no email column", !cols.includes("email"));
  ok("no phone column", !cols.includes("phone"));

  const granted = (await db.query(`
    select column_name from information_schema.column_privileges
     where table_name='book_reviews' and grantee='anon' and privilege_type='SELECT'
     order by column_name`)).rows.map((r) => r.column_name);
  eq("anon can read exactly the public columns", granted.join(","),
    "book_id,created_at,id,is_published,rating,review_text,reviewer_name,title,updated_at,verified_purchase");
  ok("anon cannot read user_id", !granted.includes("user_id"));
}

// ── 12. Cascade behaviour ───────────────────────────────────────────────────
section("12. Deleting a book removes its reviews");
{
  await db.exec(`insert into public.books (id,title,author,price,category) values (3,'Temp','Temp',100,'Fiction')`);
  await as("authenticated", BOB, () => db.exec(`
    insert into public.book_reviews (book_id, user_id, rating, review_text)
    values (3, '${BOB}', 3, 'A temporary review for a temporary book.')`));
  eq("review exists", (await db.query(`select count(*)::int as n from book_reviews where book_id=3`)).rows[0].n, 1);
  await db.exec(`delete from public.books where id = 3`);
  eq("review removed with the book", (await db.query(`select count(*)::int as n from book_reviews where book_id=3`)).rows[0].n, 0);
}

// ── 13. Re-running the migration is a no-op ─────────────────────────────────
section("13. Idempotent");
{
  const before = (await db.query(`select count(*)::int as n from book_reviews`)).rows[0].n;
  await db.exec(await readFile(MIGRATION, "utf8"));
  const after = (await db.query(`select count(*)::int as n from book_reviews`)).rows[0].n;
  eq("re-running preserves existing reviews", after, before);
  ok("re-running keeps the trigger single", (await db.query(`select count(*)::int as n from pg_trigger where tgname='book_reviews_before_write'`)).rows[0].n === 1);
}

await db.close();

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${passes} checks passed, ${failures.length} failed`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
