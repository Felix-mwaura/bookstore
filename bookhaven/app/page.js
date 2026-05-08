"use client";

import { useState, useMemo } from "react";
import books from "./books";
import Navbar from "./components/Navbar";
import BookCard from "./components/BookCard";
import CartPanel from "./components/CartPanel";

export default function Home() {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [toast, setToast] = useState(null);

  const categories = ["All", ...new Set(books.map((b) => b.category))];

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || book.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const addToCart = (book) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === book.id);
      if (existing) {
        return prev.map((item) =>
          item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...book, quantity: 1 }];
    });
    showToast(`Added "${book.title}" to cart`);
  };

  const removeFromCart = (bookId) => {
    setCart((prev) => prev.filter((item) => item.id !== bookId));
  };

  const updateQuantity = (bookId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === bookId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const toggleWishlist = (book) => {
    setWishlist((prev) => {
      const isInWishlist = prev.some((item) => item.id === book.id);
      if (isInWishlist) {
        showToast(`Removed "${book.title}" from wishlist`);
        return prev.filter((item) => item.id !== book.id);
      } else {
        showToast(`Added "${book.title}" to wishlist`);
        return [...prev, book];
      }
    });
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#faf9f7] overflow-x-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] bg-[#111827] text-white px-6 py-3 rounded-full shadow-2xl animate-fade-up flex items-center gap-3">
          <span className="text-green-400">✓</span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Navbar */}
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        onCartClick={() => setIsCartOpen(true)}
        onWishlistClick={() => {}}
      />

      {/* Cart Panel */}
      <CartPanel
        cart={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        total={cartTotal}
      />

      {/* HERO SECTION */}
      <section className="max-w-[1440px] mx-auto px-6 pt-16 lg:pt-24 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div className="animate-fade-up">
            <p className="uppercase tracking-[0.25em] text-sm text-[#c56a3d] font-semibold mb-6">
              Curated Literary Experiences
            </p>
            
            <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] leading-[0.95] tracking-tight text-[#111827]">
              Discover Your Next{" "}
              <span className="italic text-[#c56a3d]">Great</span> Read
            </h1>
            
            <p className="text-lg text-gray-500 mt-8 max-w-lg leading-relaxed">
              Explore beautifully curated collections of modern fiction, business strategy, programming, and timeless classics — handpicked for curious minds.
            </p>
            
            <div className="flex flex-wrap gap-4 mt-10">
              <button className="bg-[#111827] text-white px-8 py-4 rounded-full font-semibold hover:bg-[#c56a3d] hover:scale-105 transition-all duration-300 shadow-lg shadow-gray-900/20">
                Explore Books
              </button>
              <button className="glass-strong px-8 py-4 rounded-full font-semibold text-[#111827] hover:bg-white transition-all duration-300">
                Staff Picks
              </button>
            </div>

            <div className="flex items-center gap-8 mt-12 pt-8 border-t border-gray-200">
              <div>
                <p className="text-3xl font-bold text-[#111827]">12k+</p>
                <p className="text-sm text-gray-500">Books Sold</p>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div>
                <p className="text-3xl font-bold text-[#111827]">4.9</p>
                <p className="text-sm text-gray-500">Average Rating</p>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div>
                <p className="text-3xl font-bold text-[#111827]">2k+</p>
                <p className="text-sm text-gray-500">Happy Readers</p>
              </div>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative h-[600px] hidden lg:block">
            <div className="absolute top-0 right-8 w-72 rounded-[2.5rem] overflow-hidden rotate-[-6deg] book-shadow animate-float">
              <img src={books[0].image} alt="" className="w-full h-[420px] object-cover" />
            </div>
            
            <div className="absolute bottom-8 left-4 w-64 rounded-[2.5rem] overflow-hidden rotate-[8deg] book-shadow animate-float-delayed">
              <img src={books[1].image} alt="" className="w-full h-[380px] object-cover" />
            </div>
            
            <div className="absolute top-32 left-32 glass-strong p-6 rounded-[2rem] w-64 animate-float-slow">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trending Now</p>
              </div>
              <h3 className="text-2xl font-bold text-[#111827]">{books[1].title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{books[1].description}</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-bold text-[#111827]">{books[1].rating}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY PILLS */}
      <section className="max-w-[1440px] mx-auto px-6 pb-12">
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                selectedCategory === cat
                  ? "bg-[#111827] text-white shadow-lg shadow-gray-900/20 scale-105"
                  : "bg-white text-gray-600 hover:bg-gray-100 book-shadow"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* BOOKS GRID */}
      <section className="max-w-[1440px] mx-auto px-6 pb-32">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-4xl lg:text-5xl text-[#111827]">
              {searchQuery ? `Results for "${searchQuery}"` : selectedCategory === "All" ? "Trending Now" : `${selectedCategory} Books`}
            </h2>
            <p className="text-gray-500 mt-3">
              {filteredBooks.length} {filteredBooks.length === 1 ? "book" : "books"} available
            </p>
          </div>
          {!searchQuery && selectedCategory === "All" && (
            <button className="hidden sm:block text-sm uppercase tracking-widest text-[#c56a3d] font-semibold hover:text-[#111827] transition">
              View All →
            </button>
          )}
        </div>

        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isWishlisted={wishlist.some((item) => item.id === book.id)}
                onToggleWishlist={toggleWishlist}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">No books found</h3>
            <p className="text-gray-500">Try adjusting your search or category filter</p>
            <button 
              onClick={() => {setSearchQuery(""); setSelectedCategory("All");}}
              className="mt-4 text-[#c56a3d] font-semibold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>

      {/* BENTO GRID COLLECTIONS */}
      <section className="max-w-[1440px] mx-auto px-6 pb-32">
        <h2 className="text-4xl lg:text-5xl text-[#111827] mb-12">Curated Collections</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
          {/* Large Card */}
          <div className="md:col-span-2 md:row-span-2 relative rounded-[2.5rem] overflow-hidden group cursor-pointer book-shadow">
            <img 
              src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80" 
              alt="New Arrivals" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-10">
              <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider rounded-full">
                Fresh In
              </span>
              <h3 className="text-4xl font-bold text-white mt-4">New Arrivals</h3>
              <p className="text-white/80 mt-2 max-w-md">This season's most anticipated releases, from debut novels to established masters.</p>
            </div>
          </div>

          {/* Tall Card */}
          <div className="relative rounded-[2.5rem] overflow-hidden group cursor-pointer book-shadow">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80" 
              alt="Award Winners" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8">
              <span className="px-4 py-1.5 bg-amber-500/90 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                Premium
              </span>
              <h3 className="text-2xl font-bold text-white mt-4">Award Winners</h3>
            </div>
          </div>

          {/* Bottom Card */}
          <div className="relative rounded-[2.5rem] overflow-hidden group cursor-pointer book-shadow">
            <img 
              src="https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=600&q=80" 
              alt="Business Essentials" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8">
              <span className="px-4 py-1.5 bg-[#c56a3d] text-white text-xs font-bold uppercase tracking-wider rounded-full">
                Must Read
              </span>
              <h3 className="text-2xl font-bold text-white mt-4">Business Essentials</h3>
            </div>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="max-w-[1440px] mx-auto px-6 pb-32">
        <div className="relative bg-[#111827] rounded-[3rem] p-12 lg:p-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#c56a3d] rounded-full blur-[128px] opacity-20" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500 rounded-full blur-[100px] opacity-10" />
          
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <h2 className="text-4xl lg:text-5xl text-white mb-6">
              Get Book Recommendations Weekly
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              Join 5,000+ readers receiving curated picks, author interviews, and exclusive deals directly to their inbox.
            </p>
            
            <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-4 text-white placeholder:text-gray-400 outline-none focus:border-[#c56a3d] transition"
              />
              <button className="bg-[#c56a3d] hover:bg-[#a85a32] text-white px-8 py-4 rounded-full font-bold transition-all duration-300 hover:scale-105">
                Subscribe
              </button>
            </form>
            
            <p className="text-gray-500 text-sm mt-6">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-black text-[#111827]">Book Haven</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Kenya's most loved online bookstore. We believe great stories should be accessible to everyone.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-[#111827] mb-6">Shop</h4>
              <ul className="space-y-4 text-gray-500">
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Bestsellers</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">New Arrivals</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Categories</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Gift Cards</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-[#111827] mb-6">Support</h4>
              <ul className="space-y-4 text-gray-500">
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Help Center</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Shipping & Returns</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Order Status</li>
                <li className="hover:text-[#c56a3d] cursor-pointer transition">Contact Us</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-[#111827] mb-6">Connect</h4>
              <div className="flex gap-4">
                {["Twitter", "Instagram", "Facebook"].map((social) => (
                  <button key={social} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-[#111827] hover:text-white flex items-center justify-center transition-all duration-300">
                    <span className="text-xs font-bold">{social[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-100 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">© 2026 Book Haven Kenya. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-gray-400">
              <span className="hover:text-[#111827] cursor-pointer transition">Privacy</span>
              <span className="hover:text-[#111827] cursor-pointer transition">Terms</span>
              <span className="hover:text-[#111827] cursor-pointer transition">Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}