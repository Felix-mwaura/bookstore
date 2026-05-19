"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import books from "../books";
import { BookCover } from "../components/BookCard";
import BookDetailPage from "../components/BookCard";
import FilterPanel from "../components/FilterPanel";
import { useStore } from "../components/StoreContext";
import { categoryIcons, categories } from "../components/StoreShell";
import AppShell from "../components/AppShell";

// ── BookCard ────────────────────────────────────────────
function BookCard({ book, isWishlisted, onToggleWishlist, onAddToCart, onViewDetail }) {
  return (
    <div className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col">
      <div className="relative bg-stone-100 p-6 flex justify-center cursor-pointer" onClick={() => onViewDetail(book)}>
        <div className="w-36 rounded-r-md overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
          style={{ aspectRatio: "2/3", boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 24px rgba(0,0,0,0.15)" }}>
          <BookCover book={book} className="w-full h-full" />
        </div>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {book.badge && <span className="px-2.5 py-1 bg-[#991B1B] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">{book.badge}</span>}
          {book.originalPrice && <span className="px-2.5 py-1 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">Save {Math.round((1 - book.price / book.originalPrice) * 100)}%</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(book); }}
          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-full shadow-md opacity-0 group-hover:opacity-100 transition hover:scale-110">
          <svg className={`w-5 h-5 ${isWishlisted ? "text-red-600 fill-red-600" : "text-stone-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition duration-300">
          <span className="bg-[#1C1917]/80 text-white text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">Click to view details</span>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-xs text-stone-500 ml-1">({book.reviews.toLocaleString()})</span>
        </div>
        <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">{book.category}</p>
        <h3 className="text-base font-bold text-[#1C1917] leading-snug line-clamp-2 group-hover:text-[#991B1B] transition cursor-pointer"
          onClick={() => onViewDetail(book)}>{book.title}</h3>
        <p className="text-sm text-stone-500 mt-1">{book.author}</p>
        <p className="text-xs text-stone-400 mt-1">{book.format}</p>
        {book.stock !== "In Stock" && <p className="text-xs text-amber-600 font-semibold mt-1">{book.stock}</p>}
        <div className="mt-auto pt-4">
          <div className="mb-3">
            <p className="text-xl font-bold text-[#1C1917]">KSh {book.price.toLocaleString()}</p>
            {book.originalPrice && <p className="text-sm text-stone-400 line-through">KSh {book.originalPrice.toLocaleString()}</p>}
          </div>
          <button onClick={() => onAddToCart(book)}
            className="w-full bg-[#1C1917] hover:bg-[#991B1B] text-white py-3 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Add to Basket
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inner page (uses searchParams) ──────────────────────
function BooksInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const store = useStore();
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({ priceMax: 2500, formats: [], minRating: null, onSaleOnly: false });

  const updateFilter = (key, val) => setFilters((p) => ({ ...p, [key]: val }));
  const resetFilters = () => setFilters({ priceMax: 2500, formats: [], minRating: null, onSaleOnly: false });

  const filteredBooks = useMemo(() => {
    let result = books.filter((book) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)
        || book.category.toLowerCase().includes(q) || (book.tags || []).some((t) => t.toLowerCase().includes(q));
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

  return (
    <AppShell>
      {/* Category sub-nav */}
      <nav className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${selectedCategory === cat ? "bg-[#991B1B] text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                <span>{categoryIcons[cat] || "📖"}</span>{cat}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <nav className="text-xs text-stone-400 mb-2">
                <Link href="/" className="hover:text-[#991B1B]">Home</Link>
                <span className="mx-2">›</span>
                <span className="text-stone-600 font-medium">All Books</span>
              </nav>
              <h1 className="text-3xl font-bold text-[#1C1917]">All Books</h1>
              <p className="text-stone-500 text-sm mt-1">{books.length} titles in our catalogue</p>
            </div>
            {/* Search on this page */}
            <div className="relative w-full sm:w-80">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within all books..."
                className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-8 items-start">

          {/* Filter sidebar — desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <FilterPanel filters={filters} onChange={updateFilter} onReset={resetFilters}
              resultCount={filteredBooks.length} isOpen={true} onToggle={() => {}} />
          </aside>

          <div className="flex-1 min-w-0">
            {/* Mobile filter */}
            <div className="lg:hidden mb-4">
              <FilterPanel filters={filters} onChange={updateFilter} onReset={resetFilters}
                resultCount={filteredBooks.length} isOpen={filterPanelOpen} onToggle={() => setFilterPanelOpen((o) => !o)} />
            </div>

            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-stone-600 text-sm hidden lg:block">
                Showing <span className="font-bold text-[#1C1917]">{filteredBooks.length}</span> of {books.length} books
              </p>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#991B1B]">
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book}
                    isWishlisted={store.wishlist.some((b) => b.id === book.id)}
                    onToggleWishlist={store.toggleWishlist}
                    onAddToCart={store.addToCart}
                    onViewDetail={store.setSelectedBook} />
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-[#1C1917] mb-2">No books found</h3>
                <p className="text-stone-500 mb-4">Try adjusting your search or filters</p>
                <button onClick={() => { setSearchQuery(""); setSelectedCategory("All"); resetFilters(); }} className="btn-primary">Clear Everything</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BookDetailPage book={store.selectedBook}
        isWishlisted={store.selectedBook ? store.wishlist.some((b) => b.id === store.selectedBook.id) : false}
        onToggleWishlist={store.toggleWishlist} onAddToCart={store.addToCart}
        onClose={() => store.setSelectedBook(null)} />
    </AppShell>
  );
}

export default function BooksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center"><div className="text-6xl animate-pulse">📚</div></div>}>
      <BooksInner />
    </Suspense>
  );
}