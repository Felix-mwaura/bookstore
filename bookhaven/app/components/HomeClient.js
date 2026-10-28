"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GenreCarousel } from "./GenreCarousel";
import { useGenres } from "./GenreProvider";
import { HeroFan } from "./HeroFan";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";
import { useStore } from "./StoreShell";
import { armRevealOnScroll } from "../lib/reveal";
import { STORE_CONTACT } from "../lib/site";

/* ── reveal on scroll ─────────────────────────────────── */

// The rules live in app/lib/reveal.js so they can be tested without a
// browser; this only owns the lifetime of the observer.
function useReveal() {
  useEffect(() => armRevealOnScroll(), []);
}

/* ── hero ─────────────────────────────────────────────── */

function Hero({ books }) {
  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        {/* Two columns only from 1280px. At tablet widths the fan left the headline a 350px column and broke it over four lines; stacked, the copy keeps its measure and the fan sits under it. */}
        <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-16">
          {/* min-w-0: without it the grid item's min-content width (the
              search field's fixed pieces) wins and pushes the page wider
              than a 320px screen. */}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sienna">
              <span aria-hidden="true" className="h-px w-6 shrink-0 bg-sienna" />
              Book Haven · Books in Kenyan shillings
            </p>
            <h1 className="mt-3 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.01em] text-navy sm:text-[2.5rem] xl:text-[3.25rem]">
              Books worth keeping,
              <br />
              <span className="italic text-sienna">delivered</span> to your door.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:mt-5 sm:text-lg">
              Paperbacks and hardcovers across fiction, finance, self-help and biography.
              Stock shown is the real shelf quantity, and delivery is 20% of the book total,
              worked out before you pay.
            </p>

            <form action="/books" method="get" role="search" className="mt-6 max-w-lg sm:mt-8">
              <label htmlFor="hero-search" className="sr-only">Search books by title or author</label>
              <div className="flex items-stretch gap-2 rounded-card border border-line bg-white p-1.5 shadow-card focus-within:border-navy">
                <span className="flex items-center pl-2 text-muted" aria-hidden="true">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <button type="submit" className="btn-primary shrink-0 px-4 py-2.5 text-sm">Search</button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/books" className="btn-primary text-sm">Shop all books</Link>
              <Link href="#genres" className="btn-secondary text-sm">Browse genres</Link>
            </div>
          </div>

          <div className="flex justify-center xl:justify-end">
            <HeroFan books={books} />
          </div>
        </div>
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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <SectionHeading
          eyebrow="Just in"
          title="New arrivals"
          description="The latest titles added to the shelf."
          action={{ href: "/books?sort=newest", label: "See all" }}
          className="mb-6"
        />

        <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {latest.map((book, index) => (
            <li
              key={book.id}
              className="min-w-0"
              data-reveal
              // Cap the stagger at eight steps: past that the last cards in
              // a long grid arrive so late the row looks broken.
              style={{ "--rv-delay": `${Math.min(index, 7) * 45}ms` }}
            >
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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <SectionHeading eyebrow="Ordering" title="How ordering works" className="mb-6" />

        <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="border-t border-line pt-4"
              data-reveal
              style={{ "--rv-delay": `${index * 60}ms` }}
            >
              <span className="font-playfair text-2xl font-bold text-sienna" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-base font-semibold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
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
    { value: "20%", label: "delivery on every order" },
  ];

  return (
    <section id="about" className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div data-reveal>
            <SectionHeading eyebrow="About the shop" title="A bookshop for Kenyan readers" />
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              Prices are in Kenyan shillings and delivery is 20% of the book total — worked out on
              screen before you confirm, so nothing is added at the door.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              We deliver countrywide and every order can be followed from your account.
              If something is not on the shelf, write to us and we will tell you honestly whether we can get it.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={`mailto:${STORE_CONTACT.email}`} className="btn-secondary text-sm">Email the shop</a>
              <Link href="/books" className="btn-primary text-sm">Browse the shelf</Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            {facts.map(({ value, label }, index) => (
              <div
                key={label}
                className="border-t border-line pt-3"
                data-reveal
                style={{ "--rv-delay": `${index * 45}ms` }}
              >
                <dt className="text-xs text-muted sm:text-sm">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-navy sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── trust strip (only claims the shop actually keeps) ── */

function TrustStrip({ mpesaEnabled }) {
  // Claims about payment only appear when the shop can actually take that
  // payment: the homepage is rendered on the server, which is the one place
  // that knows whether the Daraja credentials are present.
  const items = [
    { title: "20% delivery", body: "On every order, shown before you pay." },
    { title: "Order tracking", body: "Every order has a reference." },
    mpesaEnabled
      ? { title: "Pay with M-Pesa", body: "Or in cash on delivery." }
      : { title: "Pay on delivery", body: "Cash when the books arrive." },
  ];

  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <ul role="list" className="grid gap-3 sm:grid-cols-3 sm:gap-6">
          {items.map((item, index) => (
            <li
              key={item.title}
              className="flex items-start gap-2.5"
              data-reveal
              style={{ "--rv-delay": `${index * 45}ms` }}
            >
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
  // Honeypot. The route answers a filled trap with success, so a script that
  // posts every field it finds learns nothing. Kept out of the tab order and
  // out of the accessibility tree, because a person must never land on it.
  const [company, setCompany] = useState("");
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
        body: JSON.stringify({ email: value, company }),
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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-6 sm:grid-cols-2 sm:items-center sm:gap-10">
          <SectionHeading
            tone="dark"
            eyebrow="Newsletter"
            title="New titles, occasionally"
            description="One email when there is something worth telling you. No fixed schedule, no spam, and you can ask us to remove you at any time."
          />

          {subscribed ? (
            <p className="text-sm font-semibold text-white" role="status">
              <span className="mr-1.5 text-[#8FD3A8]" aria-hidden="true">✓</span>
              You’re on the list. We’ll email you when new titles arrive.
            </p>
          ) : (
            <form onSubmit={subscribe} className="w-full">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <div aria-hidden="true" className="sr-only">
                <label htmlFor="newsletter-company">Company</label>
                <input
                  id="newsletter-company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
                  className="min-h-11 flex-1 rounded-control border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/50 focus:border-white"
                />
                <button type="submit" disabled={busy} className="btn-primary shrink-0 text-sm disabled:opacity-60">
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
    <section id="contact" className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          data-reveal
        >
          <h2 className="text-base font-semibold text-navy">Questions about an order?</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href={`mailto:${STORE_CONTACT.email}`} className="-my-1.5 inline-block py-1.5 text-ink underline-offset-2 hover:text-sienna hover:underline">
              {STORE_CONTACT.email}
            </a>
            <a href={STORE_CONTACT.phoneHref} className="-my-1.5 inline-block py-1.5 text-ink underline-offset-2 hover:text-sienna hover:underline">
              {STORE_CONTACT.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── page ─────────────────────────────────────────────── */

export default function HomeClient({ initialBooks = [], stats: catalogueStats, mpesaEnabled = false }) {
  useReveal();
  const books = initialBooks;

  // Counts come from the server query over the whole shelf, not from the
  // first page of books, so the figures cannot drift from the database.
  const stats = catalogueStats || {
    titles: books.length,
    categories: new Set(books.map((book) => book.category)).size,
    inStock: books.filter((book) => Number(book.stock_quantity) > 0).length,
  };

  // Counts per genre come from the server query over the whole shelf. The
  // fallback only matters if that query failed, and it is honest about what
  // it counted: the books on this page.
  const counts =
    stats.byCategory ||
    books.reduce((acc, book) => {
      acc[book.category] = (acc[book.category] || 0) + 1;
      return acc;
    }, {});

  // The shelf taxonomy as the database currently defines it (see
  // app/lib/genres-data.js). A genre added in the admin appears here on the
  // next render, with no deploy.
  const genres = useGenres();

  return (
    <>
      <Hero books={[...books].sort((a, b) => Number(b.id) - Number(a.id))} />
      <GenreCarousel genres={genres} counts={counts} />
      <NewArrivals books={books} />
      <HowItWorks />
      <ShelfFacts stats={stats} />
      <TrustStrip mpesaEnabled={mpesaEnabled} />
      <Newsletter />
      <Contact />
    </>
  );
}
