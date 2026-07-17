import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_EMAIL = "mwaurafelix754@gmail.com";

/**
 * Server-side admin check for API routes.
 * Returns { user, adminClient } if authorized,
 * or returns a 403 NextResponse if not.
 *
 * Usage in any API route:
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, adminClient } = auth;
 */
export async function requireAdmin(request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized — no token provided" },
      { status: 401 }
    );
  }

  // Verify token with anon client
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await anonClient.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized — invalid or expired token" },
      { status: 401 }
    );
  }

  // Check email
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  // Check role in DB
  const { data: profile } = await anonClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden — insufficient role" },
      { status: 403 }
    );
  }

  // Return service role client for admin operations
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { user, adminClient };
}