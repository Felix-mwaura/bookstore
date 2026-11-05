// A rate limit that survives a serverless cold start.
//
// The newsletter and admin-assistant routes used to count requests in a
// module-level `Map`. On Vercel every instance has its own copy and instances
// come and go, so the limit was closer to a suggestion: an attacker hitting a
// warm instance five times and then landing on a fresh one starts again at
// zero. This module keeps the same numbers but moves the counter somewhere
// every instance can see.
//
// Two backends, no new dependency in either case:
//
//   1. Upstash Redis, when UPSTASH_REDIS_REST_URL and
//      UPSTASH_REDIS_REST_TOKEN are set. One REST round trip, three commands
//      in a pipeline (INCR / EXPIRE NX / TTL).
//   2. A Supabase table behind a SECURITY DEFINER function, using the
//      service-role client the rest of the server already has (migration
//      20261025130000_rate_limit_store.sql).
//
// Upstash is preferred when both are present because it keeps the counter off
// the database that serves the shop.
//
// Failing open vs failing closed is decided by the caller, because the right
// answer differs by endpoint: a newsletter sign-up should never be blocked
// because the counter store is unreachable, while an LLM turn costs money and
// is worth refusing. The result therefore reports *why* it could not enforce:
//
//   { limited, retryAfterSeconds, store, configured, available, reason }
//
//   configured: false → nobody has set this up yet. The caller should allow
//                       the request (nothing was ever enforced before) and
//                       the warning names the fix.
//   configured: true, available: false → a store we depend on just failed.
//                       The caller decides; see each route.
//
// Keys are hashed before they leave the process. An IP address and a phone
// number are personal data (Kenya DPA 2019, GDPR art. 4), and a counter only
// needs a stable pseudonym, not the address itself.

import { createHash } from "node:crypto";

// The Supabase client is imported lazily, only when that backend is used: it
// pulls in the whole Supabase SDK, and the Upstash path does not need it.

/** The limits, in one place. M-Pesa's own limits live in request-limits.js
 *  because they are enforced by counting real payment rows (see the note
 *  there) rather than by this store. */
export const RATE_LIMIT_POLICY = {
  // 5 sign-ups per connection per 10 minutes.
  newsletter: { limit: 5, windowSeconds: 10 * 60 },
  // 20 assistant turns per admin per 10 minutes — each turn is a paid call.
  "admin-agent": { limit: 20, windowSeconds: 10 * 60 },
};

const KEY_PREFIX = "bh:rl";
const TIMEOUT_MS = 1500;
// When the store is unreachable, stop asking it on every request. This is not
// a rate limiter (it holds no per-client state); it only keeps a dead store
// from adding a timeout to every request for a minute.
let lastFailureAt = 0;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const warned = new Set();

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function rateLimitStoreConfigured() {
  return Boolean(upstashConfig() || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** A stable, non-reversible pseudonym for an identifier we must not store. */
export function rateLimitKey(scope, identifier) {
  const digest = createHash("sha256").update(String(identifier), "utf8").digest("hex");
  return `${KEY_PREFIX}:${scope}:${digest.slice(0, 32)}`;
}

function warnOnce(id, message) {
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(message);
}

function allow(extra) {
  return { limited: false, retryAfterSeconds: 0, ...extra };
}

async function checkUpstash({ id, limit, windowSeconds, config, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", id],
        ["EXPIRE", id, windowSeconds, "NX"],
        ["TTL", id],
      ]),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash returned ${res.status}`);

    const payload = await res.json();
    const count = Number(payload?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error("Upstash returned no counter");
    const ttl = Number(payload?.[2]?.result);

    const limited = count > limit;
    return {
      limited,
      retryAfterSeconds: limited ? (Number.isFinite(ttl) && ttl > 0 ? ttl : windowSeconds) : 0,
      store: "upstash",
      configured: true,
      available: true,
      reason: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The default transport for the Supabase backend. */
async function defaultRpc(name, args) {
  const { serviceClient } = await import("./server.js");
  return serviceClient().rpc(name, args);
}

async function checkSupabase({ id, limit, windowSeconds, rpc }) {
  const { data, error } = await rpc("check_rate_limit", {
    p_key: id,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") {
    const bad = new Error("check_rate_limit returned no verdict");
    bad.missing = true;
    throw bad;
  }

  return {
    limited: row.allowed === false,
    retryAfterSeconds: Number(row.retry_after) > 0 ? Number(row.retry_after) : 0,
    store: "supabase",
    configured: true,
    available: true,
    reason: null,
  };
}

/**
 * Count one attempt for `identifier` in `scope` and report whether it is over
 * the limit. Never throws: a broken store is reported, not raised.
 *
 * @param {{
 *   scope: keyof typeof RATE_LIMIT_POLICY,
 *   identifier: string,
 *   fetchImpl?: typeof fetch,   // tests only
 *   rpc?: (name: string, args: object) => Promise<{ data: unknown, error: unknown }>, // tests only
 * }} input
 */
export async function checkRateLimit({ scope, identifier, fetchImpl = fetch, rpc = defaultRpc }) {
  const policy = RATE_LIMIT_POLICY[scope];
  if (!policy) throw new Error(`Unknown rate-limit scope: ${scope}`);

  const upstash = upstashConfig();
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!upstash && !hasServiceKey) {
    warnOnce(
      "unconfigured",
      "Rate limiting is not configured (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, " +
        "or SUPABASE_SERVICE_ROLE_KEY and apply 20261025130000_rate_limit_store.sql). " +
        "Requests are being allowed without a shared counter."
    );
    return allow({ store: null, configured: false, available: false, reason: "unconfigured" });
  }

  if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return allow({ store: upstash ? "upstash" : "supabase", configured: true, available: false, reason: "cooldown" });
  }

  const id = rateLimitKey(scope, identifier);
  const args = { id, limit: policy.limit, windowSeconds: policy.windowSeconds };

  try {
    return upstash
      ? await checkUpstash({ ...args, config: upstash, fetchImpl })
      : await checkSupabase({ ...args, rpc });
  } catch (error) {
    lastFailureAt = Date.now();

    // A configured Supabase store whose table or function does not exist yet
    // is a setup step that has not been run, not an outage. Treat it like
    // "not configured" so endpoints keep working and the log says what to do.
    const missing =
      error?.missing ||
      error?.code === "42883" || // undefined_function
      error?.code === "42P01" || // undefined_table
      error?.code === "PGRST202"; // schema cache: no such function

    if (missing) {
      warnOnce(
        "missing",
        "Rate-limit store is configured but missing: apply supabase/migrations/20261025130000_rate_limit_store.sql. " +
          "Requests are being allowed without a shared counter until then."
      );
      return allow({ store: "supabase", configured: false, available: false, reason: "missing" });
    }

    console.error("rate-limit store failed:", error?.message || error);
    return allow({
      store: upstash ? "upstash" : "supabase",
      configured: true,
      available: false,
      reason: "unavailable",
    });
  }
}

/** Test hook: forget the failure cooldown and the one-time warnings. */
export function resetRateLimitState() {
  lastFailureAt = 0;
  warned.clear();
}
