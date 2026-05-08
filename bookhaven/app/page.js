"use client";

import { useState, useMemo, useEffect } from "react";
import books from "./books";

// --- Icons ---
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);

const HeartIcon = ({ filled }) => (
  <svg className={`w-6 h-6 ${filled ? "text-red-600 fill-red-600" : "text-stone-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
);

const CartIcon = () => (
  <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
);

const StarIcon = () => (
  <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);

const TruckIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
);

const ShieldIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);

const ReturnIcon = () => (
  <svg className="w-8 h-8 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
);

// --- Components ---

function AnnouncementBar() {
  return (
    <div className="bg-[#1C1917] text-white text-center py-2.5 text-sm font-medium">
      Free delivery within Nairobi on orders over KSh 3,000 · Nationwide shipping available
    </div>
  );
}

function Header({ searchQuery, setSearchQuery, cartCount, wishlistCount, onCartClick, onMenuClick }) {
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

          {/* Search - Desktop */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
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
            <button className="hidden sm:flex flex-col items-center p-2 hover:bg-stone-50 rounded-lg transition relative">
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

        {/* Search - Mobile */}
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
  return (
    <nav className="bg-white border-b border-stone-200 hidden md:block">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 py-3 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                selected === cat
                  ? "bg-[#991B1B] text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-[#1C1917]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function HeroBanner() {
  return (
    <section className="bg-[#F5F5F4] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <span className="inline-block px-3 py-1 bg-[#991B1B]/10 text-[#991B1B] text-xs font-bold uppercase tracking-wider rounded-full mb-6">
              Summer Reading Sale
            </span>
            <h2 className="text-5xl lg:text-6xl font-bold text-[#1C1917] leading-[1.1]">
              Up to 40% Off <br/>
              <span className="italic text-[#991B1B]">Bestselling</span> Titles
            </h2>
            <p className="mt-6 text-lg text-stone-600 max-w-lg leading-relaxed">
              Discover this season's most talked-about books. From gripping memoirs to life-changing self-help, find your next read at unbeatable prices.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <button className="btn-primary shadow-lg shadow-red-900/20">Shop the Sale</button>
              <button className="btn-secondary">View New Arrivals</button>
            </div>
          </div>
<div className="hidden lg:flex justify-center gap-6" style={{ perspective: '1000px' }}>            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className={`w-48 book-shadow rounded-r-lg overflow-hidden bg-white transform ${i === 1 ? '-translate-y-8' : 'translate-y-4'}`}
                style={{ transform: `rotateY(-15deg) ${i === 1 ? 'translateY(-30px)' : 'translateY(10px)'}` }}
              >
                <div className="book-cover">
                  <div className="book-spine" />
                  <img 
                    src={`https://covers.openlibrary.org/b/isbn/${books[i].isbn}-L.jpg`} 
                    alt={books[i].title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/400x600/991B1B/FFFFFF?text=${encodeURIComponent(books[i].title)}`;
                    }}
                  />
                </div>
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

function BookCard({ book, isWishlisted, onToggleWishlist, onAddToCart }) {
  const [imgError, setImgError] = useState(false);
  
  return (
    <div className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative bg-stone-100 p-6 flex justify-center">
        <div className="w-36 book-shadow rounded-r-md overflow-hidden relative transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500">
          <div className="book-spine" />
          <div className="book-cover bg-stone-200">
            {!imgError ? (
              <img 
                src={`https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-[#991B1B] flex items-center justify-center p-4 text-center">
                <span className="text-white font-bold text-sm leading-tight">{book.title}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {book.badge && (
            <span className="px-2.5 py-1 bg-[#991B1B] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
              {book.badge}
            </span>
          )}
          {book.originalPrice && (
            <span className="px-2.5 py-1 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
              Save {Math.round((1 - book.price/book.originalPrice)*100)}%
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button 
          onClick={() => onToggleWishlist(book)}
          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-full shadow-md opacity-0 group-hover:opacity-100 transition hover:scale-110"
        >
          <HeartIcon filled={isWishlisted} />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} />
            ))}
          </div>
          <span className="text-xs text-stone-500 ml-1">({book.reviews.toLocaleString()})</span>
        </div>

        <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">{book.category}</p>
        
        <h3 className="text-base font-bold text-[#1C1917] leading-snug line-clamp-2 group-hover:text-[#991B1B] transition">
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
          <CartIcon />
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
            <p className="text-sm text-stone-500 mt-1">{cart.reduce((a,b) => a + b.quantity, 0)} items</p>
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
                  <div className="w-20 h-28 flex-shrink-0 book-shadow rounded-r-md overflow-hidden relative bg-stone-100">
                    <div className="book-spine" />
                    <img 
                      src={`https://covers.openlibrary.org/b/isbn/${item.isbn}-L.jpg`} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.classList.add('bg-[#991B1B]', 'flex', 'items-center', 'justify-center');
                        e.target.parentElement.innerHTML += `<span class="text-white text-[10px] font-bold p-2 text-center">${item.title}</span>`;
                      }}
                    />
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
              Proceed to Checkout
            </button>
            <p className="text-center text-xs text-stone-400 mt-3">Shipping & taxes calculated at checkout</p>
          </div>
        )}
      </div>
    </div>
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
  return (
    <section className="bg-[#1C1917] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Join Our Reading Community</h2>
        <p className="text-stone-400 max-w-xl mx-auto mb-8">Get weekly book recommendations, author interviews, and exclusive member discounts delivered to your inbox.</p>
        <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input 
            type="email" 
            placeholder="Your email address"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-stone-500 outline-none focus:border-[#991B1B]"
          />
          <button className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white px-6 py-3 rounded-lg font-bold transition">
            Subscribe
          </button>
        </form>
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
              {['X', 'IG', 'FB'].map(s => (
                <button key={s} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-[#1C1917] hover:text-white flex items-center justify-center text-xs font-bold transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Shop</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              {['Bestsellers', 'New Arrivals', 'Coming Soon', 'Gift Cards', 'Collections'].map(l => (
                <li key={l} className="hover:text-[#991B1B] cursor-pointer transition">{l}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-[#1C1917] mb-4">Help</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              {['Delivery Info', 'Returns Policy', 'Order Tracking', 'FAQs', 'Contact Us'].map(l => (
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-[#1C1917] text-white px-6 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("bh_cart");
    const savedWishlist = localStorage.getItem("bh_wishlist");
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
  }, []);

  useEffect(() => {
    localStorage.setItem("bh_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("bh_wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  const categories = useMemo(() => ["All", ...new Set(books.map(b => b.category))], []);

  const filteredBooks = useMemo(() => {
    let result = books.filter(book => {
      const matchesSearch = 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || book.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    switch(sortBy) {
      case "price-low": result.sort((a,b) => a.price - b.price); break;
      case "price-high": result.sort((a,b) => b.price - a.price); break;
      case "rating": result.sort((a,b) => b.rating - a.rating); break;
      case "newest": result.sort((a,b) => b.id - a.id); break;
      default: break;
    }
    
    return result;
  }, [searchQuery, selectedCategory, sortBy]);

  const addToCart = (book) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === book.id);
      if (existing) {
        return prev.map(item => item.id === book.id ? {...item, quantity: item.quantity + 1} : item);
      }
      return [...prev, {...book, quantity: 1}];
    });
    setToast(`Added "${book.title}" to basket`);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return {...item, quantity: newQty};
      }
      return item;
    }));
  };

  const toggleWishlist = (book) => {
    setWishlist(prev => {
      const exists = prev.some(b => b.id === book.id);
      if (exists) {
        setToast(`Removed from wishlist`);
        return prev.filter(b => b.id !== book.id);
      }
      setToast(`Added to wishlist`);
      return [...prev, book];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <AnnouncementBar />
      
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        onCartClick={() => setIsCartOpen(true)}
        onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Mobile Category Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-stone-200 p-4 animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setMobileMenuOpen(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === cat ? "bg-[#991B1B] text-white" : "bg-stone-100 text-stone-700"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <CategoryNav 
        selected={selectedCategory} 
        onSelect={setSelectedCategory} 
        categories={categories} 
      />

      <HeroBanner />

      <FilterSortBar 
        resultCount={filteredBooks.length} 
        sortBy={sortBy} 
        setSortBy={setSortBy} 
      />

      {/* Book Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                isWishlisted={wishlist.some(b => b.id === book.id)}
                onToggleWishlist={toggleWishlist}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-[#1C1917] mb-2">No books found</h3>
            <p className="text-stone-500 mb-4">Try adjusting your search or category filter</p>
            <button 
              onClick={() => {setSearchQuery(""); setSelectedCategory("All");}}
              className="btn-primary"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </section>

      <TrustBadges />
      <Newsletter />
      <Footer />

      <CartDrawer 
        cart={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        total={cartTotal}
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </main>
  );
}