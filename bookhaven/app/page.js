"use client";

import { useState, useMemo, useEffect } from "react";
import books from "./books";
import BookDetailPage, { BookCover } from "./components/BookCard";
import WishlistDrawer from "./components/WishlistDrawer";
import FilterPanel from "./components/FilterPanel";

// --- Icons ---
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

const StarIcon = () => (
  <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ReturnIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// --- Components ---

function AnnouncementBar() {
  return (
    <div className="bg-[#1C1917] text-white text-center py-2.5 text-sm font-medium">
      Free delivery within Nairobi on orders over KSh 3,000 · Nationwide shipping available
    </div>
  );
}

function Header({ searchQuery, setSearchQuery, cartCount, wishlistCount, onCartClick, onWishlistClick, onMenuClick }) {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-3xl">📚</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#1C1917] leading-none">Book Haven</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Kenya</p>
            </div>
          </div>

          {/* Search — Desktop */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or category..."
                className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-11 pr-4 py-3 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] transition"
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <SearchIcon />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-3">
            <button className="hidden sm:flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition">
              <span className="text-xs font-medium text-stone-600">Account</span>
            </button>
            <button className="hidden sm:flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition relative" onClick={onWishlistClick}>
              <HeartIcon filled={false} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#991B1B] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
              <span className="text-xs font-medium text-stone-600 mt-0.5">Wishlist</span>
            </button>
            <button
              onClick={onCartClick}
              className="flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition relative"
            >
              <div className="relative">
                <CartIcon />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#991B1B] text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-stone-600 mt-0.5">Cart</span>
            </button>
            <button onClick={onMenuClick} className="md:hidden p-2 hover:bg-stone-50 rounded-lg">
              <MenuIcon />
            </button>
          </div>
        </div>

        {/* Search — Mobile */}
        <div className="md:hidden pb-4">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-11 pr-4 py-3 text-sm outline-none focus:border-[#991B1B]"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
              <SearchIcon />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function CategoryNav({ selected, onSelect, categories }) {
  const handleSelect = (cat) => {
    onSelect(cat);
    setTimeout(() => {
      document.getElementById("books-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const categoryIcons = {
    All: "🏠", "Self-Help": "🌱", Finance: "💰", Productivity: "⚡",
    Psychology: "🧠", History: "🏛️", Philosophy: "💭", Fiction: "✨", Biography: "👤",
  };

  return (
    <nav className="bg-white border-b border-stone-200 hidden md:block">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 py-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelect(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                selected === cat
                  ? "bg-[#991B1B] text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-[#1C1917]"
              }`}
            >
              <span>{categoryIcons[cat] || "📖"}</span>
              {cat}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function HeroBanner({ onShopSale, onViewAll }) {
  return (
    <section className="bg-[#F5F5F4] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <span className="inline-block px-3 py-1 bg-[#991B1B]/10 text-[#991B1B] text-xs font-bold uppercase tracking-wider rounded-full mb-6">
              Summer Reading Sale
            </span>
            <h2 className="text-5xl lg:text-6xl font-bold text-[#1C1917] leading-[1.1]">
              Up to 40% Off <br />
              <span className="italic text-[#991B1B]">Bestselling</span> Titles
            </h2>
            <p className="mt-6 text-lg text-stone-600 max-w-lg leading-relaxed">
              Discover this season's most talked-about books. From gripping memoirs to life-changing self-help,
              find your next read at unbeatable prices.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <button onClick={onShopSale} className="btn-primary shadow-lg shadow-red-900/20">
                Shop the Sale
              </button>
              <button onClick={onViewAll} className="btn-secondary">
                View All Books
              </button>
            </div>
          </div>

          {/* Floating book covers */}
          <div className="hidden lg:flex justify-center gap-6" style={{ perspective: "1000px" }}>
            {[books[0], books[5], books[7]].map((book, i) => (
              <div
                key={book.id}
                className="w-44 rounded-r-md overflow-hidden"
                style={{
                  aspectRatio: "2/3",
                  boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 6px 12px 32px rgba(0,0,0,0.2)",
                  transform: `rotateY(-12deg) ${i === 1 ? "translateY(-28px)" : "translateY(10px)"}`,
                  transition: "transform 0.3s ease",
                }}
              >
                <BookCover book={book} className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterSortBar({ resultCount, sortBy, setSortBy }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200">
      <p className="text-stone-600 text-sm">
        Showing <span className="font-bold text-[#1C1917]">{resultCount}</span> results
      </p>
      <div className="flex items-center gap-3">
        <label className="text-sm text-stone-500">Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#991B1B]"
        >
          <option value="popular">Most Popular</option>
          <option value="newest">Newest</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BookCard — uses CSS cover, click opens detail
// ─────────────────────────────────────────────
function BookCard({ book, isWishlisted, onToggleWishlist, onAddToCart, onViewDetail }) {
  return (
    <div className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col">

      {/* Cover area — clickable */}
      <div
        className="relative bg-stone-100 p-6 flex justify-center cursor-pointer"
        onClick={() => onViewDetail(book)}
      >
        <div
          className="w-36 rounded-r-md overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
          style={{
            aspectRatio: "2/3",
            boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 24px rgba(0,0,0,0.15)",
          }}
        >
          <BookCover book={book} className="w-full h-full" />
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {book.badge && (
            <span className="px-2.5 py-1 bg-[#991B1B] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
              {book.badge}
            </span>
          )}
          {book.originalPrice && (
            <span className="px-2.5 py-1 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
              Save {Math.round((1 - book.price / book.originalPrice) * 100)}%
            </span>
          )}
        </div>

        {/* Wishlist button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(book); }}
          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-full shadow-md opacity-0 group-hover:opacity-100 transition hover:scale-110"
        >
          <HeartIcon filled={isWishlisted} />
        </button>

        {/* "Quick view" hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition duration-300">
          <span className="bg-[#1C1917]/80 text-white text-[10px] font-semibold px-3 py-1 rounded-full backdrop-blur-sm whitespace-nowrap">
            Click to view details
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
          </div>
          <span className="text-xs text-stone-500 ml-1">({book.reviews.toLocaleString()})</span>
        </div>

        <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">{book.category}</p>

        <h3
          className="text-base font-bold text-[#1C1917] leading-snug line-clamp-2 group-hover:text-[#991B1B] transition cursor-pointer"
          onClick={() => onViewDetail(book)}
        >
          {book.title}
        </h3>
        <p className="text-sm text-stone-500 mt-1">{book.author}</p>
        <p className="text-xs text-stone-400 mt-2">{book.format}</p>

        {book.stock !== "In Stock" && (
          <p className="text-xs text-amber-600 font-semibold mt-2">{book.stock}</p>
        )}

        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-[#1C1917]">KSh {book.price.toLocaleString()}</p>
            {book.originalPrice && (
              <p className="text-sm text-stone-400 line-through">KSh {book.originalPrice.toLocaleString()}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => onAddToCart(book)}
          className="w-full mt-4 bg-[#1C1917] hover:bg-[#991B1B] text-white py-3 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Add to Basket
        </button>
      </div>
    </div>
  );
}

function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onRemove, total }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl animate-slide-in-right flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917]">Your Basket</h2>
            <p className="text-sm text-stone-500 mt-1">{cart.reduce((a, b) => a + b.quantity, 0)} items</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition">
            <CloseIcon />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📖</div>
              <p className="text-stone-500 text-lg">Your basket is empty</p>
              <button onClick={onClose} className="mt-4 text-[#991B1B] font-semibold hover:underline">
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  {/* Mini CSS cover in cart */}
                  <div
                    className="w-20 flex-shrink-0 rounded-r-md overflow-hidden"
                    style={{
                      aspectRatio: "2/3",
                      boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 3px 6px 16px rgba(0,0,0,0.12)",
                    }}
                  >
                    <BookCover book={item} className="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[#1C1917] text-sm line-clamp-2">{item.title}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">{item.author}</p>
                    <p className="text-sm font-bold text-[#991B1B] mt-1">KSh {(item.price * item.quantity).toLocaleString()}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-stone-300 rounded-lg">
                        <button onClick={() => onUpdateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 text-stone-600 font-bold">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => onUpdateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 text-stone-600 font-bold">+</button>
                      </div>
                      <button onClick={() => onRemove(item.id)} className="text-xs text-stone-400 hover:text-red-600 underline">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
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
            <button className="w-full btn-primary py-4 text-base shadow-xl shadow-red-900/20">
              Proceed to Checkout →
            </button>
            <p className="text-center text-xs text-stone-400 mt-3">M-Pesa & Card accepted · Secure checkout</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedSection({ onViewDetail, onAddToCart, wishlist, onToggleWishlist }) {
  const picks = [
    { book: books[0], reason: "📈 Trending this week" },
    { book: books[5], reason: "⭐ Highest rated overall" },
    { book: books[7], reason: "❤️ Staff favourite" },
    { book: books[4], reason: "🏆 Award winning" },
  ];

  return (
    <section className="bg-white border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Curated For You</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917]">Recommended Reads</h2>
            <p className="text-stone-500 mt-2">Handpicked by our team based on what Kenyans are loving right now</p>
          </div>
          <button
            onClick={() => document.getElementById("books-grid")?.scrollIntoView({ behavior: "smooth" })}
            className="hidden sm:block text-sm font-bold text-[#991B1B] hover:underline"
          >
            View all books →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {picks.map(({ book, reason }) => {
            const isWishlisted = wishlist.some((b) => b.id === book.id);
            return (
              <div key={book.id} className="group bg-[#FAF8F5] rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-stone-100 flex flex-col">
                {/* Reason tag */}
                <div className="px-4 pt-4">
                  <span className="text-xs font-bold text-stone-500 bg-white border border-stone-200 px-3 py-1 rounded-full">
                    {reason}
                  </span>
                </div>

                {/* Cover */}
                <div
                  className="flex justify-center py-6 cursor-pointer"
                  onClick={() => onViewDetail(book)}
                >
                  <div
                    className="w-28 rounded-r-sm overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
                    style={{ aspectRatio: "2/3", boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 20px rgba(0,0,0,0.15)" }}
                  >
                    <BookCover book={book} className="w-full h-full" />
                  </div>
                </div>

                {/* Info */}
                <div className="px-4 pb-5 flex-1 flex flex-col">
                  <h3
                    className="font-bold text-[#1C1917] text-sm leading-snug cursor-pointer hover:text-[#991B1B] transition line-clamp-2"
                    onClick={() => onViewDetail(book)}
                  >
                    {book.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                    <span className="text-xs text-stone-400">({book.reviews.toLocaleString()})</span>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <p className="font-bold text-[#1C1917]">KSh {book.price.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onToggleWishlist(book)}
                        className={`p-1.5 rounded-lg border transition ${isWishlisted ? "border-red-200 bg-red-50 text-red-500" : "border-stone-200 text-stone-400 hover:border-[#991B1B] hover:text-[#991B1B]"}`}
                      >
                        <svg className="w-4 h-4" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onAddToCart(book)}
                        className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReviewsSection() {
  const reviews = [
    {
      name: "Wanjiru M.",
      location: "Nairobi",
      avatar: "W",
      avatarBg: "#991B1B",
      rating: 5,
      text: "Book Haven has completely changed how I shop for books. Ordered Atomic Habits on a Tuesday and it was at my door in Westlands by Thursday. The CSS covers on the site are actually genius — I knew exactly what I was buying!",
      book: "Atomic Habits",
      date: "2 weeks ago",
    },
    {
      name: "Otieno K.",
      location: "Kisumu",
      avatar: "O",
      avatarBg: "#0f3460",
      rating: 5,
      text: "Nationwide delivery to Kisumu — finally! I've been waiting for a Kenyan bookstore that actually ships outside Nairobi. Got The Psychology of Money in 4 days. Packaging was perfect, book arrived in great condition.",
      book: "The Psychology of Money",
      date: "1 month ago",
    },
    {
      name: "Amina H.",
      location: "Mombasa",
      avatar: "A",
      avatarBg: "#2d4a22",
      rating: 5,
      text: "The wishlist feature is so useful! I saved 6 books, shared the list with my husband, and he ordered them all as a birthday surprise. The M-Pesa checkout made it so easy for him. Highly recommend!",
      book: "Multiple titles",
      date: "3 weeks ago",
    },
    {
      name: "Brian N.",
      location: "Nakuru",
      avatar: "B",
      avatarBg: "#7b2d00",
      rating: 4,
      text: "Great selection and competitive prices compared to other online options. Sapiens was KSh 500 cheaper here than what I found elsewhere. Will definitely be back for more books this month.",
      book: "Sapiens",
      date: "2 months ago",
    },
    {
      name: "Fatuma A.",
      location: "Eldoret",
      avatar: "F",
      avatarBg: "#1a3a4a",
      rating: 5,
      text: "As a teacher I order books regularly. Book Haven's bulk pricing and fast delivery to Eldoret has made my life so much easier. The search and filter tools help me find exactly what I need quickly.",
      book: "Multiple titles",
      date: "1 week ago",
    },
    {
      name: "David M.",
      location: "Nairobi",
      avatar: "D",
      avatarBg: "#111111",
      rating: 5,
      text: "Can't Hurt Me arrived in 2 days — faster than I expected. The book detail page had everything I needed to make my decision. This is genuinely the best online bookstore experience I've had in Kenya.",
      book: "Can't Hurt Me",
      date: "3 days ago",
    },
  ];

  const Stars = ({ count }) => (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < count ? "text-amber-400 fill-amber-400" : "text-stone-200 fill-stone-200"}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  return (
    <section className="bg-[#FAF8F5] border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Happy Readers</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917]">What Kenyans Are Saying</h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="font-bold text-[#1C1917]">4.9 out of 5</span>
            <span className="text-stone-400 text-sm">· 2,400+ verified readers</span>
          </div>
        </div>

        {/* Review grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200 p-6 hover:shadow-md transition-shadow duration-300 flex flex-col">
              {/* Quote mark */}
              <div className="text-4xl font-black text-stone-100 leading-none mb-3 select-none">"</div>

              <p className="text-stone-600 text-sm leading-relaxed flex-1">{r.text}</p>

              <div className="mt-5 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                      style={{ backgroundColor: r.avatarBg }}
                    >
                      {r.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-[#1C1917] text-sm">{r.name}</p>
                      <p className="text-xs text-stone-400">{r.location} · {r.date}</p>
                    </div>
                  </div>
                  <Stars count={r.rating} />
                </div>
                <p className="text-xs text-stone-400 mt-2 ml-12">
                  Purchased: <span className="font-medium text-stone-500">{r.book}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const stats = [
    { value: "6+", label: "Years in Kenya" },
    { value: "15K+", label: "Happy Readers" },
    { value: "2,000+", label: "Titles in Stock" },
    { value: "47", label: "Counties Reached" },
  ];

  const team = [
    { name: "Grace Wambui", role: "Founder & CEO", initial: "G", bg: "#991B1B", desc: "Former librarian turned entrepreneur. Passionate about making reading accessible to every Kenyan." },
    { name: "James Odhiambo", role: "Head of Curation", initial: "J", bg: "#0f3460", desc: "Reads 4 books a month. Personally selects every title that makes it into our catalogue." },
    { name: "Aisha Mwangi", role: "Customer Experience", initial: "A", bg: "#2d4a22", desc: "Makes sure every order arrives on time and every customer leaves happy. Our 4.9★ rating is her doing." },
  ];

  return (
    <section id="about" className="bg-white border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* About intro */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Our Story</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917] leading-tight">
              Kenya's Home for <br />
              <span className="italic text-[#991B1B]">Great Books</span>
            </h2>
            <p className="mt-6 text-stone-600 leading-relaxed">
              Book Haven started in 2018 from a small room in Nairobi's South B estate. Our founder Grace noticed that Kenyans who loved reading had to either pay import prices or hunt through second-hand markets. She decided to fix that.
            </p>
            <p className="mt-4 text-stone-600 leading-relaxed">
              Today we stock over 2,000 titles, deliver to all 47 counties, and have helped more than 15,000 Kenyans build their personal libraries — one book at a time.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="mailto:hello@bookhaven.co.ke" className="btn-primary">
                Get in Touch
              </a>
              <button
                onClick={() => document.getElementById("books-grid")?.scrollIntoView({ behavior: "smooth" })}
                className="btn-secondary"
              >
                Shop Now
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-[#FAF8F5] rounded-2xl p-8 text-center border border-stone-100">
                <p className="text-4xl font-black text-[#991B1B]">{value}</p>
                <p className="text-stone-500 text-sm font-medium mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div>
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">The People Behind It</span>
            <h3 className="text-2xl lg:text-3xl font-bold text-[#1C1917]">Meet the Team</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {team.map((member) => (
              <div key={member.name} className="bg-[#FAF8F5] rounded-2xl border border-stone-100 p-8 text-center hover:shadow-md transition-shadow duration-300">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto mb-5 shadow-lg"
                  style={{ backgroundColor: member.bg }}
                >
                  {member.initial}
                </div>
                <h4 className="font-bold text-[#1C1917] text-lg">{member.name}</h4>
                <p className="text-[#991B1B] text-sm font-semibold mt-1">{member.role}</p>
                <p className="text-stone-500 text-sm leading-relaxed mt-3">{member.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact strip */}
        <div id="contact" className="mt-16 bg-[#1C1917] rounded-3xl p-10 grid md:grid-cols-3 gap-8 text-center">
          {[
            { icon: "📧", label: "Email Us", value: "hello@bookhaven.co.ke", sub: "We reply within 24 hours" },
            { icon: "📞", label: "Call / WhatsApp", value: "+254 712 345 678", sub: "Mon–Sat, 9am–7pm" },
            { icon: "📍", label: "Visit Us", value: "The Junction Mall, Nairobi", sub: "Ground floor, Shop G14" },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="text-white">
              <div className="text-3xl mb-3">{icon}</div>
              <p className="text-stone-400 text-xs uppercase tracking-wider font-bold mb-1">{label}</p>
              <p className="font-bold text-lg">{value}</p>
              <p className="text-stone-400 text-sm mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBadges() {
  const badges = [
    { icon: <TruckIcon />, title: "Free Delivery", desc: "Within Nairobi over KSh 3,000" },
    { icon: <ReturnIcon />, title: "Easy Returns", desc: "30-day return policy" },
    { icon: <ShieldIcon />, title: "Secure Payment", desc: "M-Pesa & Card accepted" },
  ];
  return (
    <section className="bg-white border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {badges.map((b, i) => (
            <div key={i} className="flex items-center gap-4 justify-center md:justify-start">
              <div className="p-3 bg-stone-50 rounded-xl">{b.icon}</div>
              <div>
                <h4 className="font-bold text-[#1C1917]">{b.title}</h4>
                <p className="text-sm text-stone-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) { setSubscribed(true); setEmail(""); }
  };

  return (
    <section className="bg-[#1C1917] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Join Our Reading Community</h2>
        <p className="text-stone-400 max-w-xl mx-auto mb-8">
          Get weekly book recommendations, author interviews, and exclusive member discounts.
        </p>
        {subscribed ? (
          <p className="text-green-400 font-semibold text-lg">✓ You're in! Check your inbox soon.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-stone-500 outline-none focus:border-[#991B1B]"
            />
            <button
              onClick={handleSubmit}
              className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white px-6 py-3 rounded-lg font-bold transition"
            >
              Subscribe
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-stone-200 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-black text-[#1C1917]">Book Haven</span>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed mb-4">
              Kenya's trusted online bookstore since 2018. We deliver quality books nationwide with care.
            </p>
            <div className="flex gap-3">
              {["X", "IG", "FB"].map((s) => (
                <button key={s} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-[#1C1917] hover:text-white flex items-center justify-center text-xs font-bold transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Shop</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              {["Bestsellers", "New Arrivals", "Coming Soon", "Gift Cards", "Collections"].map((l) => (
                <li key={l} className="hover:text-[#991B1B] cursor-pointer transition">{l}</li>
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
            <span className="hover:text-[#1C1917] cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#1C1917] cursor-pointer">Terms of Service</span>
            <span className="hover:text-[#1C1917] cursor-pointer">Cookie Settings</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-6 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 whitespace-nowrap">
      <span className="text-green-400 text-lg">✓</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// --- Main Page ---
export default function Home() {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({
    priceMax: 2500,
    formats: [],
    minRating: null,
    onSaleOnly: false,
  });
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null); // ← detail modal

  // Persist cart & wishlist
  useEffect(() => {
    const savedCart = localStorage.getItem("bh_cart");
    const savedWishlist = localStorage.getItem("bh_wishlist");
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
  }, []);
  useEffect(() => { localStorage.setItem("bh_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("bh_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // Close detail modal on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setSelectedBook(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const categories = useMemo(() => ["All", ...new Set(books.map((b) => b.category))], []);

  const filteredBooks = useMemo(() => {
    let result = books.filter((book) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        (book.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === "All" || book.category === selectedCategory;
      const matchesPrice = book.price <= filters.priceMax;
      const matchesFormat = filters.formats.length === 0 || filters.formats.includes(book.format);
      const matchesRating = filters.minRating === null || book.rating >= filters.minRating;
      const matchesSale = !filters.onSaleOnly || book.originalPrice !== null;
      return matchesSearch && matchesCategory && matchesPrice && matchesFormat && matchesRating && matchesSale;
    });
    switch (sortBy) {
      case "price-low": result.sort((a, b) => a.price - b.price); break;
      case "price-high": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "newest": result.sort((a, b) => b.id - a.id); break;
      default: break;
    }
    return result;
  }, [searchQuery, selectedCategory, sortBy, filters]);

  const addToCart = (book) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === book.id);
      if (existing) return prev.map((item) => item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...book, quantity: 1 }];
    });
    showToast(`"${book.title}" added to basket`);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const toggleWishlist = (book) => {
    setWishlist((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      showToast(exists ? "Removed from wishlist" : "Added to wishlist ♡");
      return exists ? prev.filter((b) => b.id !== book.id) : [...prev, book];
    });
  };

  const showToast = (msg) => setToast(msg);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const updateFilter = (key, val) => setFilters((p) => ({ ...p, [key]: val }));
  const resetFilters = () => setFilters({ priceMax: 2500, formats: [], minRating: null, onSaleOnly: false });

  const scrollToBooks = () => {
    document.getElementById("books-grid")?.scrollIntoView({ behavior: "smooth" });
  };

  const filterSale = () => {
    setSortBy("price-low");
    setSelectedCategory("All");
    scrollToBooks();
  };

  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <AnnouncementBar />

      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        onCartClick={() => setIsCartOpen(true)}
        onWishlistClick={() => setIsWishlistOpen(true)}
        onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Mobile Category Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-stone-200 p-4 animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setMobileMenuOpen(false);
                  setTimeout(() => document.getElementById("books-grid")?.scrollIntoView({ behavior: "smooth" }), 50);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === cat ? "bg-[#991B1B] text-white" : "bg-stone-100 text-stone-700"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <CategoryNav selected={selectedCategory} onSelect={setSelectedCategory} categories={categories} />
      <HeroBanner onShopSale={filterSale} onViewAll={scrollToBooks} />
      <FilterSortBar resultCount={filteredBooks.length} sortBy={sortBy} setSortBy={setSortBy} />

      {/* Books section — sidebar + grid */}
      <section id="books-grid" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-8 items-start">

          {/* Filter sidebar — desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <FilterPanel
              filters={filters}
              onChange={updateFilter}
              onReset={resetFilters}
              resultCount={filteredBooks.length}
              isOpen={true}
              onToggle={() => {}}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Mobile filter panel */}
            <div className="lg:hidden mb-2">
              <FilterPanel
                filters={filters}
                onChange={updateFilter}
                onReset={resetFilters}
                resultCount={filteredBooks.length}
                isOpen={filterPanelOpen}
                onToggle={() => setFilterPanelOpen((o) => !o)}
              />
            </div>

            {/* Sort bar — desktop inline */}
            <div className="hidden lg:flex items-center justify-between mb-6">
              <p className="text-stone-600 text-sm">
                Showing <span className="font-bold text-[#1C1917]">{filteredBooks.length}</span> results
              </p>
              <div className="flex items-center gap-3">
                <label className="text-sm text-stone-500">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#991B1B]"
                >
                  <option value="popular">Most Popular</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            {/* Mobile sort */}
            <div className="lg:hidden flex items-center justify-end mb-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#991B1B]"
              >
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price ↑</option>
                <option value="price-high">Price ↓</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>

            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    isWishlisted={wishlist.some((b) => b.id === book.id)}
                    onToggleWishlist={toggleWishlist}
                    onAddToCart={addToCart}
                    onViewDetail={setSelectedBook}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-[#1C1917] mb-2">No books found</h3>
                <p className="text-stone-500 mb-4">Try adjusting your search, category, or filters</p>
                <button
                  onClick={() => { setSearchQuery(""); setSelectedCategory("All"); resetFilters(); }}
                  className="btn-primary"
                >
                  Clear Everything
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <RecommendedSection
        onViewDetail={setSelectedBook}
        onAddToCart={addToCart}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
      />
      <ReviewsSection />
      <AboutSection />
      <TrustBadges />
      <Newsletter />
      <Footer />

      {/* Wishlist Drawer */}
      <WishlistDrawer
        wishlist={wishlist}
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        onRemove={(id) => {
          setWishlist((prev) => prev.filter((b) => b.id !== id));
          showToast("Removed from wishlist");
        }}
        onAddToCart={(book) => { addToCart(book); setIsWishlistOpen(false); }}
        onViewDetail={setSelectedBook}
      />

      {/* Cart Drawer */}
      <CartDrawer
        cart={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        total={cartTotal}
      />

      {/* Book Detail Modal */}
      <BookDetailPage
        book={selectedBook}
        isWishlisted={selectedBook ? wishlist.some((b) => b.id === selectedBook.id) : false}
        onToggleWishlist={toggleWishlist}
        onAddToCart={addToCart}
        onClose={() => setSelectedBook(null)}
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </main>
  );
}