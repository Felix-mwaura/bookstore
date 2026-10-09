import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

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

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

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
// This endpoint did not exist before, so every role-change click in the
// Users tab was silently calling a route with no PATCH handler and
// failing — the UI just never reflected it because the response was
// never checked.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;
  const { id, role } = await request.json();

  if (!id || !["admin", "customer"].includes(role)) {
    return NextResponse.json({ error: "Invalid id or role" }, { status: 400 });
  }

  // Never rely on the browser to enforce this — a direct API call could
  // otherwise demote the caller themselves.
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  // Refuse to leave the store with zero administrators.
  if (role === "customer") {
    const { count } = await adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last administrator" }, { status: 409 });
    }
  }

  const { data, error } = await adminClient.from("profiles").update({ role }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from("admin_activity_log").insert({
    admin_id: user.id, admin_email: user.email,
    action: "user_role_changed", target_type: "user", target_id: id,
    details: { newRole: role },
  });

  return NextResponse.json({ profile: data });
}