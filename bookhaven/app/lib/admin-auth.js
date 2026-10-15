import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Server-side admin check for API routes.
 *
 * Authorization is decided by ONE thing: profiles.role === "admin", read
 * server-side with the service-role client, keyed by the user id that the
 * Auth server itself just verified from the bearer token.
 *
 * Previous bug: the role lookup used an anon client with no user token, so
 * it ran as the anonymous role, RLS (`auth.uid() = id`) returned no row, and
 * every admin was rejected with "insufficient role". The service-role key
 * never leaves the server, and the id being looked up cannot be forged
 * because it comes from the verified token, not from the request body.
 *
 * ADMIN_EMAIL is no longer an authorization gate (that made promoted admins
 * impossible). It is optional and only marks the "owner" account, which
 * cannot be demoted, so the store can never be locked out.
 *
 * Returns { user, adminClient } on success, or a NextResponse:
 *   401 = not authenticated, 403 = authenticated but not admin,
 *   500 = server misconfiguration.
 */
export async function requireAdmin(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
    console.error("requireAdmin: missing env vars:", missing.join(", "));
    return NextResponse.json({ error: `Server misconfigured: missing ${missing.join(", ")}` }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verify the token with the Auth server
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Session expired or invalid — please sign in again" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profileError) {
    console.error("requireAdmin: profile lookup failed:", profileError.message);
    return NextResponse.json({ error: "Could not verify your permissions" }, { status: 500 });
  }

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — administrator access required" }, { status: 403 });
  }

  return { user, adminClient };
}

// True if this email is the configured owner account (optional env var).
export function isOwnerEmail(email) {
  const owner = process.env.ADMIN_EMAIL;
  return !!owner && !!email && email.toLowerCase() === owner.toLowerCase();
}