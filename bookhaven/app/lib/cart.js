// Cart rules, kept framework-free.
//
// The basket is the one piece of state a customer touches on almost every
// page, and a wrong quantity silently breaks checkout. Keeping the arithmetic
// in plain functions means it can be tested without a browser
// (scripts/cart-smoke.mjs) and reused by the drawer, the product grid and the
// book page instead of three slightly different copies.

/** Real shelf count, or Infinity for cart rows saved before the field existed. */
export function capFor(book) {
  const q = Number(book?.stock_quantity);
  return Number.isFinite(q) && q >= 0 ? q : Infinity;
}

/**
 * Add one copy of `book`.
 * Returns { cart, result } where result is one of:
 *   "added" | "incremented" | "capped" | "out-of-stock"
 */
export function addItem(cart, book) {
  const cap = capFor(book);
  if (cap <= 0) return { cart, result: "out-of-stock" };

  const existing = cart.find((item) => item.id === book.id);
  if (!existing) {
    return { cart: [...cart, { ...book, quantity: 1 }], result: "added" };
  }

  if (existing.quantity >= cap) return { cart, result: "capped" };

  return {
    cart: cart.map((item) =>
      item.id === book.id
        ? { ...item, quantity: item.quantity + 1, stock_quantity: book.stock_quantity }
        : item
    ),
    result: "incremented",
  };
}

/** Set an absolute quantity; 0 or less removes the line. Never exceeds stock. */
export function setQuantity(cart, id, quantity) {
  const next = Math.max(0, Math.floor(Number(quantity) || 0));
  return cart
    .map((item) => {
      if (item.id !== id) return item;
      return { ...item, quantity: Math.min(capFor(item), next) };
    })
    .filter((item) => item.quantity > 0);
}

/** Relative change, used by the drawer's +/- controls. */
export function stepQuantity(cart, id, delta) {
  const line = cart.find((item) => item.id === id);
  if (!line) return cart;
  return setQuantity(cart, id, line.quantity + delta);
}

export function removeItem(cart, id) {
  return cart.filter((item) => item.id !== id);
}

/** Quantity of one title already in the basket (0 when absent). */
export function quantityOf(cart, id) {
  return cart.find((item) => item.id === id)?.quantity || 0;
}

/** Money totals. `price` comes from the catalogue, never from the basket UI. */
export function totals(cart) {
  return cart.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      acc.items += quantity;
      acc.subtotal += price * quantity;
      return acc;
    },
    { items: 0, subtotal: 0 }
  );
}

/** Keep only rows we can still sell, and never above the current shelf count. */
export function reconcile(cart, liveBooks) {
  const byId = new Map((liveBooks || []).map((book) => [book.id, book]));
  const notes = [];
  const next = [];

  for (const item of cart) {
    const live = byId.get(item.id);
    if (!live || live.is_archived) {
      notes.push(`“${item.title}” is no longer available and was removed.`);
      continue;
    }
    const cap = capFor(live);
    if (cap <= 0) {
      notes.push(`“${item.title}” sold out and was removed.`);
      continue;
    }
    const quantity = Math.min(Number(item.quantity) || 1, cap);
    if (quantity !== item.quantity) {
      notes.push(`Only ${cap} of “${item.title}” left — quantity reduced.`);
    }
    if (Number(live.price) !== Number(item.price)) {
      notes.push(`The price of “${item.title}” changed.`);
    }
    next.push({ ...item, price: live.price, stock_quantity: cap, quantity });
  }

  return { cart: next, notes };
}
