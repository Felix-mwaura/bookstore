import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";

// Server-only Supabase helpers.
//
// Nothing in this file may be imported by a client component: it reads
// SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security.

/** Service-role client (bypasses RLS). Never send this to the browser. */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Anon client that carries the CALLER'S JWT on every request.
 *
 * supabase.auth.getUser(token) only *verifies* a token — it does not attach
 * it to later .from() calls. Without this header every query would run as
 * the `anon` Postgres role, so `auth.uid() = user_id` RLS policies silently
 * match nothing.
 */
export function clientForToken(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Bearer token from an Authorization header, or null. */
export function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Verified user for this request, or null. Never trusts the body. */
export async function userFromRequest(request) {
  const token = bearerToken(request);
  if (!token) return null;
  const client = clientForToken(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token };
}
