"use client";

import { useState } from "react";
import Link from "next/link";
import books from "./books";
import { BookCover } from "./components/BookCard";
import BookDetailPage from "./components/BookCard";
import { useStore, StoreHeader, StoreFooter, categoryIcons, categories, CartDrawer } from "./components/StoreShell";
import WishlistDrawer from "./components/WishlistDrawer";

function HeroBanner() {
  return (
    <section className="bg-[#F5F5F4] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 bg-[#991B1B]/10 text-[#991B1B] text-xs font-bold uppercase tracking-wider rounded-full mb-4 sm:mb-6">
              Summer Reading Sale
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-[#1C1917] leading-[1.1]">
              Up to 40% Off <br />
              <span className="italic text-[#991B1B]">Bestselling</span> Titles
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-stone-600 max-w-lg leading-relaxed">
              Discover this season's most talked-about books — from gripping memoirs to life-changing self-help.
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
          <div className="hidden sm:flex justify-center gap-4 lg:gap-6">
            {[books[0], books[5], books[7]].map((book, i) => (
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
        </div>
      </div>
    </section>
  );
}

function CategoryTiles() {
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

function RecommendedSection({ onViewDetail, onAddToCart, wishlist, onToggleWishlist }) {
  const picks = [
    { book: books[0], reason: "📈 Trending this week" },
    { book: books[5], reason: "⭐ Highest rated" },
    { book: books[7], reason: "❤️ Staff favourite" },
    { book: books[4], reason: "🏆 Award winning" },
  ];
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
                  <h3 className="font-bold text-[#1C1917] text-sm leading-snug cursor-pointer hover:text-[#991B1B] transition line-clamp-2"
                    onClick={() => onViewDetail(book)}>{book.title}</h3>
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

function ReviewsSection() {
  const reviews = [
    { name: "Wanjiru M.", location: "Nairobi", avatar: "W", avatarBg: "#991B1B", rating: 5, text: "Book Haven has completely changed how I shop for books. Ordered Atomic Habits on a Tuesday and it was at my door in Westlands by Thursday.", book: "Atomic Habits", date: "2 weeks ago" },
    { name: "Otieno K.", location: "Kisumu", avatar: "O", avatarBg: "#0f3460", rating: 5, text: "Nationwide delivery to Kisumu — finally! Got The Psychology of Money in 4 days. Packaging was perfect.", book: "The Psychology of Money", date: "1 month ago" },
    { name: "Amina H.", location: "Mombasa", avatar: "A", avatarBg: "#2d4a22", rating: 5, text: "The wishlist feature is so useful! I saved 6 books and my husband ordered them as a birthday surprise. The M-Pesa checkout made it easy.", book: "Multiple titles", date: "3 weeks ago" },
    { name: "Brian N.", location: "Nakuru", avatar: "B", avatarBg: "#7b2d00", rating: 4, text: "Great selection and competitive prices. Sapiens was KSh 500 cheaper here than anywhere else.", book: "Sapiens", date: "2 months ago" },
    { name: "Fatuma A.", location: "Eldoret", avatar: "F", avatarBg: "#1a3a4a", rating: 5, text: "Fast delivery to Eldoret! As a teacher I order regularly. The search tools help me find exactly what I need.", book: "Multiple titles", date: "1 week ago" },
    { name: "David M.", location: "Nairobi", avatar: "D", avatarBg: "#111111", rating: 5, text: "Can't Hurt Me arrived in 2 days. Genuinely the best online bookstore experience I've had in Kenya.", book: "Can't Hurt Me", date: "3 days ago" },
  ];
  return (
    <section className="bg-white border-t border-stone-200 py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Happy Readers</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917]">What Kenyans Are Saying</h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex">{[...Array(5)].map((_, i) => <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div>
            <span className="font-bold text-[#1C1917] text-sm">4.9/5</span>
            <span className="text-stone-400 text-xs">· 2,400+ readers</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-[#FAF8F5] rounded-2xl border border-stone-200 p-5 sm:p-6 flex flex-col">
              <div className="text-3xl font-black text-stone-100 leading-none mb-2 select-none">"</div>
              <p className="text-stone-600 text-sm leading-relaxed flex-1">{r.text}</p>
              <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ backgroundColor: r.avatarBg }}>{r.avatar}</div>
                  <div>
                    <p className="font-bold text-[#1C1917] text-sm">{r.name}</p>
                    <p className="text-xs text-stone-400">{r.location} · {r.date}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">{[...Array(r.rating)].map((_, i) => <svg key={i} className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div>
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
    { value: "6+", label: "Years in Kenya" }, { value: "15K+", label: "Happy Readers" },
    { value: "2,000+", label: "Titles in Stock" }, { value: "47", label: "Counties Reached" },
  ];
  const team = [
    { name: "Grace Wambui", role: "Founder & CEO", initial: "G", bg: "#991B1B", desc: "Former librarian turned entrepreneur. Passionate about making reading accessible to every Kenyan." },
    { name: "James Odhiambo", role: "Head of Curation", initial: "J", bg: "#0f3460", desc: "Reads 4 books a month. Personally selects every title in our catalogue." },
    { name: "Aisha Mwangi", role: "Customer Experience", initial: "A", bg: "#2d4a22", desc: "Makes sure every order arrives on time. Our 4.9★ rating is her doing." },
  ];
  return (
    <section id="about" className="bg-[#FAF8F5] border-t border-stone-200 py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-12 sm:mb-20">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Our Story</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1C1917] leading-tight">
              Kenya's Home for <br /><span className="italic text-[#991B1B]">Great Books</span>
            </h2>
            <p className="mt-4 sm:mt-6 text-stone-600 leading-relaxed text-sm sm:text-base">
              Book Haven started in 2018 from a small room in Nairobi's South B estate. Our founder Grace noticed that Kenyans who loved reading had to either pay import prices or hunt through second-hand markets. She decided to fix that.
            </p>
            <p className="mt-3 sm:mt-4 text-stone-600 leading-relaxed text-sm sm:text-base">
              Today we stock over 2,000 titles, deliver to all 47 counties, and have helped more than 15,000 Kenyans build their personal libraries.
            </p>
            <div className="flex flex-wrap gap-3 mt-6 sm:mt-8">
              <a href="mailto:hello@bookhaven.co.ke" className="btn-primary text-sm">Get in Touch</a>
              <Link href="/books" className="btn-secondary text-sm">Shop Now</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-white rounded-2xl p-5 sm:p-8 text-center border border-stone-200">
                <p className="text-3xl sm:text-4xl font-black text-[#991B1B]">{value}</p>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mb-7 sm:mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">The People Behind It</span>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">Meet the Team</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {team.map((m) => (
            <div key={m.name} className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-black text-xl sm:text-2xl mx-auto mb-4 sm:mb-5 shadow-lg" style={{ backgroundColor: m.bg }}>{m.initial}</div>
              <h4 className="font-bold text-[#1C1917] text-base sm:text-lg">{m.name}</h4>
              <p className="text-[#991B1B] text-xs sm:text-sm font-semibold mt-1">{m.role}</p>
              <p className="text-stone-500 text-xs sm:text-sm leading-relaxed mt-2 sm:mt-3">{m.desc}</p>
            </div>
          ))}
        </div>

        <div id="contact" className="mt-10 sm:mt-16 bg-[#1C1917] rounded-2xl sm:rounded-3xl p-6 sm:p-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
          {[
            { icon: "📧", label: "Email Us", value: "hello@bookhaven.co.ke", sub: "Reply within 24 hours" },
            { icon: "📞", label: "Call / WhatsApp", value: "+254 712 345 678", sub: "Mon–Sat, 9am–7pm" },
            { icon: "📍", label: "Visit Us", value: "The Junction Mall", sub: "Ground floor, Shop G14" },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="text-white">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{icon}</div>
              <p className="text-stone-400 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">{label}</p>
              <p className="font-bold text-sm sm:text-lg">{value}</p>
              <p className="text-stone-400 text-xs sm:text-sm mt-1">{sub}</p>
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
            { icon: "🚚", title: "Free Delivery", desc: "Nairobi over KSh 3,000" },
            { icon: "🔄", title: "Easy Returns", desc: "30-day return policy" },
            { icon: "🔒", title: "Secure Pay", desc: "M-Pesa & Card" },
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
  return (
    <section className="bg-[#1C1917] text-white py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">Join Our Reading Community</h2>
        <p className="text-stone-400 max-w-xl mx-auto mb-6 sm:mb-8 text-sm sm:text-base">Get weekly book recommendations, author interviews, and exclusive member discounts.</p>
        {subscribed ? (
          <p className="text-green-400 font-semibold">✓ You're in! Check your inbox soon.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-stone-500 outline-none focus:border-[#991B1B] text-sm" />
            <button onClick={() => { if (email) setSubscribed(true); }}
              className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white px-6 py-3 rounded-xl font-bold transition text-sm whitespace-nowrap">
              Subscribe
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const store = useStore();
  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <StoreHeader cartCount={store.cartCount} wishlistCount={store.wishlist.length} onCartClick={() => store.setIsCartOpen(true)} onWishlistClick={() => store.setIsWishlistOpen(true)} />
      <HeroBanner />
      <CategoryTiles />
      <RecommendedSection onViewDetail={store.setSelectedBook} onAddToCart={store.addToCart} wishlist={store.wishlist} onToggleWishlist={store.toggleWishlist} />
      <ReviewsSection />
      <AboutSection />
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