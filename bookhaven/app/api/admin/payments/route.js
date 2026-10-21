import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { mpesaAvailability } from "../../../lib/mpesa-availability";

// GET /api/admin/payments — recent M-Pesa attempts, for the Payments tab.
//
// Admin-only. The whole point of the tab is that an owner can answer "did this
// customer pay, and what happened to it" without opening the Supabase
// dashboard: amount, receipt, status, phone and the order it became.
//
// Reads with the service role because mpesa_payments is deliberately not
// readable by ordinary customers (its RLS only admits admins; the service
// client is used here so the response can also include the configuration
// check, which needs the server-only credentials).
//
// It never writes anything, and it never returns a customer's password, token
// or anything from auth.users beyond the id that links a payment to a profile.
export const dynamic = "force-dynamic";

const STATUSES = ["pending", "completed", "failed"];

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const url = new URL(request.url);

  const status = url.searchParams.get("status") || "all";
  if (status !== "all" && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown payment status filter" }, { status: 400 });
  }

  let query = adminClient
    .from("mpesa_payments")
    .select(
      "id, checkout_request_id, merchant_request_id, user_id, expected_amount, amount, status, result_code, result_desc, mpesa_receipt, phone, transaction_date, order_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data: rows, error } = await query;

  if (error) {
    console.error("/api/admin/payments:", error.message);
    return NextResponse.json({ error: "Could not load M-Pesa payments" }, { status: 500 });
  }

  const payments = rows || [];

  // Names and emails for the customer column, in one query.
  const userIds = [...new Set(payments.map((p) => p.user_id).filter(Boolean))];
  let profiles = [];
  if (userIds.length) {
    const { data } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);
    profiles = data || [];
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // Counts are over the rows actually returned, and the client says so.
  const summary = payments.reduce(
    (acc, p) => {
      acc.total += 1;
      if (p.status === "completed") {
        acc.completed += 1;
        acc.collected += Number(p.amount ?? p.expected_amount ?? 0);
      } else if (p.status === "pending") {
        acc.pending += 1;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    { total: 0, completed: 0, pending: 0, failed: 0, collected: 0 }
  );

  return NextResponse.json(
    {
      payments: payments.map((p) => {
        const profile = byId.get(p.user_id);
        return {
          id: p.id,
          checkout_request_id: p.checkout_request_id,
          merchant_request_id: p.merchant_request_id,
          user_id: p.user_id,
          customer: {
            name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
            email: profile?.email || "",
          },
          amount: p.amount ?? p.expected_amount ?? 0,
          expected_amount: p.expected_amount ?? 0,
          status: p.status,
          result_code: p.result_code,
          result_desc: p.result_desc,
          receipt: p.mpesa_receipt,
          phone: p.phone,
          transaction_date: p.transaction_date,
          order_id: p.order_id,
          created_at: p.created_at,
        };
      }),
      summary,
      configuration: await mpesaAvailability(),
      filter: status,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
