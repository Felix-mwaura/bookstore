import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";

// createBrowserClient (from @supabase/ssr) instead of createClient
// (from @supabase/supabase-js) — this is what makes the browser client
// write the session into cookies (sb-<ref>-auth-token) instead of only
// localStorage, so proxy.js and the server components (which read
// exclusively from cookies) can actually see the session.
// Same method surface (.auth, .from, etc.) — no other file needs to change.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
