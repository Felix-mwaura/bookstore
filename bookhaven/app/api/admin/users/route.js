import { NextResponse } from "next/server";
import { requireAdmin, isOwnerEmail } from "../../../lib/admin-auth";
import { dbErrorResponse } from "../../../lib/api-error";
import { readJsonObject, SMALL_BODY } from "../../../lib/request-guard";

// GET /api/admin/users — full user list including real emails.
// This is the expensive call (auth.admin.listUsers()) that used to run
// unconditionally on every admin page load. Now it only runs when the
// client actually asks for it (Users/Customers tab opened).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;

  const [{ data: profilesData }, { data: authData, error: authError }] = await Promise.all([
    adminClient.from("profiles").select("*").order("created_at", { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (authError) {
    return dbErrorResponse({
      route: "GET /api/admin/users (auth)",
      error: authError,
      fallback: "Could not load the account list.",
    });
  }

  const authUsers = authData?.users || [];
  const users = (profilesData || []).map(p => {
    const au = authUsers.find(u => u.id === p.id);
    const meta = au?.user_metadata || {};
    return {
      id: p.id,
      role: p.role,
      created_at: au?.created_at || p.created_at,
      email: au?.email || "",
      first_name: meta.first_name || p.first_name || "",
      last_name: meta.last_name || p.last_name || "",
      phone: meta.phone || p.phone || "",
    };
  });

  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}

// PATCH /api/admin/users — change a user's role (admin only).
// Authorization: requireAdmin() already verified, server-side, that the
// CALLER has role=admin. The write itself uses the service role, which the
// protect_profile_role DB trigger allows — ordinary customers can't reach
// this path, and the trigger blocks them from changing roles directly.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const parsed = await readJsonObject(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  const { id, role } = body;

  if (!id || !["admin", "customer"].includes(role)) {
    return NextResponse.json({ error: "A valid user id and role (admin or customer) are required" }, { status: 400 });
  }
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const { data: target, error: targetError } = await adminClient.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (targetError) {
    return dbErrorResponse({
      route: "PATCH /api/admin/users (lookup)",
      error: targetError,
      fallback: "Could not load that user.",
    });
  }
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === role) return NextResponse.json({ profile: target });

  if (role === "customer") {
    // The owner account can never be demoted, and the store must always
    // keep at least one administrator — either would be a lock-out.
    const { data: authTarget } = await adminClient.auth.admin.getUserById(id);
    if (isOwnerEmail(authTarget?.user?.email)) {
      return NextResponse.json({ error: "The owner account cannot be demoted" }, { status: 409 });
    }
    const { count } = await adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last administrator" }, { status: 409 });
    }
  }

  const { data, error } = await adminClient.from("profiles").update({ role }).eq("id", id).select().single();
  if (error) {
    return dbErrorResponse({
      route: "PATCH /api/admin/users",
      error,
      fallback: "Could not change that user's role.",
      context: { targetId: id, role },
    });
  }

  const { error: logError } = await adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action: "user_role_changed", target_type: "user", target_id: id,
    details: { from: target.role, newRole: role },
  });
  if (logError) console.error("activity log failed:", logError.message);

  return NextResponse.json({ profile: data });
}