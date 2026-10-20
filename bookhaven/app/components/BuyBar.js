"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function BuyBar({ book }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [wishlisted, setWishlisted] = useState(false);

  const stock = Number(book.stock_quantity ?? 0);
  const outOfStock = stock <= 0;

  const add = (thenCheckout) => {
    const cart = readCart();
    const existing = cart.find((i) => i.id === book.id);
    const already = existing?.quantity ?? 0;

    if (already >= stock) {
      setNotice(`You already have all ${stock} available copies in your basket.`);
      return;
    }

    const next = existing
      ? cart.map((i) => (i.id === book.id ? { ...i, quantity: i.quantity + 1, stock_quantity: stock } : i))
      : [...cart, { ...book, quantity: 1 }];

    writeCart(next);
    setNotice("");
    if (thenCheckout) router.push("/checkout");
  };

  const toggleWishlist = () => {
    try {
      const raw = localStorage.getItem("bh_wishlist");
      const list = raw ? JSON.parse(raw) : [];
      const exists = list.some((b) => b.id === book.id);
      const next = exists ? list.filter((b) => b.id !== book.id) : [...list, book];
      localStorage.setItem("bh_wishlist", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("bh:cart-changed", { detail: { source: "book-page" } }));
      setWishlisted(!exists);
    } catch {}
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => add(false)}
          disabled={outOfStock}
          className="flex-1 bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold transition active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          {outOfStock ? "Out of stock" : "Add to Basket"}
        </button>

        <button
          type="button"
          onClick={() => add(true)}
          disabled={outOfStock}
          className="flex-1 border-2 border-[#1C1917] text-[#1C1917] hover:bg-[#1C1917] hover:text-white disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-transparent py-4 rounded-xl font-bold transition active:scale-[0.98]"
        >
          Buy Now
        </button>

        <button
          type="button"
          onClick={toggleWishlist}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          className={`w-full sm:w-16 h-14 rounded-xl border-2 flex items-center justify-center transition ${
            wishlisted ? "bg-red-50 border-red-200 text-red-500" : "border-stone-200 text-stone-400 hover:border-[#991B1B] hover:text-[#991B1B]"
          }`}
        >
          <svg className="w-6 h-6" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <p role="status" aria-live="polite" className="text-xs text-amber-700 mt-2 min-h-[1rem]">
        {notice}
      </p>
    </div>
  );
}
