import { NextResponse } from "next/server";
import { serviceClient } from "./server";

/**
 * Server-side admin check for API routes.
 *
 * Authorization is decided by ONE thing: profiles.role === "admin", read
 * server-side with the service-role client, keyed by the user id that the
 * Auth server itself just verified from the bearer token.
 *
 * ADMIN_EMAIL is NOT an authorization gate (that made promoted admins
 * impossible). It is optional and only marks the "owner" account, which
 * cannot be demoted, so the store can never be locked out.
 *
 * Returns { user, adminClient } on success, or a NextResponse:
 *   401 = not authenticated, 403 = authenticated but not admin,
 *   500 = server misconfiguration.
 */
export async function requireAdmin(request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("requireAdmin: SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let adminClient;
  try {
    adminClient = serviceClient();
  } catch (err) {
    console.error("requireAdmin:", err.message);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Verify the token with the Auth server
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json(
      { error: "Session expired or invalid — please sign in again" },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("requireAdmin: profile lookup failed:", profileError.message);
    return NextResponse.json({ error: "Could not verify your permissions" }, { status: 500 });
  }

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden — administrator access required" },
      { status: 403 }
    );
  }

  return { user, adminClient };
}

// True if this email is the configured owner account (optional env var).
export function isOwnerEmail(email) {
  const owner = process.env.ADMIN_EMAIL;
  return !!owner && !!email && email.toLowerCase() === owner.toLowerCase();
}
