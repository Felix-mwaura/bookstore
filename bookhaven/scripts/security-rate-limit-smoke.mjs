#!/usr/bin/env node
// Durable rate-limit test.
//
//   node scripts/security-rate-limit-smoke.mjs
//
// Two routes used to count requests in a module-level `Map`. On Vercel that is
// per instance, so the limit could be reset just by landing on a cold one.
// app/lib/rate-limit.js moves the counter to a store every instance can see.
//
// This test drives the helper with injected transports (a fake Upstash fetch
// and a fake Supabase RPC), so it exercises every branch — allowed, limited,
// misconfigured, missing table, transport failure — without a network, a
// Redis instance or a database. The route files are then checked for wiring.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  RATE_LIMIT_POLICY,
  checkRateLimit,
  rateLimitKey,
  rateLimitStoreConfigured,
  resetRateLimitState,
} from "../app/lib/rate-limit.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..", "app");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

const KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function configure({ upstash = false, serviceKey = false } = {}) {
  for (const key of KEYS) delete process.env[key];
  if (upstash) {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io/";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  }
  if (serviceKey) process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  resetRateLimitState();
}

/** A fetch that returns a canned Upstash pipeline response. */
function upstashFetch({ count, ttl, status = 200 }) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => [{ result: count }, { result: 1 }, { result: ttl }],
  });
}

function throwingFetch() {
  return async () => {
    throw new Error("ECONNREFUSED");
  };
}

/** A fake Supabase RPC transport. */
function fakeRpc(row, { error = null } = {}) {
  return async () => ({ data: error ? null : [row], error });
}

console.log("Policy matches the limits that were in the routes");
check("newsletter 5 / 10 min", RATE_LIMIT_POLICY.newsletter.limit === 5 && RATE_LIMIT_POLICY.newsletter.windowSeconds === 600);
check(
  "admin agent 20 / 10 min",
  RATE_LIMIT_POLICY["admin-agent"].limit === 20 && RATE_LIMIT_POLICY["admin-agent"].windowSeconds === 600
);
check("only the two scopes that used a Map", Object.keys(RATE_LIMIT_POLICY).length === 2);

console.log("\nKeys are pseudonyms, not identifiers");
const keyA = rateLimitKey("newsletter", "203.0.113.9");
check("stable for the same input", keyA === rateLimitKey("newsletter", "203.0.113.9"));
check("different scope -> different key", keyA !== rateLimitKey("admin-agent", "203.0.113.9"));
check("different client -> different key", keyA !== rateLimitKey("newsletter", "203.0.113.10"));
check("no raw IP in the stored key", !keyA.includes("203.0.113.9"), keyA);
check("namespaced", keyA.startsWith("bh:rl:newsletter:"));
check("fixed length digest", keyA.split(":")[3].length === 32);

console.log("\nUnconfigured: allow, warn once, say why");
configure();
check("not configured", rateLimitStoreConfigured() === false);
const none = await checkRateLimit({ scope: "newsletter", identifier: "203.0.113.9" });
check("allowed", none.limited === false);
check("reports unconfigured", none.configured === false && none.reason === "unconfigured");
check("reports no store", none.store === null);
const noneAgain = await checkRateLimit({ scope: "newsletter", identifier: "203.0.113.10" });
check("still allowed on a second call", noneAgain.limited === false);

console.log("\nUpstash: the counter is shared and the limit bites");
configure({ upstash: true });
check("configured", rateLimitStoreConfigured() === true);
const under = await checkRateLimit({ scope: "newsletter", identifier: "ip-1", fetchImpl: upstashFetch({ count: 5, ttl: 300 }) });
check("5th request allowed", under.limited === false && under.store === "upstash" && under.available === true);
const over = await checkRateLimit({ scope: "newsletter", identifier: "ip-1", fetchImpl: upstashFetch({ count: 6, ttl: 300 }) });
check("6th request blocked", over.limited === true);
check("retry-after comes from the key TTL", over.retryAfterSeconds === 300);
const noTtl = await checkRateLimit({ scope: "newsletter", identifier: "ip-1", fetchImpl: upstashFetch({ count: 9, ttl: -1 }) });
check("TTL -1 falls back to the window", noTtl.retryAfterSeconds === 600);
const agent20 = await checkRateLimit({ scope: "admin-agent", identifier: "admin-1", fetchImpl: upstashFetch({ count: 20, ttl: 100 }) });
check("agent allows its 20th turn", agent20.limited === false);
const agent21 = await checkRateLimit({ scope: "admin-agent", identifier: "admin-1", fetchImpl: upstashFetch({ count: 21, ttl: 100 }) });
check("agent blocks its 21st turn", agent21.limited === true);

console.log("\nUpstash failures are reported, never thrown");
const http500 = await checkRateLimit({ scope: "newsletter", identifier: "ip-2", fetchImpl: upstashFetch({ count: 1, ttl: 1, status: 500 }) });
check("5xx -> available:false, configured:true", http500.available === false && http500.configured === true);
check("5xx does not throw", http500.limited === false);
check("reason is unavailable", http500.reason === "unavailable");
const dead = await checkRateLimit({ scope: "newsletter", identifier: "ip-3", fetchImpl: throwingFetch() });
check("network error -> available:false", dead.available === false && dead.configured === true);
const cooling = await checkRateLimit({ scope: "newsletter", identifier: "ip-4", fetchImpl: upstashFetch({ count: 1, ttl: 1 }) });
check("cooldown avoids a second round trip", cooling.reason === "cooldown");
resetRateLimitState();

console.log("\nSupabase backend (the no-new-dependency fallback)");
configure({ serviceKey: true });
const allowedRow = await checkRateLimit({
  scope: "newsletter",
  identifier: "ip-5",
  rpc: fakeRpc({ allowed: true, retry_after: 0 }),
});
check("allowed row -> not limited", allowedRow.limited === false && allowedRow.store === "supabase");
const deniedRow = await checkRateLimit({
  scope: "newsletter",
  identifier: "ip-5",
  rpc: fakeRpc({ allowed: false, retry_after: 123 }),
});
check("denied row -> limited with its retry", deniedRow.limited === true && deniedRow.retryAfterSeconds === 123);

const missingFn = await checkRateLimit({
  scope: "newsletter",
  identifier: "ip-6",
  rpc: fakeRpc(null, { error: { code: "PGRST202", message: "Could not find the function" } }),
});
check("unapplied migration -> allowed", missingFn.limited === false);
check("unapplied migration -> treated as unconfigured", missingFn.configured === false && missingFn.reason === "missing");

resetRateLimitState(); // the previous case deliberately tripped the 60s cooldown
const noVerdict = await checkRateLimit({
  scope: "newsletter",
  identifier: "ip-7",
  rpc: async () => ({ data: [], error: null }),
});
check("empty result -> allowed, flagged missing", noVerdict.limited === false && noVerdict.reason === "missing");

resetRateLimitState();
const brokenStore = await checkRateLimit({
  scope: "newsletter",
  identifier: "ip-8",
  rpc: fakeRpc(null, { error: { code: "57014", message: "canceling statement" } }),
});
check("a real outage -> configured but unavailable", brokenStore.configured === true && brokenStore.available === false);

console.log("\nFail-open vs fail-closed is the caller's decision");
check("newsletter allows when the store is down", brokenStore.limited === false);
const agentRoute = readFileSync(join(app, "api", "admin", "agent", "route.js"), "utf8");
check(
  "agent refuses to spend when a configured store breaks",
  /!limit\.available\s*&&\s*limit\.configured/.test(agentRoute) && /status:\s*503/.test(agentRoute)
);

console.log("\nThe in-memory maps are gone");
for (const [name, file] of [
  ["newsletter", join(app, "api", "newsletter", "route.js")],
  ["admin agent", join(app, "api", "admin", "agent", "route.js")],
]) {
  const source = readFileSync(file, "utf8");
  check(`${name}: no Map counter`, !/new Map\(/.test(source));
  check(`${name}: no WINDOW_MS constant`, !/WINDOW_MS/.test(source));
  check(`${name}: uses the shared helper`, source.includes("checkRateLimit("));
  check(`${name}: sets Retry-After`, /"Retry-After"/.test(source));
}

console.log("\nThe migration grants what the app actually needs");
const migration = readFileSync(
  join(here, "..", "supabase", "migrations", "20261025130000_rate_limit_store.sql"),
  "utf8"
);
check("creates the counter table", /create table if not exists public\.rate_limits/.test(migration));
check("the function is SECURITY DEFINER", /security definer/.test(migration));
check("the function pins search_path", /set search_path = ''/.test(migration));
check("no end-user role may execute it", /revoke execute[\s\S]*?anon, authenticated/.test(migration));
// service_role inherits nothing: revoking the default PUBLIC grant takes
// EXECUTE away from it as well, and PostgREST then answers 42501. The live
// project shows set_order_status/place_order carrying this grant explicitly.
check("service_role can execute it", /grant execute[\s\S]*?to service_role/.test(migration));
check("rollback is documented", /Rollback:/.test(migration) && /drop function if exists/.test(migration));

console.log("\nM-Pesa keeps its own durable limiter");
const stk = readFileSync(join(app, "api", "mpesa", "stk", "route.js"), "utf8");
check("stk counts payment rows, not memory", /from\("mpesa_payments"\)/.test(stk) && !/new Map\(/.test(stk));
check("stk still limits per account", /\.eq\("user_id",\s*user\.id\)/.test(stk));
check("stk still limits per phone", /\.eq\("phone",\s*formattedPhone\)/.test(stk));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll rate-limit cases passed");
