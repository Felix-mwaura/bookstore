import { NextResponse } from "next/server";
import { mpesaConfig } from "../../../lib/mpesa";
import { serviceClient } from "../../../lib/server";
import { DELIVERY_FEE } from "../../../lib/site";

// GET /api/mpesa/status — can this deployment take M-Pesa right now?
//
// The checkout asks before it draws the M-Pesa tab, so a shop with no Daraja
// credentials shows cash on delivery alone instead of a payment method that
// fails at the last step.
//
// There are two things to check, and both matter:
//
//   1. Credentials. Without them no push can be sent.
//   2. The database's delivery rule. place_order() refuses an M-Pesa order
//      unless the payment covers the total IT computes. If the shop charges
//      no delivery in the app but the database still adds KSh 300, a customer
//      would be charged, then have the order refused. So M-Pesa stays off
//      until delivery_fee_rule() exists and agrees with DELIVERY_FEE.
//
// Failing that carefully means the shop takes cash on delivery until the
// migration is applied — never money it cannot turn into an order.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = mpesaConfig();
  if (config.error) {
    return json({ enabled: false, reason: "not-configured" });
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    return json({ enabled: false, reason: "server" });
  }

  const { data: rule, error } = await db.rpc("delivery_fee_rule");
  if (error) {
    return json({ enabled: false, reason: "pricing-migration" });
  }
  if (Number(rule) !== DELIVERY_FEE) {
    return json({ enabled: false, reason: "pricing-mismatch" });
  }

  return json({
    enabled: true,
    environment: config.base.includes("sandbox") ? "sandbox" : "production",
  });
}

// Only the boolean is public: no shortcode, no callback URL, no hint about
// which credential is missing.
function json(body) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
