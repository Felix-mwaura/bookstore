import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";

// GET /api/admin/users — fetch ALL users with emails (admin only)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;

  // Fetch all auth users (real emails via service role)
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();

  // Fetch all profiles
  const { data: profiles } = await adminClient.from("profiles").select("*");

  const merged = (profiles || []).map(p => {
    const au = (authUsers || []).find(u => u.id === p.id);
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

  return NextResponse.json({ users: merged });
}

// PATCH /api/admin/users — update user role (admin only)
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { id, role } = await request.json();

  if (!id || !["admin","customer"].includes(role)) {
    return NextResponse.json({ error: "Invalid id or role" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}