import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { dispatchQueuedEmails } from "../../../lib/email-dispatch";

// GET /api/admin/emails — the notification queue, newest first.
//
// This is the honest view of email: what was queued, what actually left, and
// why anything is stuck. Without it, "we send emails" is an unverifiable
// claim.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;

  const [list, counts] = await Promise.all([
    adminClient
      .from("email_outbox")
      .select("id, order_id, to_email, template, subject, status, attempts, last_error, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(100),
    adminClient
      .from("email_outbox")
      .select("status", { count: "exact" })
      .in("status", ["queued", "failed", "sent", "skipped"]),
  ]);

  if (list.error) {
    console.error("GET /api/admin/emails:", list.error.message);
    return NextResponse.json(
      { error: "Could not load the notification queue" },
      { status: 500 }
    );
  }

  const summary = { queued: 0, failed: 0, sent: 0, skipped: 0 };
  for (const row of counts.data || []) {
    if (row.status in summary) summary[row.status] += 1;
  }

  return NextResponse.json(
    { emails: list.data || [], summary },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// POST /api/admin/emails — run a delivery sweep now (retry failed rows).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const result = await dispatchQueuedEmails();
  return NextResponse.json({ result });
}
