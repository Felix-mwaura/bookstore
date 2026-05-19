"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCover } from "./BookCard";
import WishlistDrawer from "./WishlistDrawer";

// ── Icons ──────────────────────────────────────────────
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg className={`w-6 h-6 ${filled ? "text-red-600 fill-red-600" : "text-stone-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CartIcon = () => (
  <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

function AccountLink() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const u = localStorage.getItem("bh_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);
  if (user) return (
    <Link href="/account"
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:text-[#991B1B] hover:bg-stone-50 rounded-lg transition">
      <div className="w-6 h-6 rounded-full bg-[#991B1B] flex items-center justify-center text-white text-[10px] font-bold">
        {user.name?.charAt(0).toUpperCase()}
      </div>
      {user.name}
    </Link>
  );
  return (
    <Link href="/login"
      className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-[#991B1B] hover:bg-stone-50 rounded-lg transition">
      Sign In
    </Link>
  );
}

export const categoryIcons = {  All: "🏠", "Self-Help": "🌱", Finance: "💰", Productivity: "⚡",
  Psychology: "🧠", History: "🏛️", Philosophy: "💭", Fiction: "✨", Biography: "👤",
};

export const categories = ["All", "Self-Help", "Finance", "Productivity", "Psychology", "History", "Philosophy", "Fiction", "Biography"];

// ── Cart Drawer ─────────────────────────────────────────
export function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onRemove, total }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917]">Your Basket</h2>
            <p className="text-sm text-stone-500 mt-1">{cart.reduce((a, b) => a + b.quantity, 0)} items</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📖</div>
              <p className="text-stone-500 text-lg">Your basket is empty</p>
              <button onClick={onClose} className="mt-4 text-[#991B1B] font-semibold hover:underline">Continue Shopping</button>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-20 flex-shrink-0 rounded-r-md overflow-hidden" style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 3px 6px 16px rgba(0,0,0,0.12)" }}>
                    <BookCover book={item} className="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[#1C1917] text-sm line-clamp-2">{item.title}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">{item.author}</p>
                    <p className="text-sm font-bold text-[#991B1B] mt-1">KSh {(item.price * item.quantity).toLocaleString()}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-stone-300 rounded-lg">
                        <button onClick={() => onUpdateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 font-bold">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => onUpdateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 font-bold">+</button>
                      </div>
                      <button onClick={() => onRemove(item.id)} className="text-xs text-stone-400 hover:text-red-600 underline">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-stone-200 p-6 bg-stone-50">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-stone-600">Subtotal</span>
              <span className="font-semibold">KSh {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-stone-600">Delivery</span>
              <span className="font-semibold text-green-700">Calculated at checkout</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-stone-200 pt-3 mb-5">
              <span>Total</span>
              <span>KSh {total.toLocaleString()}</span>
            </div>
            <Link href="/checkout" onClick={onClose} className="block w-full bg-[#1C1917] hover:bg-[#991B1B] text-white py-4 rounded-xl font-bold text-center transition-all duration-200">
              Proceed to Checkout →
            </Link>
            <p className="text-center text-xs text-stone-400 mt-3">M-Pesa & Card accepted · Secure checkout</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Store Header ─────────────────────────────────
export function StoreHeader({ cartCount, wishlistCount, onCartClick, onWishlistClick }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e) => {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/books?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      <div className="bg-[#1C1917] text-white text-center py-2.5 text-sm font-medium">
        Free delivery within Nairobi on orders over KSh 3,000 · Nationwide shipping available
      </div>
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
              <span className="text-3xl">📚</span>
              <div>
                <p className="text-2xl font-black tracking-tight text-[#1C1917] leading-none group-hover:text-[#991B1B] transition">Book Haven</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Kenya</p>
              </div>
            </Link>

            {/* Nav links — desktop */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link href="/books" className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-[#991B1B] hover:bg-stone-50 rounded-lg transition">All Books</Link>
              {["Self-Help", "Finance", "Fiction", "Biography"].map((cat) => (
                <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-[#991B1B] hover:bg-stone-50 rounded-lg transition">
                  {categoryIcons[cat]} {cat}
                </Link>
              ))}
              <Link href="/#about" className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-[#991B1B] hover:bg-stone-50 rounded-lg transition">About</Link>
              <AccountLink />
            </nav>

            {/* Search — Desktop */}
            <div className="hidden md:flex flex-1 max-w-sm mx-4">
              <div className="relative w-full">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  placeholder="Search books... (Enter)"
                  className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] transition"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  <SearchIcon />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={onWishlistClick} className="hidden sm:flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition relative">
                <HeartIcon filled={wishlistCount > 0} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#991B1B] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">{wishlistCount}</span>
                )}
                <span className="text-xs font-medium text-stone-600 mt-0.5">Wishlist</span>
              </button>
              <button onClick={onCartClick} className="flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition relative">
                <div className="relative">
                  <CartIcon />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#991B1B] text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">{cartCount}</span>
                  )}
                </div>
                <span className="text-xs font-medium text-stone-600 mt-0.5">Cart</span>
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 hover:bg-stone-50 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-4">
            <div className="relative w-full">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleSearch}
                placeholder="Search books... (Enter to search)"
                className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B]" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"><SearchIcon /></div>
            </div>
          </div>
        </div>

        {/* Mobile nav menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-stone-100 px-4 pb-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-2 pt-3">
              <Link href="/books" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100 transition">
                🏠 All Books
              </Link>
              {categories.filter(c => c !== "All").map((cat) => (
                <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100 transition">
                  {categoryIcons[cat]} {cat}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

// ── Shared Footer ───────────────────────────────────────
export function StoreFooter() {
  return (
    <footer className="bg-white border-t border-stone-200 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-black text-[#1C1917]">Book Haven</span>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed mb-4">Kenya's trusted online bookstore since 2018. We deliver quality books nationwide with care.</p>
            <div className="flex gap-3">
              {["X", "IG", "FB"].map((s) => (
                <button key={s} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-[#1C1917] hover:text-white flex items-center justify-center text-xs font-bold transition">{s}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Shop</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              {[["All Books", "/books"], ["Self-Help", "/category/self-help"], ["Finance", "/category/finance"], ["Fiction", "/category/fiction"], ["Biography", "/category/biography"]].map(([l, href]) => (
                <li key={l}><Link href={href} className="hover:text-[#991B1B] transition">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Help</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              {["Delivery Info", "Returns Policy", "Order Tracking", "FAQs", "Contact Us"].map((l) => (
                <li key={l} className="hover:text-[#991B1B] cursor-pointer transition">{l}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              <li>hello@bookhaven.co.ke</li>
              <li>+254 712 345 678</li>
              <li>The Junction Mall, Nairobi</li>
              <li>Mon–Sat: 9am–7pm</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-stone-400">© 2026 Book Haven Kenya. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-stone-400">
            {["Privacy Policy", "Terms of Service", "Cookie Settings"].map((l) => (
              <span key={l} className="hover:text-[#1C1917] cursor-pointer">{l}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── useStore hook — shared cart + wishlist state ────────
export function useStore() {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem("bh_cart");
      const w = localStorage.getItem("bh_wishlist");
      if (c) setCart(JSON.parse(c));
      if (w) setWishlist(JSON.parse(w));
    } catch {}
  }, []);

  useEffect(() => { localStorage.setItem("bh_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("bh_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedBook(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const addToCart = (book) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === book.id);
      if (exists) return prev.map((i) => i.id === book.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...book, quantity: 1 }];
    });
    showToast(`"${book.title}" added to basket`);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const updateQty = (id, delta) => setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

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

  return {
    cart, wishlist, isCartOpen, isWishlistOpen, toast, selectedBook,
    setIsCartOpen, setIsWishlistOpen, setSelectedBook,
    addToCart, removeFromCart, updateQty, toggleWishlist, cartTotal, cartCount,
  };
}

// ── StoreShell — wraps any page with header + drawers ──
export default function StoreShell({ children }) {
  const store = useStore();

  return (
    <>
      <StoreHeader
        cartCount={store.cartCount}
        wishlistCount={store.wishlist.length}
        onCartClick={() => store.setIsCartOpen(true)}
        onWishlistClick={() => store.setIsWishlistOpen(true)}
      />

      {/* Pass store down via a context-like pattern using cloneElement */}
      {typeof children === "function" ? children(store) : children}

      <WishlistDrawer
        wishlist={store.wishlist}
        isOpen={store.isWishlistOpen}
        onClose={() => store.setIsWishlistOpen(false)}
        onRemove={(id) => { store.setWishlist?.((p) => p.filter((b) => b.id !== id)); }}
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
    </>
  );
}