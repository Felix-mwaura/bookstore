"use client";

import { useStore } from "./StoreContext";
import { StoreHeader, StoreFooter, CartDrawer } from "./StoreShell";
import WishlistDrawer from "./WishlistDrawer";

export default function AppShell({ children, showFooter = true }) {
  const store = useStore();

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <StoreHeader
        cartCount={store.cartCount}
        wishlistCount={store.wishlist.length}
        onCartClick={() => store.setIsCartOpen(true)}
        onWishlistClick={() => store.setIsWishlistOpen(true)}
      />
      
      <main>{children}</main>
      
      {showFooter && <StoreFooter />}

      <WishlistDrawer
        wishlist={store.wishlist}
        isOpen={store.isWishlistOpen}
        onClose={() => store.setIsWishlistOpen(false)}
        onRemove={(id) => store.toggleWishlist(store.wishlist.find(b => b.id === id))}
        onAddToCart={(book) => { store.addToCart(book); store.setIsWishlistOpen(false); }}
        onViewDetail={store.setSelectedBook}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-6 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 whitespace-nowrap">
          <span className="text-green-400 text-lg">✓</span>
          <span className="text-sm font-medium">{store.toast}</span>
        </div>
      )}
    </div>
  );
}