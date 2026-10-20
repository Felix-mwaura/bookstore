"use client";

import Link from "next/link";
import { useState } from "react";

import { BookCover } from "./BookCover";
import ProductCard from "./ProductCard";
import { useStore } from "./StoreShell";
import { STORE_CONTACT } from "../lib/site";
import { categories, categoryIcons, categorySlug } from "../lib/categories";
import { bookPath } from "../lib/book-url";

/* ── hero ─────────────────────────────────────────────── */

function Hero({ books }) {
  const covers = books.slice(0, 3);

  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sienna">
              Book Haven · Books in Kenyan shillings
            </p>
            <h1 className="mt-3 text-[2rem] leading-[1.1] sm:text-5xl lg:text-6xl font-bold text-navy">
              Books worth keeping,
              <br />
              <span className="italic text-sienna">delivered</span> to your door.
            </h1>
            <p className="mt-4 sm:mt-5 max-w-xl text-base sm:text-lg text-muted leading-relaxed">
              Paperbacks and hardcovers across fiction, finance, self-help and biography.
              Stock shown is the real shelf quantity, and delivery is priced before you pay.
            </p>

            <form action="/books" method="get" role="search" className="mt-6 sm:mt-8 max-w-xl">
              <label htmlFor="hero-search" className="sr-only">Search books by title or author</label>
              <div className="flex items-stretch gap-2 rounded-card border border-line bg-white p-1.5 shadow-card focus-within:border-navy">
                <span className="flex items-center pl-2 text-muted" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  id="hero-search"
                  name="q"
                  type="search"
                  placeholder="Title or author…"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted/80"
                />
                <button type="submit" className="btn-primary px-4 py-2.5 text-sm shrink-0">Search</button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/books" className="btn-primary text-sm">Shop all books</Link>
              <Link href="#genres" className="btn-secondary text-sm">Browse genres</Link>
            </div>
          </div>

          {covers.length > 0 && (
            <div className="hidden sm:flex items-end justify-center gap-4 lg:gap-6">
              {covers.map((book, index) => (
                <Link
                  key={book.id}
                  href={bookPath(book)}
                  className="block w-[110px] lg:w-[150px] rounded-r-md overflow-hidden book-shadow transition-transform duration-200 hover:-translate-y-1"
                  style={{ transform: index === 1 ? "translateY(-18px)" : "none" }}
                >
                  <BookCover book={book} className="w-full" sizes="(min-width: 1024px) 150px, 110px" priority={index === 0} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── genre chips ──────────────────────────────────────── */

function GenreStrip({ counts }) {
  return (
    <section id="genres" className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-navy">Browse by genre</h2>
          <Link href="/books" className="text-sm font-semibold text-sienna underline-offset-2 hover:underline">
            All books →
          </Link>
        </div>
        <ul role="list" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
          {categories.filter((c) => c !== "All").map((category) => {
            const count = counts[category] || 0;
            return (
              <li key={category}>
                <Link
                  href={`/category/${categorySlug(category)}`}
                  className="flex h-full flex-col justify-between gap-3 rounded-card border border-line bg-cream p-3 sm:p-4 transition-colors hover:border-navy hover:bg-subtle"
                >
                  <span className="text-xl" aria-hidden="true">{categoryIcons[category]}</span>
                  <span>
                    <span className="block text-sm font-semibold text-navy leading-tight">{category}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {count} {count === 1 ? "book" : "books"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ── new arrivals ─────────────────────────────────────── */

function NewArrivals({ books }) {
  const store = useStore();
  const latest = [...books].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
  if (!latest.length) return null;

  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy">New arrivals</h2>
            <p className="mt-1 text-sm text-muted">The latest titles added to the shelf.</p>
          </div>
          <Link href="/books?sort=newest" className="text-sm font-semibold text-sienna underline-offset-2 hover:underline whitespace-nowrap">
            See all →
          </Link>
        </div>

        <ul role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {latest.map((book) => (
            <li key={book.id} className="min-w-0">
              <ProductCard book={book} onAddToCart={store.addToCart} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── how it works ─────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      title: "Find your book",
      body: "Search by title or author, or browse a genre. The stock label on each book is the real shelf quantity.",
    },
    {
      title: "Check out",
      body: "Review your basket, add a delivery address and a phone number we can reach you on, then confirm.",
    },
    {
      title: "Follow the order",
      body: "Every order gets a reference you can open from your account, from packing through to delivery.",
    },
  ];

  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <h2 className="text-xl sm:text-2xl font-bold text-navy mb-6">How ordering works</h2>
        <ol className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-card border border-line bg-cream p-5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-navy text-white text-xs font-bold">
                {index + 1}
              </span>
              <h3 className="mt-3 text-base font-semibold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── catalogue facts ──────────────────────────────────── */

function ShelfFacts({ stats }) {
  const facts = [
    { value: stats.titles.toLocaleString("en-KE"), label: "titles on the shelf" },
    { value: stats.categories.toLocaleString("en-KE"), label: "genres to browse" },
    { value: stats.inStock.toLocaleString("en-KE"), label: "ready to ship" },
    { value: "KSh 3,000", label: "free delivery from" },
  ];

  return (
    <section id="about" className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy">A bookshop for Kenyan readers</h2>
            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
              Prices are in Kenyan shillings and delivery is worked out up front: free above KSh 3,000,
              a flat KSh 300 below it. You see the total before you confirm — no charges added at the door.
            </p>
            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
              We deliver countrywide and every order can be followed from your account.
              If something is not on the shelf, write to us and we will tell you honestly whether we can get it.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={`mailto:${STORE_CONTACT.email}`} className="btn-secondary text-sm">Email the shop</a>
              <Link href="/books" className="btn-primary text-sm">Browse the shelf</Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:gap-4">
            {facts.map(({ value, label }) => (
              <div key={label} className="flex flex-col-reverse rounded-card border border-line bg-white p-4 sm:p-6">
                <dt className="mt-1 text-xs sm:text-sm text-muted">{label}</dt>
                <dd className="text-2xl sm:text-3xl font-bold text-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── trust strip (only claims the shop actually keeps) ── */

function TrustStrip() {
  const items = [
    { title: "Free delivery from KSh 3,000", body: "Flat KSh 300 below that." },
    { title: "Order tracking", body: "Every order has a reference." },
    { title: "Pay on delivery", body: "Or by M-Pesa once it is live." },
  ];

  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <ul role="list" className="grid gap-3 sm:grid-cols-3 sm:gap-6">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-2.5">
              <svg className="mt-0.5 w-5 h-5 shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-ink">
                <span className="font-semibold">{item.title}.</span>{" "}
                <span className="text-muted">{item.body}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── newsletter ───────────────────────────────────────── */

function Newsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subscribe = async (event) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "We could not save your address just now. Please try again.");
        setBusy(false);
        return;
      }
    } catch {
      setError("We could not reach the server. Please try again.");
      setBusy(false);
      return;
    }

    setSubscribed(true);
    setBusy(false);
  };

  return (
    <section className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid gap-6 sm:grid-cols-2 sm:items-center sm:gap-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">New titles, occasionally</h2>
            <p className="mt-2 text-sm sm:text-base text-white/70 leading-relaxed">
              One email when there is something worth telling you. No fixed schedule, no spam,
              and you can ask us to remove you at any time.
            </p>
          </div>

          {subscribed ? (
            <p className="text-sm font-semibold text-white" role="status">
              <span className="mr-1.5 text-[#8FD3A8]" aria-hidden="true">✓</span>
              You’re on the list. We’ll email you when new titles arrive.
            </p>
          ) : (
            <form onSubmit={subscribe} className="w-full">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError(""); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  aria-describedby={error ? "newsletter-error" : undefined}
                  aria-invalid={error ? "true" : undefined}
                  className="min-h-11 flex-1 rounded-control border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-white"
                />
                <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-60 shrink-0">
                  {busy ? "Saving…" : "Subscribe"}
                </button>
              </div>
              {error && <p id="newsletter-error" role="alert" className="mt-2 text-xs text-[#F3A78C]">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── contact ──────────────────────────────────────────── */

function Contact() {
  return (
    <section id="contact" className="bg-cream border-b border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-base font-semibold text-navy">Questions about an order?</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href={`mailto:${STORE_CONTACT.email}`} className="text-ink hover:text-sienna underline-offset-2 hover:underline">
              {STORE_CONTACT.email}
            </a>
            <a href={STORE_CONTACT.phoneHref} className="text-ink hover:text-sienna underline-offset-2 hover:underline">
              {STORE_CONTACT.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── page ─────────────────────────────────────────────── */

export default function HomeClient({ initialBooks = [], stats: catalogueStats }) {
  const books = initialBooks;

  // Counts come from the server query over the whole shelf, not from the
  // first page of books, so the figures cannot drift from the database.
  const stats = catalogueStats || {
    titles: books.length,
    categories: new Set(books.map((book) => book.category)).size,
    inStock: books.filter((book) => Number(book.stock_quantity) > 0).length,
  };

  const counts = books.reduce((acc, book) => {
    acc[book.category] = (acc[book.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Hero books={[...books].sort((a, b) => Number(b.id) - Number(a.id))} />
      <GenreStrip counts={counts} />
      <NewArrivals books={books} />
      <HowItWorks />
      <ShelfFacts stats={stats} />
      <TrustStrip />
      <Newsletter />
      <Contact />
    </>
  );
}
