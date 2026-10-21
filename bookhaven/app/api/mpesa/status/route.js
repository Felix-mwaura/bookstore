import { NextResponse } from "next/server";
import { mpesaAvailability } from "../../../lib/mpesa-availability";

// GET /api/mpesa/status — can this deployment take M-Pesa right now?
//
// The checkout asks before it draws the M-Pesa tab, so a shop with no Daraja
// credentials (or a database that has not had the delivery-pricing migration
// applied) shows cash on delivery alone instead of a payment method that
// fails at the last step.
//
// The public answer is deliberately thin: a boolean, and which Daraja
// environment is in use, which the customer sees on the phone prompt anyway.
// No shortcode, no callback URL, no hint about which credential is missing.
// The reason lives in /api/admin/payments, where only an admin can read it.
export const dynamic = "force-dynamic";

export async function GET() {
  const { enabled, environment } = await mpesaAvailability();

  return NextResponse.json(
    { enabled, environment: enabled ? environment : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
