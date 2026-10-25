import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { serviceClient } from "../../../lib/server";
import { COD_AUTO_CANCEL_HOURS } from "../../../lib/order-limits";

// GET /api/cron/cancel-stale-cod — daily sweep, called by Vercel Cron.
//
// WHY
//   A cash-on-delivery order reserves stock the moment it is written. If the
//   customer never takes the delivery call, nothing in the app ever releases
//   that stock: the order sits in Processing forever and the title shows as
//   sold out. This sweep cancels COD orders that are still unconfirmed after
//   COD_AUTO_CANCEL_HOURS, through the same set_order_status() path an admin
//   uses, so the stock is restocked once and the customer is emailed.
//
// AUTHORISATION
//   Vercel sends `Authorization: Bearer <CRON_SECRET>` for scheduled jobs when
//   CRON_SECRET is set on the project. If it is not set, this endpoint refuses
//   to run at all (503) — an unauthenticated PostgreSQL write is worse than a
//   job that never starts. The comparison is constant-time over SHA-256
//   digests, so neither the secret nor its length leaks through timing.
//
//   Until supabase/migrations/20261025120000_cod_abuse_limits.sql is applied,
//   the RPC does not exist; that is reported as 503 with an explicit hint
//   rather than a generic 500.

export const dynamic = "force-dynamic";

function digest(value) {
  return createHash("sha256").update(String(value ?? "")).digest();
}

function checkSecret(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { configured: false, ok: false };

  const header = request.headers.get("authorization") || "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (!provided) return { configured: true, ok: false };

  return { configured: true, ok: timingSafeEqual(digest(provided), digest(expected)) };
}

export async function GET(request) {
  const auth = checkSecret(request);

  if (!auth.configured) {
    return NextResponse.json(
      {
        error:
          "This endpoint is disabled: CRON_SECRET is not set. Set it in Vercel to enable the COD auto-cancel sweep.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    console.error("/api/cron/cancel-stale-cod: SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data, error } = await db.rpc("cancel_stale_cod_orders", {
    p_hours: COD_AUTO_CANCEL_HOURS,
  });

  if (error) {
    const message = error.message || "";
    const missingFunction =
      error.code === "PGRST202" || /could not find the function|does not exist/i.test(message);

    console.error("/api/cron/cancel-stale-cod:", {
      code: error.code ?? null,
      message,
      missingFunction,
    });

    if (missingFunction) {
      return NextResponse.json(
        {
          error:
            "cancel_stale_cod_orders() is not installed. Apply supabase/migrations/20261025120000_cod_abuse_limits.sql first.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "The cancellation sweep failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const cancelled = (Array.isArray(data) ? data : [])
    .map((row) => row?.cancelled_order_id)
    .filter(Boolean);

  return NextResponse.json(
    {
      ranAt: new Date().toISOString(),
      olderThanHours: COD_AUTO_CANCEL_HOURS,
      cancelledCount: cancelled.length,
      cancelledOrderIds: cancelled,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
