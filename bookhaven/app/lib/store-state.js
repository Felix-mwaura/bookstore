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
import { planSignIn, planToggle } from "./wishlist-sync.js";
import { toPublicBook } from "./book-shape.js";

// The auth client is loaded on demand rather than imported at the top of the
// file. Two reasons: this module is imported by scripts/store-wiring.mjs with
// no bundler, where the Supabase client's extensionless imports do not
// resolve; and most page loads never need it. A failure to load simply means
// the wishlist stays local, which is the signed-out behaviour anyway.
async function authClient() {
  try {
    const mod = await import("./supabase.js");
    return mod.supabase || null;
  } catch {
    return null;
  }
}

const WISHLIST_OWNER_KEY = "bh_wishlist_owner";

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
  // Same idea for saved books: a rapid toggle works from the latest list
  // rather than from a stale closure.
  const wishlistRef = useRef([]);
  // Set from the auth session; null while signed out.
  const tokenRef = useRef(null);

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
    wishlistRef.current = wishlist;
  }, [wishlist]);

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

  // Write one saved-book change to the account. Fire and forget: the local
  // list is the thing the customer sees, and a failed write is retried by the
  // next sign-in reconciliation rather than blocking the button.
  const syncWishlist = useCallback(async (bookId, action) => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      await fetch("/api/wishlist", {
        method: action === "add" ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId }),
      });
    } catch {}
  }, []);

  const toggleWishlist = useCallback(
    (book) => {
      const { next, action } = planToggle(wishlistRef.current, book);
      wishlistRef.current = next;
      setWishlist(next);
      try {
        localStorage.setItem("bh_wishlist", JSON.stringify(next));
      } catch {}
      showToast(action === "add" ? "Saved for later" : "Removed from saved books");
      void syncWishlist(book.id, action);
    },
    [showToast, syncWishlist]
  );

  // ── saved books, across devices ───────────────────────────────────────
  //
  // Signed out, the wishlist is local-only, exactly as before. Signed in, it
  // is reconciled with the account once per session using the rules in
  // lib/wishlist-sync.js — including the case that matters on a shared
  // computer, where the device list belongs to a different person.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const pullBooks = async (client, ids) => {
      if (ids.length === 0) return [];
      const { data, error } = await client
        .from("books")
        .select("id,title,author,price,original_price,category,format,isbn,badge,stock,stock_quantity,cover,cover_url,description,pages,publisher,year,tags")
        .in("id", ids)
        .eq("is_archived", false);
      if (error) return [];
      // Keep the account's order, not the database's.
      const byId = new Map((data || []).map((row) => [Number(row.id), toPublicBook(row)]));
      return ids.map((id) => byId.get(Number(id))).filter(Boolean);
    };

    const reconcile = async (session) => {
      tokenRef.current = session?.access_token || null;

      if (!session) {
        // Signed out: the account's list is no longer this device's business.
        try { localStorage.removeItem(WISHLIST_OWNER_KEY); } catch {}
        return;
      }

      const client = await authClient();
      if (!client) return;

      let accountIds = [];
      try {
        const res = await fetch("/api/wishlist", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          accountIds = Array.isArray(json?.bookIds) ? json.bookIds : [];
        } else {
          // Do not touch the local list if the account could not be read:
          // replacing it with an empty list on a network blip would look
          // like the customer's saved books had been deleted.
          return;
        }
      } catch {
        return;
      }
      if (cancelled) return;

      let localOwner = null;
      try { localOwner = localStorage.getItem(WISHLIST_OWNER_KEY); } catch {}

      const plan = planSignIn({
        localOwner,
        userId: session.user.id,
        localIds: wishlistRef.current.map((b) => b.id),
        accountIds,
      });

      // Adopt the account's books the device does not have yet.
      const fetched = await pullBooks(client, plan.fetchIds);
      if (cancelled) return;

      let next;
      if (plan.mode === "replace") {
        next = fetched;
      } else {
        const existing = new Map(wishlistRef.current.map((b) => [Number(b.id), b]));
        for (const book of fetched) existing.set(Number(book.id), book);
        next = [...existing.values()];
      }

      wishlistRef.current = next;
      setWishlist(next);
      try {
        localStorage.setItem("bh_wishlist", JSON.stringify(next));
        localStorage.setItem(WISHLIST_OWNER_KEY, session.user.id);
      } catch {}

      // Push the device's extras up (guest saves, or a save made while the
      // network was down). Sequential on purpose: a burst of parallel writes
      // gains nothing here and is easier to rate-limit.
      for (const id of plan.push) {
        try {
          await fetch("/api/wishlist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ bookId: id }),
          });
        } catch {
          // Left local; the next sign-in tries again.
        }
      }
    };

    let unsubscribe = () => {};

    void (async () => {
      const client = await authClient();
      if (!client || cancelled) return;

      client.auth
        .getSession()
        .then(({ data: { session } }) => reconcile(session))
        .catch(() => {});

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        tokenRef.current = session?.access_token || null;
        if (event === "SIGNED_IN" && session) {
          void reconcile(session);
        }
        if (event === "SIGNED_OUT") {
          tokenRef.current = null;
          try { localStorage.removeItem(WISHLIST_OWNER_KEY); } catch {}
          wishlistRef.current = [];
          setWishlist([]);
          try { localStorage.removeItem("bh_wishlist"); } catch {}
        }
      });

      if (cancelled) {
        listener.subscription.unsubscribe();
        return;
      }
      unsubscribe = () => listener.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hydrated]);

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
    // Exposed so components that batch several cart changes (reordering a
    // past order) can report once instead of once per book.
    showToast,
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
