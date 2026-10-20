"use client";

// Shared basket + saved-books state, with no JSX in sight.
//
// This used to be a plain hook living in StoreShell, so every component that
// called useStore() got its own private copy: the product grid wrote to one
// basket while the header badge and the drawer read another, and an "Add"
// looked like it did nothing. It is now one React context, mounted once in
// the root layout, so the grid, the book page, the drawer and the badge are
// literally the same state.
//
// Kept out of the component file so it can be imported and exercised by
// scripts/store-wiring.mjs without a JSX toolchain.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addItem, capFor, removeItem, stepQuantity, totals } from "./cart.js";

const StoreContext = createContext(null);

export function useStoreState() {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Nothing is written back to localStorage until the saved basket has been
  // read. Without this the first render's empty cart overwrote the real one.
  const [hydrated, setHydrated] = useState(false);

  // A synchronous mirror of the basket. Rapid clicks land before React
  // re-renders, so the next cart is computed from the newest value rather
  // than from a stale render closure — otherwise a fast double-click only
  // added one copy.
  const cartRef = useRef([]);

  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Restore once on mount. Reading in an effect keeps the server-rendered
  // markup and the first client render identical.
  useEffect(() => {
    try {
      const rawCart = localStorage.getItem("bh_cart");
      const rawWishlist = localStorage.getItem("bh_wishlist");
      if (rawCart) {
        const parsed = JSON.parse(rawCart);
        cartRef.current = Array.isArray(parsed) ? parsed : [];
        setCart(cartRef.current);
      }
      if (rawWishlist) setWishlist(JSON.parse(rawWishlist));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist after hydration, and only when the data actually changed.
  useEffect(() => {
    cartRef.current = cart;
    if (!hydrated) return;
    try {
      localStorage.setItem("bh_cart", JSON.stringify(cart));
    } catch {}
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("bh_wishlist", JSON.stringify(wishlist));
    } catch {}
  }, [wishlist, hydrated]);

  // Keep tabs, and any island that still writes localStorage directly
  // (the book page's BuyBar), in step. `storage` fires in other tabs; the
  // custom event covers same-page writers.
  useEffect(() => {
    const reload = (event) => {
      if (event?.detail?.source === "self") return;
      try {
        const rawCart = localStorage.getItem("bh_cart");
        const rawWishlist = localStorage.getItem("bh_wishlist");
        const parsed = rawCart ? JSON.parse(rawCart) : [];
        cartRef.current = Array.isArray(parsed) ? parsed : [];
        setCart(cartRef.current);
        setWishlist(rawWishlist ? JSON.parse(rawWishlist) : []);
      } catch {}
    };
    const onStorage = (event) => {
      if (!event.key || event.key === "bh_cart" || event.key === "bh_wishlist") reload(event);
    };

    window.addEventListener("bh:cart-changed", reload);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bh:cart-changed", reload);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Announce our own changes so anything outside React (nothing today, but
  // the book page has written directly before) can react without a reload.
  const broadcast = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("bh:cart-changed", { detail: { source: "self" } }));
    } catch {}
  }, []);

  /**
   * Add copies of `book`. Quantity defaults to 1 (a card's "+"), and the book
   * page's quantity stepper passes the number picked. Pass { silent: true }
   * when the caller shows its own confirmation next to the button.
   */
  // Write through immediately as well as through the effect below.
  // The book page's "Buy now" adds to the basket and navigates in the same
  // click; the checkout page reads bh_cart when it mounts, and React runs a
  // child's mount effect before the provider's, so waiting for the effect
  // would let checkout read the previous basket. Actions only ever run after
  // hydration, so this cannot overwrite the saved basket with an empty one.
  const persistCart = useCallback((next) => {
    try {
      localStorage.setItem("bh_cart", JSON.stringify(next));
    } catch {}
  }, []);

  const addToCart = useCallback(
    (book, quantity = 1, { silent = false } = {}) => {
      const wanted = Math.max(1, Math.floor(Number(quantity) || 1));
      let next = cartRef.current;
      let blocked = null;
      let added = 0;

      for (let i = 0; i < wanted; i += 1) {
        const step = addItem(next, book);
        if (step.result === "capped" || step.result === "out-of-stock") {
          blocked = step.result;
          break;
        }
        next = step.cart;
        added += 1;
      }

      cartRef.current = next;
      persistCart(next);
      setCart(next);

      // The message comes from the same rules that produced the cart, so it
      // can never claim success the basket did not get.
      if (silent) return { added, blocked };
      if (blocked === "out-of-stock") showToast(`“${book.title}” is out of stock`);
      else if (blocked === "capped") showToast(`Only ${capFor(book)} of “${book.title}” in stock`);
      else if (added > 1) showToast(`${added} copies of “${book.title}” added to basket`);
      else showToast(`“${book.title}” added to basket`);
      return { added, blocked };
    },
    [persistCart, showToast]
  );

  // Every write goes through the same ref mirror, otherwise a fast
  // remove-then-add works from a basket that no longer exists.
  const commit = useCallback(
    (next) => {
      cartRef.current = next;
      persistCart(next);
      setCart(next);
    },
    [persistCart]
  );

  const removeFromCart = useCallback(
    (id) => commit(removeItem(cartRef.current, id)),
    [commit]
  );

  const updateQty = useCallback(
    (id, delta) => commit(stepQuantity(cartRef.current, id, delta)),
    [commit]
  );

  const toggleWishlist = useCallback(
    (book) => {
      setWishlist((prev) => {
        const exists = prev.some((b) => b.id === book.id);
        showToast(exists ? "Removed from saved books" : "Saved for later");
        return exists ? prev.filter((b) => b.id !== book.id) : [...prev, book];
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (hydrated) broadcast();
  }, [cart, wishlist, hydrated, broadcast]);

  const { items: cartCount, subtotal: cartTotal } = useMemo(() => totals(cart), [cart]);

  return {
    cart,
    wishlist,
    isCartOpen,
    isWishlistOpen,
    toast,
    hydrated,
    setIsCartOpen,
    setIsWishlistOpen,
    addToCart,
    removeFromCart,
    updateQty,
    toggleWishlist,
    cartTotal,
    cartCount,
  };
}

/** The hook every component uses. Throws loudly when the provider is missing. */
export function useStore() {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore() must be used inside <StoreProvider> (app/layout.js)");
  }
  return store;
}

export { StoreContext };
