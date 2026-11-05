import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { dbErrorResponse } from "../../../lib/api-error";

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

  if (error) {
    return dbErrorResponse({
      route: "GET /api/admin/activity",
      error,
      fallback: "Could not load the activity log.",
    });
  }
  return NextResponse.json({ log: data || [] });
}