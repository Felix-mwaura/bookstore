import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";

// GET /api/admin/metrics?from=ISO&to=ISO
//
// All arithmetic happens in admin_dashboard_metrics() so the numbers on the
// dashboard cannot drift from the ones in SQL. This route only validates the
// range and forwards it.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const { searchParams } = new URL(request.url);

  const to = validDate(searchParams.get("to")) || new Date();
  const from =
    validDate(searchParams.get("from")) ||
    new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (from >= to) {
    return NextResponse.json(
      { error: "The start of the range must be before the end" },
      { status: 400 }
    );
  }

  // Guard against a typo turning into a full-table scan of everything.
  const spanDays = (to - from) / 86400000;
  if (spanDays > 400) {
    return NextResponse.json(
      { error: "Please choose a range of 400 days or fewer" },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.rpc("admin_dashboard_metrics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) {
    console.error("GET /api/admin/metrics:", error.message);
    return NextResponse.json(
      { error: "Could not load dashboard metrics" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { metrics: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
