// Order limits that exist to stop stock being held hostage.
//
// WHY
//   Cash-on-delivery needs no money up front, so a single account could place
//   order after order, each one reserving stock the moment it is written.
//   Competing customers then see "out of stock" for a book that is sitting in
//   someone's basket, and the shop has no sale. Nothing here limits a
//   legitimate purchase: twenty books in one COD parcel, and three COD orders
//   open at once, are far above normal use.
//
//   These constants are also enforced in the database by
//   supabase/migrations/20261025120000_cod_abuse_limits.sql (a BEFORE INSERT
//   trigger plus a per-customer advisory lock, so two tabs cannot race past
//   the count). This module is the friendly, fast check; the trigger is the
//   one that cannot be bypassed. Keep the two in step.
//
//   M-Pesa orders are not capped here: the money is already collected, so an
//   order that reserves stock is a sale, not a hold.

/** Most copies of anything one COD order may contain, summed across lines. */
export const MAX_COD_UNITS = 20;

/** How many COD orders may be awaiting fulfilment at the same time. */
export const MAX_OPEN_COD_ORDERS = 3;

/** Open (not yet dispatched) fulfilment states. Shipped/Delivered are done. */
export const OPEN_COD_STATUSES = ["Pending", "Processing", "Packed"];

/** Hours after which an unconfirmed COD order is cancelled and restocked. */
export const COD_AUTO_CANCEL_HOURS = 48;

/** Total copies in a cleaned cart ([{ id, quantity }]). */
export function unitsIn(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity);
    return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
}

/**
 * Null when a COD order may proceed, otherwise the response to send.
 *
 * @param {{ units: number, openOrders: number }} args
 * @returns {null | { status: number, code: string, message: string }}
 */
export function codLimitProblem({ units, openOrders }) {
  if (Number(units) > MAX_COD_UNITS) {
    return {
      status: 400,
      code: "COD_ORDER_TOO_LARGE",
      message: `Cash on delivery is limited to ${MAX_COD_UNITS} books per order. Please pay online for a larger order, or split it and wait for the first one to arrive.`,
    };
  }

  if (Number(openOrders) >= MAX_OPEN_COD_ORDERS) {
    return {
      status: 409,
      code: "TOO_MANY_OPEN_COD_ORDERS",
      message: `You already have ${MAX_OPEN_COD_ORDERS} cash-on-delivery orders waiting to be delivered. Please wait for one of them to arrive, cancel one from your account, or pay for this order with M-Pesa.`,
    };
  }

  return null;
}
