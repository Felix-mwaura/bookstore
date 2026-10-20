// Order vocabulary shared by the customer-facing pages.
//
// The database holds two independent states (see PHASE2.md): `status` for
// fulfilment and `payment_status` for money. Both are translated here so the
// account page, the order page and the confirmation screen cannot drift into
// describing the same order three different ways.

export const FULFILMENT_STEPS = [
  { key: "Pending", label: "Order placed", hint: "We have received your order." },
  { key: "Processing", label: "Preparing", hint: "We are gathering your books." },
  { key: "Packed", label: "Packed", hint: "Boxed and waiting for the courier." },
  { key: "Shipped", label: "Dispatched", hint: "On its way to you." },
  { key: "Delivered", label: "Delivered", hint: "Enjoy your books." },
];

export const FULFILMENT_META = {
  Pending: { label: "Pending", tone: "amber" },
  Processing: { label: "Preparing", tone: "amber" },
  Packed: { label: "Packed", tone: "blue" },
  Shipped: { label: "Dispatched", tone: "blue" },
  Delivered: { label: "Delivered", tone: "green" },
  Cancelled: { label: "Cancelled", tone: "red" },
};

export const PAYMENT_META = {
  pending: { label: "Not paid yet", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  failed: { label: "Payment failed", tone: "red" },
  refund_pending: { label: "Refund pending", tone: "amber" },
  refunded: { label: "Refunded", tone: "stone" },
};

// Tailwind classes must be written out in full — a template string like
// `bg-${tone}-100` is invisible to the compiler and renders unstyled.
const TONE_CLASSES = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  green: "bg-green-50 text-green-800 border-green-200",
  red: "bg-red-50 text-red-800 border-red-200",
  stone: "bg-stone-100 text-stone-600 border-[#E3DCCB]",
};

export function toneClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.stone;
}

/** Short, quotable reference derived from the real order id. */
export function orderReference(id) {
  return id ? `BH-${String(id).slice(0, 8).toUpperCase()}` : "BH-";
}

/** Index of the current step in FULFILMENT_STEPS, or -1 for cancelled. */
export function fulfilmentStepIndex(status) {
  return FULFILMENT_STEPS.findIndex((s) => s.key === status);
}

export function isTerminal(status) {
  return status === "Delivered" || status === "Cancelled";
}

/**
 * True when the customer still owes money on a non-cancelled order.
 * Cash on delivery is deliberately "unpaid" until the courier collects,
 * which is why the label says "Pay on delivery" rather than "Overdue".
 */
export function paymentDue(order) {
  return (
    order.status !== "Cancelled" &&
    (order.payment_status === "pending" || order.payment_status === "failed")
  );
}
