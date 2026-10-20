// Stock vocabulary shared by server and client components.
//
// Kept free of React on purpose: the book page is a server component and
// cannot call a helper that lives in a "use client" module.

export const LOW_STOCK_FALLBACK = 3;

/**
 * @param {{stock_quantity?: number, low_stock_threshold?: number}} book
 * @returns {{key: "out"|"low"|"in", label: string, canBuy: boolean, className: string}}
 */
export function stockState(book) {
  const quantity = Number(book?.stock_quantity);
  const threshold = Number(book?.low_stock_threshold) || LOW_STOCK_FALLBACK;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      key: "out",
      label: "Out of stock",
      canBuy: false,
      className: "bg-error/10 text-error",
    };
  }
  if (quantity <= threshold) {
    return {
      key: "low",
      label: `Only ${quantity} left`,
      canBuy: true,
      className: "bg-warning/12 text-[#8A5A15]",
    };
  }
  return {
    key: "in",
    label: "In stock",
    canBuy: true,
    className: "bg-success/10 text-success",
  };
}
