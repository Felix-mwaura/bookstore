import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = "https://luniopceavtkljywukyi.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmlvcGNlYXZ0a2xqeXd1a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk1NTUsImV4cCI6MjA5NDc1NTU1NX0.zmZcxS2uxyon8Est9l3feYLuYy02hgcIpCNKAqKWtCE";

// createBrowserClient (from @supabase/ssr) instead of createClient
// (from @supabase/supabase-js) — this is what makes the browser client
// write the session into cookies (sb-<ref>-auth-token) instead of only
// localStorage, so middleware.js and admin/page.js's createServerClient
// (which read exclusively from cookies) can actually see the session.
// Same method surface (.auth, .from, etc.) — no other file needs to change.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);