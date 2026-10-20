#!/usr/bin/env node
// Unit test for the basket rules — no browser, no database.
//
//   node scripts/cart-smoke.mjs
//
// These are the exact functions the shared store calls, so a failure here is
// a real add-to-cart failure rather than a rendering detail.

const {
  addItem,
  capFor,
  quantityOf,
  reconcile,
  removeItem,
  setQuantity,
  stepQuantity,
  totals,
} = await import("../app/lib/cart.js");

const failures = [];
const check = (label, condition, detail = "") => {
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

const book = (over = {}) => ({
  id: 1,
  title: "Deep Work",
  price: 1399,
  stock_quantity: 3,
  ...over,
});

/* add */
let cart = [];
let step = addItem(cart, book());
cart = step.cart;
check("first add reports 'added'", step.result === "added", step.result);
check("first add creates one line", cart.length === 1, JSON.stringify(cart));
check("first add sets quantity 1", cart[0].quantity === 1, String(cart[0].quantity));

step = addItem(cart, book());
cart = step.cart;
check("second add reports 'incremented'", step.result === "incremented", step.result);
check("second add increments, not duplicates", cart.length === 1 && cart[0].quantity === 2, JSON.stringify(cart));

step = addItem(cart, book());
cart = step.cart;
check("third add reaches the shelf count", cart[0].quantity === 3, String(cart[0].quantity));

step = addItem(cart, book());
cart = step.cart;
check("adding past stock is capped", step.result === "capped" && cart[0].quantity === 3, step.result);

/* out of stock */
step = addItem(cart, book({ id: 2, title: "Sold out", stock_quantity: 0 }));
check("out-of-stock is refused", step.result === "out-of-stock", step.result);
check("out-of-stock does not change the cart", step.cart.length === 1, String(step.cart.length));

/* cart rows saved before stock_quantity existed must not be zeroed */
step = addItem([], { id: 9, title: "Legacy row", price: 100 });
check("a book with no stock field is addable", step.result === "added" && step.cart[0].quantity === 1, step.result);
check("a missing stock field means no cap", capFor({ id: 9 }) === Infinity, String(capFor({ id: 9 })));

/* two titles */
let two = addItem(addItem([], book()).cart, book({ id: 2, title: "Sapiens", price: 1599, stock_quantity: 5 })).cart;
check("two different books make two lines", two.length === 2, String(two.length));
check("quantityOf finds the right line", quantityOf(two, 2) === 1, String(quantityOf(two, 2)));

/* absolute and relative quantity */
two = setQuantity(two, 1, 99);
check("setQuantity clamps to stock", two.find((i) => i.id === 1).quantity === 3, JSON.stringify(two));
two = setQuantity(two, 1, 0);
check("setQuantity 0 removes the line", !two.some((i) => i.id === 1), JSON.stringify(two));

two = stepQuantity(two, 2, 1);
check("stepQuantity adds one", two.find((i) => i.id === 2).quantity === 2, JSON.stringify(two));
two = stepQuantity(two, 2, -5);
check("stepping below zero removes the line", two.length === 0, JSON.stringify(two));

/* totals */
const money = totals([
  { id: 1, price: 1399, quantity: 2 },
  { id: 2, price: 1599, quantity: 1 },
]);
check("totals count items", money.items === 3, String(money.items));
check("totals add money", money.subtotal === 1399 * 2 + 1599, String(money.subtotal));
check("an empty cart totals zero", totals([]).subtotal === 0);

/* remove */
check("removeItem drops one line", removeItem(two, 2).length === 0);

/* reconcile against a live catalogue */
const saved = [
  { id: 1, title: "Deep Work", price: 1399, quantity: 9, stock_quantity: 3 },
  { id: 2, title: "Gone", price: 500, quantity: 1, stock_quantity: 2 },
  { id: 3, title: "Sold out now", price: 500, quantity: 1, stock_quantity: 4 },
  { id: 4, title: "Repriced", price: 100, quantity: 1, stock_quantity: 5 },
];
const live = [
  { id: 1, title: "Deep Work", price: 1399, stock_quantity: 3, is_archived: false },
  { id: 3, title: "Sold out now", price: 500, stock_quantity: 0, is_archived: false },
  { id: 4, title: "Repriced", price: 120, stock_quantity: 5, is_archived: false },
];
const fixed = reconcile(saved, live);
check("reconcile drops deleted titles", !fixed.cart.some((i) => i.id === 2), JSON.stringify(fixed.cart));
check("reconcile drops sold-out titles", !fixed.cart.some((i) => i.id === 3), JSON.stringify(fixed.cart));
check("reconcile caps to shelf", fixed.cart.find((i) => i.id === 1).quantity === 3, JSON.stringify(fixed.cart));
check("reconcile takes the live price", fixed.cart.find((i) => i.id === 4).price === 120, JSON.stringify(fixed.cart));
check("reconcile explains every change", fixed.notes.length === 4, String(fixed.notes.length));

if (failures.length) {
  console.error("cart test FAILED");
  for (const failure of failures) console.error("  •", failure);
  process.exit(1);
}

console.log("cart test passed — add, cap, out-of-stock, totals, quantity and reconcile rules");
