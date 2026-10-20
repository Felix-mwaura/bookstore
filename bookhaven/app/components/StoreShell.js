"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";
import { FREE_DELIVERY_THRESHOLD, formatKsh } from "../lib/site";
import { useDialog } from "../lib/useDialog";
import { STORE_CONTACT } from "../lib/site";

// The header and the category list live in their own modules now. These
// re-exports keep the existing page imports working unchanged.
export { default as StoreHeader } from "./StoreHeader";
export { categories, categoryIcons } from "../lib/categories";

// ── Cart Drawer ─────────────────────────────────────────
export function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onRemove, total }) {
  const close = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialog(isOpen, close);

  if (!isOpen) return null;

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - total);
  const progress = Math.min(100, Math.round((total / FREE_DELIVERY_THRESHOLD) * 100));

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-navy/50" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="basket-title"
        tabIndex={-1}
        className="absolute right-0 top-0 h-[100dvh] w-full max-w-md bg-cream shadow-pop flex flex-col animate-slide-in-right"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 id="basket-title" className="text-lg font-bold text-navy">Your basket</h2>
            <p className="text-xs text-muted mt-0.5">
              {itemCount === 0 ? "No items yet" : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close basket"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-subtle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="px-2 py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <h3 className="mt-4 text-base font-semibold text-navy">Your basket is empty</h3>
              <p className="mt-1 text-sm text-muted">Add a book and it will wait here for you.</p>
              <Link href="/books" onClick={close} className="btn-primary mt-5 text-sm">Browse books</Link>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {cart.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <Link href={bookPath(item)} onClick={close} className="w-16 shrink-0 rounded-r-sm overflow-hidden book-shadow">
                    <BookCover book={item} className="w-full" sizes="64px" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={bookPath(item)} onClick={close} className="block text-sm font-semibold text-navy line-clamp-2 hover:text-sienna">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted truncate">{item.author}</p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-control border border-line bg-white">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={`Decrease quantity of ${item.title}`}
                          className="w-9 h-11 flex items-center justify-center text-navy hover:bg-subtle rounded-l-control"
                        >
                          <span aria-hidden="true">−</span>
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={`Increase quantity of ${item.title}`}
                          className="w-9 h-11 flex items-center justify-center text-navy hover:bg-subtle rounded-r-control"
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                      </div>

                      <p className="text-sm font-bold text-navy">{formatKsh(item.price * item.quantity)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="mt-1.5 text-xs text-muted underline underline-offset-2 hover:text-error"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-line p-4">
            <div className="rounded-card border border-line bg-white p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-navy">{formatKsh(total)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-sm">
                <span className="text-muted">Delivery</span>
                <span className="font-semibold text-navy">
                  {remaining === 0 ? "Free" : "Calculated at checkout"}
                </span>
              </div>

              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-subtle" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-sienna transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted" role="status">
                  {remaining === 0
                    ? "Delivery is free on this order."
                    : `Add ${formatKsh(remaining)} more for free delivery.`}
                </p>
              </div>

              <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold text-navy">
                <span>Total</span>
                <span>{formatKsh(total)}</span>
              </div>
            </div>

            <Link href="/checkout" onClick={close} className="btn-primary mt-3 w-full text-sm">
              Checkout
            </Link>
            <p className="mt-2 text-center text-xs text-muted">Delivery is added on the next step, before you pay.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Footer ───────────────────────────────────────
export function StoreFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy text-cream/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center">
              <span className="font-playfair text-lg font-bold text-white">Book Haven</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">
              Books in Kenyan shillings, delivered nationwide. Free over KSh 3,000,
              a flat KSh 300 below that.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white mb-3">Shop</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/books" className="hover:text-white transition">All books</Link></li>
              <li><Link href="/category/fiction" className="hover:text-white transition">Fiction</Link></li>
              <li><Link href="/category/finance" className="hover:text-white transition">Finance</Link></li>
              <li><Link href="/category/self-help" className="hover:text-white transition">Self-Help</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white mb-3">Your account</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/account" className="hover:text-white transition">Orders &amp; tracking</Link></li>
              <li><Link href="/login" className="hover:text-white transition">Sign in</Link></li>
              <li><Link href="/login?tab=register" className="hover:text-white transition">Create an account</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white mb-3">Contact</h2>
            <ul className="space-y-2 text-sm">
              <li><a href={`mailto:${STORE_CONTACT.email}`} className="hover:text-white transition">{STORE_CONTACT.email}</a></li>
              <li><a href={STORE_CONTACT.phoneHref} className="hover:text-white transition">{STORE_CONTACT.phone}</a></li>
              <li>{STORE_CONTACT.location}</li>
              <li className="text-cream/60">{STORE_CONTACT.hours}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-cream/60">© {year} Book Haven Kenya</p>
          <p className="text-xs text-cream/60">Prices in KES · Pay on delivery</p>
        </div>
      </div>
    </footer>
  );
}

// ── useStore hook ───────────────────────────────────────
export function useStore() {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem("bh_cart");
      const w = localStorage.getItem("bh_wishlist");
      // Browser-only state restored after mount so the server-rendered
      // HTML and the first client render stay identical.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state restored after mount
      if (c) setCart(JSON.parse(c));
      if (w) setWishlist(JSON.parse(w));
    } catch {}
  }, []);

  useEffect(() => { localStorage.setItem("bh_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("bh_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // Keeps every mounted copy of the cart in step. The server-rendered book
  // page writes to the same localStorage key from a separate client island,
  // so a cart change there has to reach the header badge and drawer here.
  useEffect(() => {
    const reload = (e) => {
      if (e && e.detail && e.detail.source === "self") return;
      try {
        const c = localStorage.getItem("bh_cart");
        const w = localStorage.getItem("bh_wishlist");
        if (c) setCart(JSON.parse(c));
        if (w) setWishlist(JSON.parse(w));
      } catch {}
    };
    window.addEventListener("bh:cart-changed", reload);
    return () => window.removeEventListener("bh:cart-changed", reload);
  }, []);

  const capFor = (book) => {
    // stock_quantity is the real number; fall back to +Infinity for older
    // cart rows saved before the field existed so nothing is silently zeroed.
    const q = Number(book?.stock_quantity);
    return Number.isFinite(q) && q >= 0 ? q : Infinity;
  };

  const addToCart = (book) => {
    const cap = capFor(book);
    if (cap <= 0) {
      showToast(`"${book.title}" is out of stock`);
      return;
    }
    let capped = false;
    setCart((prev) => {
      const exists = prev.find((i) => i.id === book.id);
      if (exists) {
        if (exists.quantity >= cap) { capped = true; return prev; }
        return prev.map((i) => i.id === book.id ? { ...i, quantity: i.quantity + 1, stock_quantity: book.stock_quantity } : i);
      }
      return [...prev, { ...book, quantity: 1 }];
    });
    showToast(capped ? `Only ${cap} of "${book.title}" in stock` : `"${book.title}" added to basket`);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));

  const updateQty = (id, delta) => setCart((prev) => prev.map((i) => {
    if (i.id !== id) return i;
    const cap = capFor(i);
    const next = Math.min(cap, Math.max(0, i.quantity + delta));
    return { ...i, quantity: next };
  }).filter((i) => i.quantity > 0));

  // Absolute quantity, used by the checkout review where a customer types it.
  const setQty = (id, value) => setCart((prev) => prev.map((i) => {
    if (i.id !== id) return i;
    const cap = capFor(i);
    const next = Math.min(cap, Math.max(0, Math.floor(Number(value) || 0)));
    return { ...i, quantity: next };
  }).filter((i) => i.quantity > 0));

  const toggleWishlist = (book) => {
    setWishlist((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      showToast(exists ? "Removed from wishlist" : "Added to wishlist ♡");
      return exists ? prev.filter((b) => b.id !== book.id) : [...prev, book];
    });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Anything that removes every line item has effectively emptied the basket;
  // the checkout page relies on this to stop showing a stale review.
  return {
    cart, wishlist, isCartOpen, isWishlistOpen, toast,
    setIsCartOpen, setIsWishlistOpen,
    addToCart, removeFromCart, updateQty, setQty, toggleWishlist, cartTotal, cartCount,
  };
}
