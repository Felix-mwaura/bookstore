// Server-only: can this deployment actually take M-Pesa right now?
//
// Two independent conditions, and both have to hold:
//
//   1. The Daraja credentials exist, so a push can be sent at all.
//   2. The database's delivery rule matches DELIVERY_FEE. place_order()
//      refuses an M-Pesa order unless the payment covers the total IT
//      computes, so if the database still adds a delivery fee the app never
//      showed, a customer would be charged and then have the order refused.
//
// Every place that mentions M-Pesa — the checkout tab, the homepage claim,
// the admin Payments banner — asks this function, so none of them can
// advertise something the others cannot do.

import { mpesaConfig } from "./mpesa.js";
import { serviceClient } from "./server.js";
import { DELIVERY_FEE } from "./site.js";

export async function mpesaAvailability() {
  const config = mpesaConfig();
  if (config.error) {
    return {
      enabled: false,
      reason: "not-configured",
      detail: config.error,
      environment: null,
    };
  }

  const environment = config.base.includes("sandbox") ? "sandbox" : "production";

  let db;
  try {
    db = serviceClient();
  } catch {
    return {
      enabled: false,
      reason: "server",
      detail: "SUPABASE_SERVICE_ROLE_KEY is not set",
      environment,
    };
  }

  const { data: rule, error } = await db.rpc("delivery_fee_rule");

  if (error) {
    return {
      enabled: false,
      reason: "pricing-migration",
      detail: "Apply supabase/migrations/20261021090000_free_delivery.sql so the database charges no delivery.",
      environment,
    };
  }

  if (Number(rule) !== DELIVERY_FEE) {
    return {
      enabled: false,
      reason: "pricing-mismatch",
      detail: `The database charges KSh ${Number(rule).toLocaleString()} delivery; the app expects KSh ${DELIVERY_FEE}.`,
      environment,
    };
  }

  return { enabled: true, reason: null, detail: null, environment };
}
