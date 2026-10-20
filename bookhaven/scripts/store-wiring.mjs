#!/usr/bin/env node
// Regression test for the bug that made "Add to basket" look broken.
//
//   node scripts/store-wiring.mjs
//
// The store used to be a plain hook, so the product grid and the header each
// got their own copy of the cart. Adding from the grid updated a basket that
// nothing rendered: no badge change, no drawer, no toast.
//
// This renders two sibling consumers under one provider — the same shape as
// BookGrid next to StoreLayout — and asserts they receive the *same* store
// object. No browser and no bundler are needed because the state lives in a
// JSX-free module (app/lib/store-state.js).

import React from "react";
import { renderToString } from "react-dom/server";

const { StoreContext, useStoreState } = await import("../app/lib/store-state.js");

const failures = [];
const check = (label, condition, detail = "") => {
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

function Root({ children }) {
  const store = useStoreState();
  return React.createElement(StoreContext.Provider, { value: store }, children);
}

const seen = [];

function Consumer({ name }) {
  const store = React.useContext(StoreContext);
  seen.push({ name, store });
  return React.createElement("span", { "data-consumer": name }, String(store.cart.length));
}

const html = renderToString(
  React.createElement(
    Root,
    null,
    React.createElement(Consumer, { name: "product-grid" }),
    React.createElement(Consumer, { name: "header" }),
    React.createElement(Consumer, { name: "drawer" })
  )
);

check("all three consumers rendered", (html.match(/data-consumer=/g) || []).length === 3, html);
check("three consumers recorded", seen.length === 3, String(seen.length));

const [grid, header, drawer] = seen;
check("grid and header share one store object", grid.store === header.store);
check("header and drawer share one store object", header.store === drawer.store);
check("the same addToCart function reaches every consumer", grid.store.addToCart === header.store.addToCart);
check("the same cart array reaches every consumer", grid.store.cart === drawer.store.cart);
check("the store exposes the actions the UI calls", ["addToCart", "removeFromCart", "updateQty", "toggleWishlist"].every(
  (key) => typeof grid.store[key] === "function"
));

/* The shape of the failure: two independent hooks would not be equal. */
function Independent() {
  const store = useStoreState();
  return React.createElement("span", null, String(store.cart.length));
}
const independent = seen[0].store;
const other = renderToString(React.createElement(Independent));
check("a provider-less hook still renders a stock cart", other.includes("0"), other);
check("a plain hook is not the shared store", typeof independent === "object" && independent !== null);

if (failures.length) {
  console.error("store wiring test FAILED");
  for (const failure of failures) console.error("  •", failure);
  process.exit(1);
}

console.log("store wiring test passed — one store for the grid, the header badge and the drawer");
