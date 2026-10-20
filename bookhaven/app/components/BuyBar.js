"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatKsh } from "../lib/site";
import { stockState } from "../lib/stock";

// Cart controls for the server-rendered book page.
//
// The page itself is a server component (so it can be crawled and linked),
// but the basket lives in localStorage. This island writes the same
// `bh_cart` key the rest of the store uses and broadcasts a change event so
// the header badge and drawer update immediately instead of after a reload.
function readCart() {
  try {
    const raw = localStorage.getItem("bh_cart");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  try {
    localStorage.setItem("bh_cart", JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("bh:cart-changed", { detail: { source: "book-page" } }));
  } catch {}
}

function readWishlist() {
  try {
    const raw = localStorage.getItem("bh_wishlist");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function BuyBar({ book }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [wishlisted, setWishlisted] = useState(() => {
    if (typeof window === "undefined") return false;
    return readWishlist().some((item) => item.id === book.id);
  });

  const stock = Number(book.stock_quantity ?? 0);
  const outOfStock = stock <= 0;
  const capped = quantity >= stock;
  const label = stockState(book).label;

  const step = (delta) => {
    setError("");
    setNotice("");
    if (!capped && delta > 0) {
      setQuantity((q) => Math.min(stock, q + delta));
    } else if (delta < 0) {
      setQuantity((q) => Math.max(1, q + delta));
    }
    if (delta > 0 && capped) {
      setError(`Only ${stock} ${stock === 1 ? "copy" : "copies"} on the shelf.`);
    }
  };

  const add = (thenCheckout) => {
    if (outOfStock) return;
    const cart = readCart();
    const existing = cart.find((item) => item.id === book.id);
    const already = existing?.quantity ?? 0;

    if (already + quantity > stock) {
      const room = Math.max(0, stock - already);
      setError(
        room === 0
          ? `All ${stock} available ${stock === 1 ? "copy is" : "copies are"} already in your basket.`
          : `You can add ${room} more ${room === 1 ? "copy" : "copies"} — that is all we have.`
      );
      return;
    }

    const next = existing
      ? cart.map((item) =>
          item.id === book.id
            ? { ...item, quantity: item.quantity + quantity, stock_quantity: stock }
            : item
        )
      : [...cart, { ...book, quantity }];

    writeCart(next);
    setNotice(`Added ${quantity} ${quantity === 1 ? "copy" : "copies"} to your basket.`);
    setError("");
    if (thenCheckout) router.push("/checkout");
  };

  const toggleWishlist = () => {
    try {
      const list = readWishlist();
      const exists = list.some((item) => item.id === book.id);
      const next = exists ? list.filter((item) => item.id !== book.id) : [...list, book];
      localStorage.setItem("bh_wishlist", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("bh:cart-changed", { detail: { source: "book-page" } }));
      setWishlisted(!exists);
    } catch {}
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-control border border-line bg-white">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="w-11 h-12 flex items-center justify-center text-lg text-navy hover:bg-subtle disabled:text-muted/40 rounded-l-control"
          >
            <span aria-hidden="true">−</span>
          </button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={capped}
            aria-label="Increase quantity"
            className="w-11 h-12 flex items-center justify-center text-lg text-navy hover:bg-subtle disabled:text-muted/40 rounded-r-control"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <p className="text-xs text-muted">
          {outOfStock
            ? "This title is out of stock."
            : capped
              ? `${label} — that is all we have.`
              : `${label} — ready to ship.`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => add(false)}
          disabled={outOfStock}
          className="btn-primary flex-1 min-w-[10rem] text-sm disabled:bg-stone-300 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          {outOfStock ? "Out of stock" : "Add to basket"}
        </button>

        <button
          type="button"
          onClick={() => add(true)}
          disabled={outOfStock}
          className="btn-secondary flex-1 min-w-[10rem] text-sm disabled:text-muted/50 disabled:border-line disabled:cursor-not-allowed"
        >
          Buy now
        </button>

        <button
          type="button"
          onClick={toggleWishlist}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? "Remove from saved books" : "Save to saved books"}
          className={`w-12 h-12 shrink-0 rounded-control border flex items-center justify-center transition-colors ${
            wishlisted
              ? "border-sienna bg-sienna/10 text-sienna"
              : "border-line bg-white text-muted hover:border-navy hover:text-navy"
          }`}
        >
          <svg className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs font-medium text-success">
        {notice}
      </p>
      {error && (
        <p role="alert" className="text-xs font-medium text-error">{error}</p>
      )}

      {/* Mobile: the buy controls follow the reader down the page. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="text-base font-bold text-navy">{formatKsh(book.price)}</p>
          </div>
          <button
            type="button"
            onClick={() => add(false)}
            disabled={outOfStock}
            className="btn-primary ml-auto flex-1 max-w-[16rem] text-sm disabled:bg-stone-300 disabled:cursor-not-allowed"
          >
            {outOfStock ? "Out of stock" : "Add to basket"}
          </button>
        </div>
      </div>
    </>
  );
}
