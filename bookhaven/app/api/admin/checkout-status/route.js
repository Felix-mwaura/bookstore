import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { mpesaAvailability } from "../../../lib/mpesa-availability";
import { DELIVERY_PERCENT } from "../../../lib/site";

// GET /api/admin/checkout-status — is the shop able to take an order, and can
// it take M-Pesa?
//
// The dashboard shows a banner when an order would be refused. The only case
// that pauses checkout today is a delivery-pricing mismatch between the app
// and place_order(): /api/orders will not write an order that carries a fee
// the customer never saw, so the owner has to know immediately rather than
// discovering it when a customer complains.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const mpesa = await mpesaAvailability();

  return NextResponse.json(
    {
      checkoutPaused: mpesa.reason === "pricing-migration" || mpesa.reason === "pricing-mismatch",
      mpesa,
      deliveryPercent: DELIVERY_PERCENT,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
