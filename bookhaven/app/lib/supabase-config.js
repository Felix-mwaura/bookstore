// Single source of truth for the *public* Supabase configuration.
//
// The URL and anon key are public by design (they ship to every browser), but
// they are still configuration: they decide which project the shop talks to.
// Hard-coded production values used to sit here as fallbacks, which meant a
// checkout built from a laptop without a .env.local silently hit the live
// database — reads, carts, orders and all — instead of failing where the
// mistake would be obvious.
//
// There is no fallback any more. Production throws at import time with a
// message naming the variables, so a misconfigured deploy fails at build or
// first render rather than at the first customer. Development is allowed to
// run unconfigured because pure unit tests import modules that reference these
// values without ever performing a request.
//
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, M-Pesa credentials) are
// NEVER read here — they live only in process.env on the server.

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const SUPABASE_URL = rawUrl.replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = rawKey;

export const SUPABASE_CONFIG_ERROR =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? null
    : "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).";

if (SUPABASE_CONFIG_ERROR && process.env.NODE_ENV === "production") {
  // Deliberately a throw, not a console.warn: a warning scrolls past in a
  // serverless log, and the page that follows would render an empty shop.
  throw new Error(SUPABASE_CONFIG_ERROR);
}
