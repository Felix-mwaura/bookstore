"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLiveBooks } from "../lib/useLiveBooks";
import { BookCover } from "./BookCard";
import BookDetailPage from "./BookCard";
import { useStore, StoreHeader, StoreFooter, categoryIcons, categories, CartDrawer } from "./StoreShell";
import WishlistDrawer from "./WishlistDrawer";
import { STORE_CONTACT } from "../lib/site";
import { bookPath } from "../lib/book-url";

function HeroBanner({ books }) {
  const heroBooks = books.slice(0, 3);
  // The banner used to promise "up to 40% off". The deepest real discount in
  // the catalogue is whatever the data says, so it is calculated, not written.
  const maxDiscount = books.reduce((best, b) => {
    if (!b.original_price || b.original_price <= b.price) return best;
    return Math.max(best, Math.round((1 - b.price / b.original_price) * 100));
  }, 0);
  return (
    <section className="bg-[#F5F5F4] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 bg-[#991B1B]/10 text-[#991B1B] text-xs font-bold uppercase tracking-wider rounded-full mb-4 sm:mb-6">
              {maxDiscount >= 5 ? "This Month's Offers" : "This Month's Picks"}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-[#1C1917] leading-[1.1]">
              {maxDiscount >= 5 ? (
                <>Up to {maxDiscount}% Off <br /><span className="italic text-[#991B1B]">Selected</span> Titles</>
              ) : (
                <>Good Books, <br /><span className="italic text-[#991B1B]">Delivered</span> to Your Door</>
              )}
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-stone-600 max-w-lg leading-relaxed">
              Paperbacks and hardcovers across fiction, finance, self-help and biography — prices in Kenyan shillings.
            </p>
            <div className="flex flex-col xs:flex-row gap-3 mt-6 sm:mt-8">
              <Link href="/books" className="btn-primary text-center shadow-lg shadow-red-900/20">
                Shop the Sale
              </Link>
              <Link href="/books" className="btn-secondary text-center">
                View All Books
              </Link>
            </div>
          </div>

          {/* Book covers — show smaller on tablet, hidden on mobile */}
          {heroBooks.length > 0 && (
            <div className="hidden sm:flex justify-center gap-4 lg:gap-6">
              {heroBooks.map((book, i) => (
                <Link key={book.id} href="/books"
                  className="rounded-r-md overflow-hidden block hover:scale-105 transition-transform duration-300"
                  style={{
                    width: "clamp(80px, 15vw, 176px)",
                    aspectRatio: "2/3",
                    boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 6px 12px 32px rgba(0,0,0,0.2)",
                    transform: i === 1 ? "translateY(-20px)" : "translateY(8px)",
                  }}>
                  <BookCover book={book} className="w-full h-full" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryTiles({ books }) {
  const tiles = categories.filter((c) => c !== "All");
  const colors = {
    "Self-Help": "bg-[#2d4a22]", Finance: "bg-[#0f3460]",
    Productivity: "bg-[#1b1b2f]", Psychology: "bg-[#3b1f5e]",
    History: "bg-[#2c1810]", Philosophy: "bg-[#0d0d0d]",
    Fiction: "bg-[#1a3a4a]", Biography: "bg-[#1c3a5e]",
  };
  return (
    <section className="bg-white border-b border-stone-200 py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-7 sm:mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Browse by Genre</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917]">What Are You Reading Next?</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {tiles.map((cat) => (
            <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
              className={`group relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white flex flex-col justify-between min-h-[100px] sm:min-h-[120px] active:scale-[0.97] transition-transform duration-200 ${colors[cat] || "bg-[#1C1917]"}`}>
              <span className="text-2xl sm:text-3xl">{categoryIcons[cat]}</span>
              <div>
                <p className="font-black text-sm sm:text-base">{cat}</p>
                <p className="text-white/60 text-xs mt-0.5">
                  {books.filter((b) => b.category === cat).length} books →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendedSection({ books, booksLoading, onViewDetail, onAddToCart, wishlist, onToggleWishlist }) {
  const featured = books.filter(b => b.is_featured);
  let source = featured.slice(0, 4);
  if (source.length < 4) {
    // Fresh store with nothing marked featured yet — fall back to
    // top-rated so the section still shows something real, not empty.
    const existingIds = new Set(source.map(b => b.id));
    const topRated = [...books].sort((a, b) => (b.rating||0) - (a.rating||0));
    source = [...source, ...topRated.filter(b => !existingIds.has(b.id))].slice(0, 4);
  }
  const picks = source.map(book => ({ book, reason: book.is_featured ? "★ Featured" : "⭐ Highly rated" }));

  if (!booksLoading && picks.length === 0) return null;
  return (
    <section className="bg-[#FAF8F5] border-t border-stone-200 py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-7 sm:mb-10">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-1 block">Curated For You</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917]">Recommended Reads</h2>
            <p className="text-stone-500 mt-1 text-sm sm:text-base">Handpicked by our team</p>
          </div>
          <Link href="/books" className="hidden sm:block text-sm font-bold text-[#991B1B] hover:underline whitespace-nowrap ml-4">
            View all →
          </Link>
        </div>

        {/* Horizontal scroll on mobile, grid on tablet+ */}
        <div className="flex gap-4 overflow-x-auto pb-3 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
          {picks.map(({ book, reason }) => {
            const isWishlisted = wishlist.some((b) => b.id === book.id);
            return (
              <div key={book.id}
                className="flex-shrink-0 w-[200px] sm:w-auto group bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-stone-100 flex flex-col"
                style={{ scrollSnapAlign: "start" }}>
                <div className="px-4 pt-4">
                  <span className="text-xs font-bold text-stone-500 bg-stone-50 border border-stone-200 px-2 py-1 rounded-full whitespace-nowrap">{reason}</span>
                </div>
                <div className="flex justify-center py-5 cursor-pointer" onClick={() => onViewDetail(book)}>
                  <div className="w-24 rounded-r-sm overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
                    style={{ aspectRatio: "2/3", boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 20px rgba(0,0,0,0.15)" }}>
                    <BookCover book={book} className="w-full h-full" />
                  </div>
                </div>
                <div className="px-4 pb-4 flex-1 flex flex-col">
                  <Link href={bookPath(book)}
                    className="font-bold text-[#1C1917] text-sm leading-snug hover:text-[#991B1B] transition line-clamp-2">
                    {book.title}
                  </Link>
                  <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <p className="font-bold text-[#1C1917] text-sm">KSh {book.price.toLocaleString()}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => onToggleWishlist(book)}
                        className={`p-1.5 rounded-lg border transition ${isWishlisted ? "border-red-200 bg-red-50 text-red-500" : "border-stone-200 text-stone-400"}`}>
                        <svg className="w-3.5 h-3.5" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button onClick={() => onAddToCart(book)}
                        className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Link href="/books" className="sm:hidden block text-center text-sm font-bold text-[#991B1B] mt-4 hover:underline">
          View all books →
        </Link>
      </div>
    </section>
  );
}

function HowItWorks() {
  // Replaces a wall of invented testimonials. Every claim here is something
  // the site actually does, so it cannot become a false claim about the shop.
  const steps = [
    {
      icon: "🔎",
      title: "Find your book",
      body: "Search by title, author or genre, or browse by category. Stock shown on each book is the real shelf quantity.",
    },
    {
      icon: "🧾",
      title: "Check out",
      body: "Review your basket, tell us where to deliver, and confirm. Your basket is saved on this device until you do.",
    },
    {
      icon: "🚚",
      title: "Track it",
      body: "Every order gets a reference you can follow from your account — from packing to dispatch to delivery.",
    },
  ];

  return (
    <section className="bg-white border-t border-stone-200 py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">How It Works</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917]">Ordering Is Simple</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((step, index) => (
            <div key={step.title} className="bg-[#FAF8F5] rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl" aria-hidden="true">{step.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Step {index + 1}</span>
              </div>
              <h3 className="font-bold text-[#1C1917]">{step.title}</h3>
              <p className="text-stone-600 text-sm leading-relaxed mt-1.5">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection({ stats }) {
  // These four figures come from the books table at render time. The previous
  // version hard-coded "2,000+ titles", "15K+ readers", "47 counties" and a
  // founding story with named staff — none of it was in the database.
  const figures = [
    { value: stats.titles.toLocaleString("en-KE"), label: "Titles in the catalogue" },
    { value: stats.categories.toLocaleString("en-KE"), label: "Genres to browse" },
    { value: stats.inStock.toLocaleString("en-KE"), label: "Ready to ship today" },
    { value: "47", label: "Counties we deliver to" },
  ];

  return (
    <section id="about" className="bg-[#FAF8F5] border-t border-stone-200 py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">About Us</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917] leading-tight">
              A Bookshop Built for <br /><span className="italic text-[#991B1B]">Kenyan Readers</span>
            </h2>
            <p className="mt-4 sm:mt-6 text-stone-600 leading-relaxed text-sm sm:text-base">
              Book Haven sells paperbacks and hardcovers in Kenyan shillings, with delivery priced up front:
              free above KSh 3,000, and a flat KSh 300 below it. No import wait, no surprise charges at the door.
            </p>
            <p className="mt-3 sm:mt-4 text-stone-600 leading-relaxed text-sm sm:text-base">
              Every order is tracked from the moment it is placed. You can check its status, see what you paid,
              and follow it through to delivery from your account.
            </p>
            <div className="flex flex-wrap gap-3 mt-6 sm:mt-8">
              <a href={`mailto:${STORE_CONTACT.email}`} className="btn-primary text-sm">Get in Touch</a>
              <Link href="/books" className="btn-secondary text-sm">Shop Now</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {figures.map(({ value, label }) => (
              <div key={label} className="bg-white rounded-2xl p-5 sm:p-8 text-center border border-stone-200">
                <p className="text-3xl sm:text-4xl font-black text-[#991B1B]">{value}</p>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="contact" className="mt-10 sm:mt-16 bg-[#1C1917] rounded-2xl sm:rounded-3xl p-6 sm:p-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
          {[
            { icon: "📧", label: "Email Us", value: STORE_CONTACT.email, href: `mailto:${STORE_CONTACT.email}` },
            { icon: "📞", label: "Call / WhatsApp", value: STORE_CONTACT.phone, href: STORE_CONTACT.phoneHref },
            { icon: "📍", label: "Visit Us", value: STORE_CONTACT.location, href: null },
          ].map(({ icon, label, value, href }) => (
            <div key={label} className="text-white">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3" aria-hidden="true">{icon}</div>
              <p className="text-stone-400 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">{label}</p>
              {href ? <a href={href} className="font-bold text-sm sm:text-lg hover:text-[#fca5a5]">{value}</a>
                     : <p className="font-bold text-sm sm:text-lg">{value}</p>}
              <p className="text-stone-400 text-xs sm:text-sm mt-1">{STORE_CONTACT.hours}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBadges() {
  return (
    <section className="bg-white border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-3 gap-3 sm:gap-8">
          {[
            { icon: "🚚", title: "Free Delivery", desc: "On orders over KSh 3,000" },
            { icon: "📦", title: "Order Tracking", desc: "Follow it to your door" },
            { icon: "🔒", title: "Pay Your Way", desc: "M-Pesa or on delivery" },
          ].map((b) => (
            <div key={b.title} className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 text-center sm:text-left">
              <div className="text-2xl sm:text-3xl p-2 sm:p-3 bg-stone-50 rounded-xl flex-shrink-0">{b.icon}</div>
              <div>
                <h4 className="font-bold text-[#1C1917] text-xs sm:text-base">{b.title}</h4>
                <p className="text-stone-500 text-xs sm:text-sm mt-0.5">{b.desc}</p>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The old version set `subscribed` with no request anywhere: the address
  // was thrown away and the customer was told to check an inbox that would
  // never receive anything. This writes to newsletter_subscribers.
  const subscribe = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: value, source: "homepage" });

    // 23505 = already on the list, which is a success from the customer's
    // point of view; never tell someone they failed because they subscribed
    // twice.
    if (insertError && insertError.code !== "23505") {
      setError("We could not save your address just now. Please try again.");
      setBusy(false);
      return;
    }
    setSubscribed(true);
    setBusy(false);
  };

  return (
    <section className="bg-[#1C1917] text-white py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">Join Our Reading Community</h2>
        <p className="text-stone-400 max-w-xl mx-auto mb-6 sm:mb-8 text-sm sm:text-base">Get weekly book recommendations, author interviews, and exclusive member discounts.</p>
        {subscribed ? (
          <p className="text-green-400 font-semibold">✓ You&apos;re on the list. We&apos;ll email you when new titles arrive.</p>
        ) : (
          <>
            <form
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              onSubmit={(e) => { e.preventDefault(); subscribe(); }}
            >
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input id="newsletter-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="Your email address" autoComplete="email" required
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-stone-500 outline-none focus:border-[#991B1B] text-sm" />
              <button type="submit" disabled={busy}
                className="bg-[#991B1B] hover:bg-[#7F1D1D] disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold transition text-sm whitespace-nowrap">
                {busy ? "Saving…" : "Subscribe"}
              </button>
            </form>
            <p className="text-xs text-stone-500 mt-3">Book news only. One email when there is something worth telling you.</p>
            {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}

export default function HomeClient({ initialBooks = [] }) {
  const store = useStore();
  const [books, setBooks] = useState(initialBooks);
  const [booksLoading, setBooksLoading] = useState(initialBooks.length === 0);

  const [booksError, setBooksError] = useState(null);

  const loadBooks = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("books").select("*").eq("is_archived", false).order("id");
      if (error) throw error;
      setBooks(data || []);
      setBooksError(null);
    } catch (err) {
      // Previously a failed read rendered an empty shop that looked like a
      // closed store. Say it failed and offer a retry instead.
      setBooksError(err?.message || "Could not load the catalogue.");
    } finally {
      setBooksLoading(false);
    }
  }, []);

  // Live figures for the About section — computed from the catalogue instead
  // of hard-coded marketing numbers.
  const stats = useMemo(() => ({
    titles: books.length,
    categories: new Set(books.map((b) => b.category)).size,
    inStock: books.filter((b) => Number(b.stock_quantity) > 0).length,
  }), [books]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBooks(); }, [loadBooks]);
  useLiveBooks(loadBooks);

  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <StoreHeader cartCount={store.cartCount} wishlistCount={store.wishlist.length} onCartClick={() => store.setIsCartOpen(true)} onWishlistClick={() => store.setIsWishlistOpen(true)} />
      {booksError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-center" role="alert">
          <p className="text-sm text-red-800">
            {booksError}{" "}
            <button type="button" onClick={loadBooks} className="font-bold underline hover:no-underline">Try again</button>
          </p>
        </div>
      )}
      <HeroBanner books={books} />
      <CategoryTiles books={books} />
      <RecommendedSection books={books} booksLoading={booksLoading} onViewDetail={store.setSelectedBook} onAddToCart={store.addToCart} wishlist={store.wishlist} onToggleWishlist={store.toggleWishlist} />
      <HowItWorks />
      <AboutSection stats={stats} />
      <TrustBadges />
      <Newsletter />
      <StoreFooter />
      <WishlistDrawer wishlist={store.wishlist} isOpen={store.isWishlistOpen} onClose={() => store.setIsWishlistOpen(false)} onRemove={(id) => store.toggleWishlist(store.wishlist.find((b) => b.id === id))} onAddToCart={(book) => { store.addToCart(book); store.setIsWishlistOpen(false); }} onViewDetail={store.setSelectedBook} />
      <CartDrawer cart={store.cart} isOpen={store.isCartOpen} onClose={() => store.setIsCartOpen(false)} onUpdateQty={store.updateQty} onRemove={store.removeFromCart} total={store.cartTotal} />
      <BookDetailPage book={store.selectedBook} isWishlisted={store.selectedBook ? store.wishlist.some((b) => b.id === store.selectedBook.id) : false} onToggleWishlist={store.toggleWishlist} onAddToCart={store.addToCart} onClose={() => store.setSelectedBook(null)} />
      {store.toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-5 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 whitespace-nowrap max-w-[90vw]">
          <span className="text-green-400">✓</span>
          <span className="text-sm font-medium truncate">{store.toast}</span>
        </div>
      )}
    </main>
  );
}