#!/usr/bin/env node
// Browser-module safety test.
//
//   node scripts/browser-modules-smoke.mjs
//
// Two configuration modules guard themselves with a throw so a production
// deploy cannot silently advertise the wrong host or talk to no database:
//
//   app/lib/site.js             -> throws when no site URL could be resolved
//   app/lib/supabase-config.js  -> throws when no Supabase project is set
//
// Both are also imported by client components (they carry STORE_CONTACT, the
// price helpers and the browser Supabase client), so both are evaluated in
// the browser. And in a browser bundle only NEXT_PUBLIC_* variables exist:
// VERCEL_URL and VERCEL_ENV are simply not there. So a guard written as
// "production and not a preview" is TRUE in every browser and threw at import
// on every preview deployment — the page never rendered.
//
// The fix is that the throw is a server-side guard; the browser falls back to
// its own origin (site) or the reserved placeholder (Supabase). This test
// pins both halves down: the browser must never throw, and the server must
// still refuse to start misconfigured.
//
// Each case re-imports the module through a cache-busting query string, so
// every import is a fresh evaluation with the environment set for that case.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const siteLib = pathToFileURL(join(here, "..", "app", "lib", "site.js")).href;
const supabaseLib = pathToFileURL(join(here, "..", "app", "lib", "supabase-config.js")).href;

let failures = 0;
let counter = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

const ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NODE_ENV",
];

/** Run `fn` with exactly `env` set, a browser present or not, then restore. */
async function withEnvironment({ env = {}, browser = false, origin = "https://bookstore-preview.vercel.app" }, fn) {
  const saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  const savedWindow = globalThis.window;
  const savedError = console.error;

  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  if (browser) globalThis.window = { location: { origin } };
  else delete globalThis.window;
  // The modules warn loudly when they fall back; that is expected here.
  console.error = () => {};

  try {
    return await fn();
  } finally {
    console.error = savedError;
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

/** Import a fresh copy of a module, reporting a throw instead of escaping. */
async function importFresh(specifier) {
  counter += 1;
  try {
    // Named `loaded`, not `module`: Next's lint rule (rightly) forbids
    // reassigning the CommonJS `module` binding, and this file is linted
    // with the app.
    const loaded = await import(`${specifier}?case=${counter}`);
    return { loaded, error: null };
  } catch (error) {
    return { loaded: null, error };
  }
}

console.log("app/lib/site.js — the browser must never throw");
{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production" }, browser: true },
    () => importFresh(siteLib)
  );
  check("imports without throwing on a preview with no variables", error === null, error?.message);
  check("falls back to the page's own origin", loaded?.SITE_URL === "https://bookstore-preview.vercel.app", loaded?.SITE_URL);
  check("and builds absolute URLs from it", loaded?.absoluteUrl("/books") === "https://bookstore-preview.vercel.app/books", loaded?.absoluteUrl?.("/books"));
}

{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://bookhaven.co.ke/" }, browser: true },
    () => importFresh(siteLib)
  );
  check("a build with the variable set still wins", error === null && loaded.SITE_URL === "https://bookhaven.co.ke", loaded?.SITE_URL);
}

console.log("\napp/lib/site.js — the server must still refuse to start");
{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production" }, browser: false },
    () => importFresh(siteLib)
  );
  check("a production build with no host throws", Boolean(error));
  check(
    "and says what is missing",
    /NEXT_PUBLIC_SITE_URL is not set/.test(error?.message || ""),
    error?.message
  );
  check("nothing is exported when it throws", loaded === null);
}

{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production", VERCEL_ENV: "preview" }, browser: false },
    () => importFresh(siteLib)
  );
  check("a preview build on the server is allowed through", error === null, error?.message);
  check("with an empty site URL rather than a wrong one", loaded?.SITE_URL === "", loaded?.SITE_URL);
}

{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production", VERCEL_URL: "bookstore-abc.vercel.app" }, browser: false },
    () => importFresh(siteLib)
  );
  check("a Vercel host is used when there is one", error === null && loaded.SITE_URL === "https://bookstore-abc.vercel.app", loaded?.SITE_URL);
}

{
  const { loaded, error } = await withEnvironment({ env: { NODE_ENV: "development" }, browser: false }, () =>
    importFresh(siteLib)
  );
  check("a local run talks to localhost", error === null && loaded.SITE_URL === "http://localhost:3000", loaded?.SITE_URL);
}

console.log("\napp/lib/supabase-config.js — the browser must never throw");
{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production" }, browser: true },
    () => importFresh(supabaseLib)
  );
  check("imports without throwing on a preview with no variables", error === null, error?.message);
  check("falls back to the reserved placeholder", loaded?.SUPABASE_URL === "https://unconfigured-preview.invalid", loaded?.SUPABASE_URL);
  check("and reports itself as a placeholder", loaded?.SUPABASE_IS_PLACEHOLDER === true);
  check("the placeholder cannot resolve", /\.invalid$/.test(loaded?.SUPABASE_URL || ""));
  check("the error is still reported, as data", typeof loaded?.SUPABASE_CONFIG_ERROR === "string");
}

{
  const { loaded, error } = await withEnvironment(
    {
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      browser: true,
    },
    () => importFresh(supabaseLib)
  );
  check("a configured build uses the real project", error === null && loaded.SUPABASE_URL === "https://project.supabase.co");
  check("and is not a placeholder", loaded?.SUPABASE_IS_PLACEHOLDER === false);
}

console.log("\napp/lib/supabase-config.js — the server must still refuse to start");
{
  const { loaded, error } = await withEnvironment({ env: { NODE_ENV: "production" }, browser: false }, () =>
    importFresh(supabaseLib)
  );
  check("a production build with no project throws", Boolean(error));
  check("and names both variables", /NEXT_PUBLIC_SUPABASE_URL/.test(error?.message || "") && /ANON_KEY/.test(error?.message || ""), error?.message);
  check("nothing is exported when it throws", loaded === null);
}

{
  const { loaded, error } = await withEnvironment(
    { env: { NODE_ENV: "production", VERCEL_ENV: "preview" }, browser: false },
    () => importFresh(supabaseLib)
  );
  check("a preview on the server gets the placeholder", error === null && loaded.SUPABASE_IS_PLACEHOLDER === true);
}

// ─────────────────────────────────────────────────────────────── static sweep

console.log("\nThe rule, for every module a client component imports");
const app = join(here, "..", "app");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = walk(app);
const clientFiles = files.filter((file) => /^\s*["']use client["']/m.test(readFileSync(file, "utf8")));

// Direct lib imports of every client component, followed one level deeper
// (supabase.js -> supabase-config.js is exactly the edge that mattered).
const libModules = new Set();
for (const file of clientFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/from\s+"(\.\.?\/[^"]*lib\/[^"]+)"/g)) {
    const resolved = join(dirname(file), `${match[1]}.js`);
    libModules.add(resolved);
    const nested = readFileSync(resolved, "utf8");
    for (const inner of nested.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)) {
      const innerPath = join(dirname(resolved), `${inner[1]}.js`);
      if (files.includes(innerPath)) libModules.add(innerPath);
    }
  }
}

const reachable = [...libModules].filter((file) => files.includes(file));
check("client components reach lib modules at all", reachable.length > 0, `${reachable.length} found`);

const unguarded = [];
for (const file of reachable) {
  const source = readFileSync(file, "utf8");
  // A top-level throw is one that is not indented inside a function body.
  const topLevelThrow = /^throw new Error\(/m.test(source);
  if (!topLevelThrow) continue;
  const guarded = /typeof window !== "undefined"/.test(source);
  if (!guarded) unguarded.push(file.slice(app.length + 1));
}
check(
  "no module-level throw reaches the browser unguarded",
  unguarded.length === 0,
  unguarded.join(", ")
);

const site = readFileSync(join(app, "lib", "site.js"), "utf8");
const supabase = readFileSync(join(app, "lib", "supabase-config.js"), "utf8");
check("site.js checks for a browser before throwing", /!SITE_URL && !isBrowser/.test(site));
check("supabase-config.js checks for a browser before throwing", /!isBrowser/.test(supabase));
check(
  "and both say why, so the next person does not remove the guard",
  /browser/i.test(site.slice(site.indexOf("Server-only, on purpose"))) &&
    /browser/i.test(supabase.slice(supabase.indexOf("lib/supabase.js is imported by client components")))
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll browser-module cases passed");
