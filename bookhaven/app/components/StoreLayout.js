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
    <div className="min-h-screen bg-[#FAF6EE] flex flex-col">
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
        onRemove={(id) => {
          const book = store.wishlist.find((b) => b.id === id);
          if (book) store.toggleWishlist(book);
        }}
        onAddToCart={(book) => { store.addToCart(book); store.setIsWishlistOpen(false); }}
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
        /* The animation owns the transform, so centring happens on the
           wrapper and the visible card is free to rise on its own. */
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className="animate-rise-3d flex max-w-full items-center gap-3 rounded-lg bg-navy px-5 py-3 text-white shadow-2xl"
          >
            <span aria-hidden="true" className="text-green-400">✓</span>
            <span className="truncate text-sm font-medium">{store.toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
