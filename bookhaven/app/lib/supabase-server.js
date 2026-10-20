import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";

// Read-only Supabase client for server components.
//
// It carries the visitor's own cookies, so every query runs as that user and
// Row Level Security decides what comes back. Nothing here can see another
// customer's order, even if the id is known — the policy filters the rows
// before the query returns.
//
// Cookie writes are intentionally dropped: a server component is not allowed
// to set cookies, and refreshing the session there is the proxy's job.

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
}

/** The signed-in user, or null. Validated with the Auth server, not decoded. */
export async function getServerUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { supabase, user: null };
  return { supabase, user: data?.user ?? null };
}
