// Runs the two grant/plumbing migrations against a real Postgres (PGlite) with
// Supabase's stock grants in place, then checks what a browser role is left
// holding.
//
//   node scripts/grants-sql-test.mjs
//
// What this proves: the migration removes TRUNCATE/TRIGGER/REFERENCES from
// anon+authenticated everywhere, removes every write from anon, hides
// customer data from anon, keeps the catalogue readable, leaves the API's own
// writes working, and applies to tables created later. What it cannot prove:
// the live project actually looks like this scaffold — see the VERIFY query
// at the bottom of 20261025130000_grant_hygiene.sql.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.log("SKIP — grants (SQL): @electric-sql/pglite is not installed.");
  console.log("       npm install --no-save @electric-sql/pglite && node scripts/grants-sql-test.mjs");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "supabase", "migrations");
const grants = await readFile(join(dir, "20261025130000_grant_hygiene.sql"), "utf8");
const searchPath = await readFile(join(dir, "20261025140000_delivery_rate_search_path.sql"), "utf8");

const db = new PGlite();
let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Supabase-shaped scaffold ──────────────────────────────────────────────
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;

  create table public.books (id bigint primary key, title text);
  create table public.categories (id bigint primary key, slug text);
  create table public.book_reviews (id bigint primary key, rating integer);
  create table public.book_rating_summary (id bigint primary key, average numeric);
  create table public.orders (id bigint primary key, user_id uuid);
  create table public.profiles (id uuid primary key, role text);
  create table public.addresses (id bigint primary key, user_id uuid);
  create table public.wishlists (id bigint primary key, user_id uuid);
  create table public.admin_activity_log (id bigint primary key, action text);
  create table public.mpesa_payments (id bigint primary key);
  create table public.mpesa_callbacks (id bigint primary key);
  create table public.email_outbox (id bigint primary key);
  create table public.stock_movements (id bigint primary key);

  -- Supabase grants ALL on public tables to both browser roles by default.
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
`);

// The function this migration is about, in its pre-audit shape.
await db.exec(`
  create function public.delivery_rate() returns integer language sql immutable as $fn$ select 20; $fn$;
  grant execute on function public.delivery_rate() to service_role;
`);

await db.exec(grants);
await db.exec(searchPath);

console.log("\nGrant hygiene, against a real Postgres\n");

const grantsOf = async (role) =>
  (
    await db.query(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public' and grantee = $1`,
      [role]
    )
  ).rows;

const anon = await grantsOf("anon");
const auth = await grantsOf("authenticated");

const has = (rows, table, priv) =>
  rows.some((r) => r.table_name === table && r.privilege_type === priv);

// ── 1. the privileges PostgREST cannot use ────────────────────────────────
for (const priv of ["TRUNCATE", "TRIGGER", "REFERENCES"]) {
  ok(`anon has no ${priv}`, !anon.some((r) => r.privilege_type === priv));
  ok(`authenticated has no ${priv}`, !auth.some((r) => r.privilege_type === priv));
}

// ── 2. anon cannot write anything ─────────────────────────────────────────
for (const priv of ["INSERT", "UPDATE", "DELETE"]) {
  ok(`anon has no ${priv} anywhere`, !anon.some((r) => r.privilege_type === priv));
}

// ── 3. anon cannot read customer data ─────────────────────────────────────
for (const table of [
  "orders",
  "profiles",
  "addresses",
  "wishlists",
  "admin_activity_log",
  "mpesa_payments",
  "mpesa_callbacks",
  "email_outbox",
  "stock_movements",
]) {
  ok(`anon cannot read ${table}`, !has(anon, table, "SELECT"));
}

// ── 4. the shopfront still works ──────────────────────────────────────────
for (const table of ["books", "book_reviews", "book_rating_summary", "categories"]) {
  ok(`anon can still read ${table}`, has(anon, table, "SELECT"));
}

// ── 5. the API routes' own writes still work ──────────────────────────────
ok("authenticated can still write addresses", has(auth, "addresses", "INSERT") && has(auth, "addresses", "UPDATE") && has(auth, "addresses", "DELETE"));
ok("authenticated can still write wishlists", has(auth, "wishlists", "INSERT") && has(auth, "wishlists", "DELETE"));
ok("authenticated can still read profiles", has(auth, "profiles", "SELECT"));

// ── 6. the admin log is read-only for humans ──────────────────────────────
ok("authenticated cannot write the admin log", !has(auth, "admin_activity_log", "INSERT") && !has(auth, "admin_activity_log", "UPDATE") && !has(auth, "admin_activity_log", "DELETE"));
ok("authenticated can still read the admin log (under RLS)", has(auth, "admin_activity_log", "SELECT"));

// ── 7. tables created later inherit the same rules ────────────────────────
await db.exec(`create table public.a_future_table (id bigint primary key);`);
const future = await grantsOf("anon");
ok("a new table is not writable by anon", !has(future, "a_future_table", "INSERT"));
ok("a new table is not truncatable by anon", !has(future, "a_future_table", "TRUNCATE"));
const futureAuth = await grantsOf("authenticated");
ok("a new table is not truncatable by authenticated", !has(futureAuth, "a_future_table", "TRUNCATE"));

// ── 8. delivery_rate() is pinned and unchanged ────────────────────────────
const fn = (
  await db.query(
    `select proconfig, pg_get_function_result(p.oid) as result
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'delivery_rate'`
  )
).rows[0];
ok(
  "delivery_rate() has a pinned search_path",
  (fn?.proconfig || []).some((c) => c.startsWith("search_path=")),
  JSON.stringify(fn?.proconfig)
);
ok("delivery_rate() still returns integer", fn?.result === "integer", fn?.result);

const rate = (await db.query(`select public.delivery_rate() as rate`)).rows[0];
ok("delivery_rate() still returns 20", Number(rate?.rate) === 20, String(rate?.rate));

const callable = (
  await db.query(
    `select has_function_privilege('anon', p.oid, 'execute') as anon_exec
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'delivery_rate'`
  )
).rows[0];
ok("a browser role still cannot call it", callable?.anon_exec === false);

await db.close();

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed (real Postgres, PGlite)`);
process.exit(failed === 0 ? 0 : 1);
