import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

// GET /api/admin/activity — recent admin actions (admin only)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { data, error } = await adminClient
    .from("admin_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data || [] });
}