"use client";

import { useState, useMemo } from "react";
import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import books from "../../books";
import { BookCover } from "../../components/BookCard";
import BookDetailPage from "../../components/BookCard";
import FilterPanel from "../../components/FilterPanel";
import { useStore } from "../../components/StoreContext";
import { categoryIcons, categories } from "../../components/StoreShell";
import AppShell from "../../components/AppShell";

// slug → display name
function slugToCategory(slug) {
  return categories.find(
    (c) => c.toLowerCase().replace(/\s+/g, "-") === slug
  );
}

const categoryDescriptions = {
  "Self-Help": "Books to help you build better habits, sharpen your mindset, and become the best version of yourself.",
  Finance: "Master your money. From investing basics to advanced wealth-building strategies for the Kenyan context.",
  Productivity: "Work smarter, focus deeper, and get more done — without burning out.",
  Psychology: "Understand how the human mind works and use that knowledge to make better decisions every day.",
  History: "The stories that shaped the world — from ancient civilisations to modern Kenya.",
  Philosophy: "Timeless wisdom on power, ethics, meaning, and how to live a good life.",
  Fiction: "Escape into brilliantly told stories from some of the world's most celebrated authors.",
  Biography: "Real lives, real lessons. Inspiring stories from people who changed the world.",
};

const categoryColors = {
  "Self-Help": { bg: "#2d4a22", accent: "#86efac" },
  Finance: { bg: "#0f3460", accent: "#fbbf24" },
  Productivity: { bg: "#1b1b2f", accent: "#f87171" },
  Psychology: { bg: "#2d4a22", accent: "#a78bfa" },
  History: { bg: "#2c1810", accent: "#fb923c" },
  Philosophy: { bg: "#0d0d0d", accent: "#f9a8d4" },
  Fiction: { bg: "#1a3a4a", accent: "#67e8f9" },
  Biography: { bg: "#1c3a5e", accent: "#6ee7b7" },
};

function BookCard({ book, isWishlisted, onToggleWishlist, onAddToCart, onViewDetail }) {
  return (
    <div className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col">
      <div className="relative bg-stone-100 p-6 flex justify-center cursor-pointer" onClick={() => onViewDetail(book)}>
        <div className="w-36 rounded-r-md overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
          style={{ aspectRatio: "2/3", boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 24px rgba(0,0,0,0.15)" }}>
          <BookCover book={book} className="w-full h-full" />
        </div>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {book.badge && <span className="px-2.5 py-1 bg-[#991B1B] text-white text-[10px] font-bold uppercase tracking-wider rounded-md">{book.badge}</span>}
          {book.originalPrice && <span className="px-2.5 py-1 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md">Save {Math.round((1 - book.price / book.originalPrice) * 100)}%</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(book); }}
          className="absolute top-3 right-3 p-2 bg-white/90 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition hover:scale-110">
          <svg className={`w-5 h-5 ${isWishlisted ? "text-red-600 fill-red-600" : "text-stone-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
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

export default function CategoryPage({ params }) {
  const { slug } = use(params);
  const category = slugToCategory(slug);

  if (!category) return notFound();

  const store = useStore();
  const colors = categoryColors[category] || { bg: "#1C1917", accent: "#991B1B" };

  const [sortBy, setSortBy] = useState("popular");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({ priceMax: 2500, formats: [], minRating: null, onSaleOnly: false });

  const updateFilter = (key, val) => setFilters((p) => ({ ...p, [key]: val }));
  const resetFilters = () => setFilters({ priceMax: 2500, formats: [], minRating: null, onSaleOnly: false });

  const categoryBooks = useMemo(() => {
    let result = books.filter((b) => {
      const matchesCategory = b.category === category;
      const matchesPrice = b.price <= filters.priceMax;
      const matchesFormat = filters.formats.length === 0 || filters.formats.includes(b.format);
      const matchesRating = filters.minRating === null || b.rating >= filters.minRating;
      const matchesSale = !filters.onSaleOnly || b.originalPrice !== null;
      return matchesCategory && matchesPrice && matchesFormat && matchesRating && matchesSale;
    });
    switch (sortBy) {
      case "price-low": result.sort((a, b) => a.price - b.price); break;
      case "price-high": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "newest": result.sort((a, b) => b.id - a.id); break;
      default: break;
    }
    return result;
  }, [category, sortBy, filters]);

  const allCategoryBooks = books.filter((b) => b.category === category);

  return (
    <AppShell>
      {/* Category hero banner */}
      <section className="relative overflow-hidden py-16"
        style={{ backgroundColor: colors.bg }}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle, ${colors.accent} 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: colors.accent, transform: "translate(30%, -30%)" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <nav className="text-xs mb-6" style={{ color: `${colors.accent}99` }}>
            <Link href="/" className="hover:opacity-80 transition">Home</Link>
            <span className="mx-2">›</span>
            <Link href="/books" className="hover:opacity-80 transition">All Books</Link>
            <span className="mx-2">›</span>
            <span style={{ color: colors.accent }}>{category}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl">{categoryIcons[category]}</span>
                <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${colors.accent}20`, color: colors.accent }}>
                  {allCategoryBooks.length} books
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight">{category}</h1>
              <p className="mt-3 text-base max-w-xl leading-relaxed" style={{ color: `${colors.accent}cc` }}>
                {categoryDescriptions[category]}
              </p>
            </div>

            {/* Mini book stack preview */}
            <div className="hidden md:flex gap-3 items-end flex-shrink-0">
              {allCategoryBooks.slice(0, 3).map((book, i) => (
                <div key={book.id} className="rounded-r-sm overflow-hidden"
                  style={{
                    width: i === 1 ? "80px" : "60px",
                    aspectRatio: "2/3",
                    boxShadow: "-1px 0 3px rgba(0,0,0,0.2), 3px 6px 16px rgba(0,0,0,0.3)",
                    transform: i === 1 ? "translateY(-12px)" : "translateY(0)",
                  }}>
                  <BookCover book={book} className="w-full h-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Other categories */}
          <div className="flex flex-wrap gap-2 mt-8">
            <Link href="/books"
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition border"
              style={{ borderColor: `${colors.accent}40`, color: `${colors.accent}99` }}>
              ← All Books
            </Link>
            {categories.filter((c) => c !== "All" && c !== category).map((cat) => (
              <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-100 border"
                style={{ borderColor: `${colors.accent}30`, color: `${colors.accent}70` }}>
                {categoryIcons[cat]} {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Books content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-8 items-start">

          {/* Filter sidebar — desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <FilterPanel filters={filters} onChange={updateFilter} onReset={resetFilters}
              resultCount={categoryBooks.length} isOpen={true} onToggle={() => {}} />
          </aside>

          <div className="flex-1 min-w-0">
            {/* Mobile filter */}
            <div className="lg:hidden mb-4">
              <FilterPanel filters={filters} onChange={updateFilter} onReset={resetFilters}
                resultCount={categoryBooks.length} isOpen={filterPanelOpen}
                onToggle={() => setFilterPanelOpen((o) => !o)} />
            </div>

            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-stone-600 text-sm hidden lg:block">
                Showing <span className="font-bold text-[#1C1917]">{categoryBooks.length}</span> of {allCategoryBooks.length} {category} books
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

            {categoryBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {categoryBooks.map((book) => (
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
                <h3 className="text-xl font-bold text-[#1C1917] mb-2">No books match your filters</h3>
                <button onClick={resetFilters} className="btn-primary mt-4">Clear Filters</button>
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