"use client";

import { useStore, StoreHeader, StoreFooter, CartDrawer } from "./StoreShell";
import WishlistDrawer from "./WishlistDrawer";

// Chrome for server-rendered pages (/books/[slug], /orders/[id]).
//
// Those pages are rendered on the server for SEO and speed, but the header,
// cart drawer, wishlist and toast all need browser state. Wrapping them here
// keeps one implementation of that chrome instead of the copy each client
// page used to carry.
export default function StoreLayout({ children }) {
  const store = useStore();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      <StoreHeader
        cartCount={store.cartCount}
        wishlistCount={store.wishlist.length}
        onCartClick={() => store.setIsCartOpen(true)}
        onWishlistClick={() => store.setIsWishlistOpen(true)}
      />

      <main className="flex-1">{children}</main>

      <StoreFooter />

      <WishlistDrawer
        wishlist={store.wishlist}
        isOpen={store.isWishlistOpen}
        onClose={() => store.setIsWishlistOpen(false)}
        onRemove={(id) => store.toggleWishlist(store.wishlist.find((b) => b.id === id))}
        onAddToCart={(book) => { store.addToCart(book); store.setIsWishlistOpen(false); }}
        onViewDetail={() => {}}
      />

      <CartDrawer
        cart={store.cart}
        isOpen={store.isCartOpen}
        onClose={() => store.setIsCartOpen(false)}
        onUpdateQty={store.updateQty}
        onRemove={store.removeFromCart}
        total={store.cartTotal}
      />

      {store.toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-5 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 max-w-[90vw]"
        >
          <span className="text-green-400">✓</span>
          <span className="text-sm font-medium truncate">{store.toast}</span>
        </div>
      )}
    </div>
  );
}
