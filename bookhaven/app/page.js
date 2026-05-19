"use client";

import { useState } from "react";
import Link from "next/link";
import books from "./books";
import { BookCover } from "./components/BookCard";
import BookDetailPage from "./components/BookCard";
import { useStore } from "./components/StoreContext";
import { categoryIcons, categories } from "./components/StoreShell";
import AppShell from "./components/AppShell";

// ── Hero Banner ──────────────────────────────────────────
function HeroBanner() {
  return (
    <section className="bg-[#F5F5F4] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-24">
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
              Discover this season's most talked-about books. From gripping memoirs to
              life-changing self-help — find your next read at unbeatable prices.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link href="/books" className="btn-primary shadow-lg shadow-red-900/20">
                Shop the Sale
              </Link>
              <Link href="/books" className="btn-secondary">
                View All Books
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex justify-center gap-6">
            {[books[0], books[5], books[7]].map((book, i) => (
              <Link key={book.id} href="/books"
                className="w-44 rounded-r-md overflow-hidden block hover:scale-105 transition-transform duration-300"
                style={{
                  aspectRatio: "2/3",
                  boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 6px 12px 32px rgba(0,0,0,0.2)",
                  transform: `rotateY(-12deg) ${i === 1 ? "translateY(-28px)" : "translateY(10px)"}`,
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

// ── Category Tiles ───────────────────────────────────────
function CategoryTiles() {
  const tiles = categories.filter((c) => c !== "All");
  const colors = {
    "Self-Help": "bg-[#2d4a22]", Finance: "bg-[#0f3460]",
    Productivity: "bg-[#1b1b2f]", Psychology: "bg-[#3b1f5e]",
    History: "bg-[#2c1810]", Philosophy: "bg-[#0d0d0d]",
    Fiction: "bg-[#1a3a4a]", Biography: "bg-[#1c3a5e]",
  };
  return (
    <section className="bg-white border-b border-stone-200 py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Browse by Genre</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917]">What Are You Reading Next?</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {tiles.map((cat) => (
            <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
              className={`group relative overflow-hidden rounded-2xl p-6 text-white flex flex-col justify-between min-h-[120px] hover:scale-[1.03] transition-transform duration-300 ${colors[cat] || "bg-[#1C1917]"}`}>
              <span className="text-3xl">{categoryIcons[cat]}</span>
              <div>
                <p className="font-black text-base">{cat}</p>
                <p className="text-white/60 text-xs mt-0.5">
                  {books.filter((b) => b.category === cat).length} books →
                </p>
              </div>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 rounded-2xl" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Recommended ──────────────────────────────────────────
function RecommendedSection({ onViewDetail, onAddToCart, wishlist, onToggleWishlist }) {
  const picks = [
    { book: books[0], reason: "📈 Trending this week" },
    { book: books[5], reason: "⭐ Highest rated overall" },
    { book: books[7], reason: "❤️ Staff favourite" },
    { book: books[4], reason: "🏆 Award winning" },
  ];
  return (
    <section className="bg-[#FAF8F5] border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Curated For You</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917]">Recommended Reads</h2>
            <p className="text-stone-500 mt-2">Handpicked by our team based on what Kenyans are loving right now</p>
          </div>
          <Link href="/books" className="hidden sm:block text-sm font-bold text-[#991B1B] hover:underline">View all books →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {picks.map(({ book, reason }) => {
            const isWishlisted = wishlist.some((b) => b.id === book.id);
            return (
              <div key={book.id} className="group bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-stone-100 flex flex-col">
                <div className="px-4 pt-4">
                  <span className="text-xs font-bold text-stone-500 bg-stone-50 border border-stone-200 px-3 py-1 rounded-full">{reason}</span>
                </div>
                <div className="flex justify-center py-6 cursor-pointer" onClick={() => onViewDetail(book)}>
                  <div className="w-28 rounded-r-sm overflow-hidden transform group-hover:scale-105 group-hover:-translate-y-1 transition duration-500"
                    style={{ aspectRatio: "2/3", boxShadow: "-2px 0 4px rgba(0,0,0,0.1), 4px 8px 20px rgba(0,0,0,0.15)" }}>
                    <BookCover book={book} className="w-full h-full" />
                  </div>
                </div>
                <div className="px-4 pb-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-[#1C1917] text-sm leading-snug cursor-pointer hover:text-[#991B1B] transition line-clamp-2" onClick={() => onViewDetail(book)}>{book.title}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                    <span className="text-xs text-stone-400">({book.reviews.toLocaleString()})</span>
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <p className="font-bold text-[#1C1917]">KSh {book.price.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => onToggleWishlist(book)}
                        className={`p-1.5 rounded-lg border transition ${isWishlisted ? "border-red-200 bg-red-50 text-red-500" : "border-stone-200 text-stone-400 hover:border-[#991B1B] hover:text-[#991B1B]"}`}>
                        <svg className="w-4 h-4" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button onClick={() => onAddToCart(book)} className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95">Add</button>
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

// ── Reviews ──────────────────────────────────────────────
function ReviewsSection() {
  const reviews = [
    { name: "Wanjiru M.", location: "Nairobi", avatar: "W", avatarBg: "#991B1B", rating: 5, text: "Book Haven has completely changed how I shop for books. Ordered Atomic Habits on a Tuesday and it was at my door in Westlands by Thursday. Genuinely the best online bookstore experience I've had in Kenya.", book: "Atomic Habits", date: "2 weeks ago" },
    { name: "Otieno K.", location: "Kisumu", avatar: "O", avatarBg: "#0f3460", rating: 5, text: "Nationwide delivery to Kisumu — finally! I've been waiting for a Kenyan bookstore that actually ships outside Nairobi. Got The Psychology of Money in 4 days. Packaging was perfect.", book: "The Psychology of Money", date: "1 month ago" },
    { name: "Amina H.", location: "Mombasa", avatar: "A", avatarBg: "#2d4a22", rating: 5, text: "The wishlist feature is so useful! I saved 6 books, shared the list with my husband, and he ordered them all as a birthday surprise. The M-Pesa checkout made it so easy.", book: "Multiple titles", date: "3 weeks ago" },
    { name: "Brian N.", location: "Nakuru", avatar: "B", avatarBg: "#7b2d00", rating: 4, text: "Great selection and competitive prices. Sapiens was KSh 500 cheaper here than what I found elsewhere. Will definitely be back for more books this month.", book: "Sapiens", date: "2 months ago" },
    { name: "Fatuma A.", location: "Eldoret", avatar: "F", avatarBg: "#1a3a4a", rating: 5, text: "As a teacher I order books regularly. Book Haven's fast delivery to Eldoret has made my life so much easier. The search and filter tools help me find exactly what I need.", book: "Multiple titles", date: "1 week ago" },
    { name: "David M.", location: "Nairobi", avatar: "D", avatarBg: "#111111", rating: 5, text: "Can't Hurt Me arrived in 2 days — faster than I expected. This is genuinely the best online bookstore experience I've had in Kenya.", book: "Can't Hurt Me", date: "3 days ago" },
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
    <section className="bg-white border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Happy Readers</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917]">What Kenyans Are Saying</h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <svg key={i} className="w-5 h-5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div>
            <span className="font-bold text-[#1C1917]">4.9 out of 5</span>
            <span className="text-stone-400 text-sm">· 2,400+ verified readers</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-[#FAF8F5] rounded-2xl border border-stone-200 p-6 hover:shadow-md transition-shadow duration-300 flex flex-col">
              <div className="text-4xl font-black text-stone-100 leading-none mb-3 select-none">"</div>
              <p className="text-stone-600 text-sm leading-relaxed flex-1">{r.text}</p>
              <div className="mt-5 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ backgroundColor: r.avatarBg }}>{r.avatar}</div>
                    <div>
                      <p className="font-bold text-[#1C1917] text-sm">{r.name}</p>
                      <p className="text-xs text-stone-400">{r.location} · {r.date}</p>
                    </div>
                  </div>
                  <Stars count={r.rating} />
                </div>
                <p className="text-xs text-stone-400 mt-2 ml-12">Purchased: <span className="font-medium text-stone-500">{r.book}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ────────────────────────────────────────────────
function AboutSection() {
  const stats = [
    { value: "6+", label: "Years in Kenya" }, { value: "15K+", label: "Happy Readers" },
    { value: "2,000+", label: "Titles in Stock" }, { value: "47", label: "Counties Reached" },
  ];
  const team = [
    { name: "Grace Wambui", role: "Founder & CEO", initial: "G", bg: "#991B1B", desc: "Former librarian turned entrepreneur. Passionate about making reading accessible to every Kenyan." },
    { name: "James Odhiambo", role: "Head of Curation", initial: "J", bg: "#0f3460", desc: "Reads 4 books a month. Personally selects every title that makes it into our catalogue." },
    { name: "Aisha Mwangi", role: "Customer Experience", initial: "A", bg: "#2d4a22", desc: "Makes sure every order arrives on time and every customer leaves happy. Our 4.9★ rating is her doing." },
  ];
  return (
    <section id="about" className="bg-[#FAF8F5] border-t border-stone-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">Our Story</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1C1917] leading-tight">Kenya's Home for <br /><span className="italic text-[#991B1B]">Great Books</span></h2>
            <p className="mt-6 text-stone-600 leading-relaxed">Book Haven started in 2018 from a small room in Nairobi's South B estate. Our founder Grace noticed that Kenyans who loved reading had to either pay import prices or hunt through second-hand markets. She decided to fix that.</p>
            <p className="mt-4 text-stone-600 leading-relaxed">Today we stock over 2,000 titles, deliver to all 47 counties, and have helped more than 15,000 Kenyans build their personal libraries — one book at a time.</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="mailto:hello@bookhaven.co.ke" className="btn-primary">Get in Touch</a>
              <Link href="/books" className="btn-secondary">Shop Now</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-white rounded-2xl p-8 text-center border border-stone-200">
                <p className="text-4xl font-black text-[#991B1B]">{value}</p>
                <p className="text-stone-500 text-sm font-medium mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-[#991B1B] mb-2 block">The People Behind It</span>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#1C1917]">Meet the Team</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {team.map((m) => (
            <div key={m.name} className="bg-white rounded-2xl border border-stone-200 p-8 text-center hover:shadow-md transition-shadow duration-300">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto mb-5 shadow-lg" style={{ backgroundColor: m.bg }}>{m.initial}</div>
              <h4 className="font-bold text-[#1C1917] text-lg">{m.name}</h4>
              <p className="text-[#991B1B] text-sm font-semibold mt-1">{m.role}</p>
              <p className="text-stone-500 text-sm leading-relaxed mt-3">{m.desc}</p>
            </div>
          ))}
        </div>
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

// ── Trust + Newsletter ───────────────────────────────────
function TrustBadges() {
  return (
    <section className="bg-white border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {[{ icon: "🚚", title: "Free Delivery", desc: "Within Nairobi over KSh 3,000" }, { icon: "🔄", title: "Easy Returns", desc: "30-day return policy" }, { icon: "🔒", title: "Secure Payment", desc: "M-Pesa & Card accepted" }].map((b) => (
            <div key={b.title} className="flex items-center gap-4 justify-center md:justify-start">
              <div className="text-3xl p-3 bg-stone-50 rounded-xl">{b.icon}</div>
              <div><h4 className="font-bold text-[#1C1917]">{b.title}</h4><p className="text-sm text-stone-500">{b.desc}</p></div>
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
    <section className="bg-[#1C1917] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Join Our Reading Community</h2>
        <p className="text-stone-400 max-w-xl mx-auto mb-8">Get weekly book recommendations, author interviews, and exclusive member discounts.</p>
        {subscribed ? (
          <p className="text-green-400 font-semibold text-lg">✓ You're in! Check your inbox soon.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-stone-500 outline-none focus:border-[#991B1B]" />
            <button onClick={() => { if (email) setSubscribed(true); }} className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white px-6 py-3 rounded-lg font-bold transition">Subscribe</button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function Home() {
  const store = useStore();

  return (
    <AppShell>
      <HeroBanner />
      <CategoryTiles />
      <RecommendedSection
        onViewDetail={store.setSelectedBook}
        onAddToCart={store.addToCart}
        wishlist={store.wishlist}
        onToggleWishlist={store.toggleWishlist}
      />
      <ReviewsSection />
      <AboutSection />
      <TrustBadges />
      <Newsletter />

      <BookDetailPage
        book={store.selectedBook}
        isWishlisted={store.selectedBook ? store.wishlist.some((b) => b.id === store.selectedBook.id) : false}
        onToggleWishlist={store.toggleWishlist}
        onAddToCart={store.addToCart}
        onClose={() => store.setSelectedBook(null)}
      />
    </AppShell>
  );
}