"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryStrip } from "./CategoryStrip";
import { DiscoverySearch, PromoBanner } from "./HomeBands";
import { HomeHero } from "./HomeHero";
import { ProductRow } from "./ProductRow";
import SectionHeading from "./SectionHeading";
import NumberTicker from "./NumberTicker";
import { useGenres } from "./GenreProvider";
import { useStore } from "./StoreShell";
import { armRevealOnScroll } from "../lib/reveal";
import { DELIVERY_COVERAGE, DELIVERY_PERCENT, STORE_CONTACT } from "../lib/site";

/* ── reveal on scroll ─────────────────────────────────── */

// The rules live in app/lib/reveal.js so they can be tested without a
// browser; this only owns the lifetime of the observer.
function useReveal() {
  useEffect(() => armRevealOnScroll(), []);
}

/* ── trust strip: only what the shop actually does ────── */

function TrustStrip({ mpesaEnabled }) {
  // Payment is named only when the shop can take it: this page is rendered on
  // the server, which is the one place that knows whether Daraja is
  // configured. Everything else here is a policy the checkout keeps.
  const items = [
    {
      title: `${DELIVERY_PERCENT}% delivery`,
      body: "On every order, worked out before you pay.",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM6.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      ),
    },
    {
      title: "Real shelf stock",
      body: "The stock label on a book is the quantity the shop holds.",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h6v15H4zM14 5h6v15h-6zM6 8h2M16 8h2" />,
    },
    {
      title: "Tracked orders",
      body: "Every order has a reference that opens from your account.",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z" />,
    },
    mpesaEnabled
      ? {
          title: "Pay with M-Pesa",
          body: "Or in cash when the books arrive.",
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM10 7h4M10 17h4" />,
        }
      : {
          title: "Pay on delivery",
          body: "Cash when the books are in your hands.",
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8h18v10H3zM3 8l3-5h12l3 5M9 18v-5h6v5" />,
        },
  ];

  return (
    <section className="border-b border-line bg-surface">
      <div className="shell band-tight">
        <ul role="list" className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-sienna">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-navy">{item.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── the shop, in figures ─────────────────────────────── */

function ShelfFacts({ stats }) {
  // Three figures counted live from the catalogue, and one that is a policy
  // ("20%" is a constant, so counting it up would be theatre).
  const counted = [
    { value: stats.titles, label: "titles on the shelf" },
    { value: stats.categories, label: "genres to browse" },
    { value: stats.inStock, label: "ready to ship" },
  ];

  return (
    <section id="about" className="border-b border-line bg-cream">
      <div className="shell band">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div
            data-reveal
          >
            <h2 className="text-heading font-bold text-navy">A bookshop for Kenyan readers</h2>
            <p className="mt-4 max-w-xl text-small leading-relaxed text-muted sm:text-base">
              Prices are in Kenyan shillings and delivery is {DELIVERY_PERCENT}% of the book total —
              worked out on screen before you confirm, so nothing is added at the door.
            </p>
            <p className="mt-3 max-w-xl text-small leading-relaxed text-muted sm:text-base">
              {DELIVERY_COVERAGE ? `${DELIVERY_COVERAGE} ` : ""}
              Every order appears in your account with its current stage. If something is not on
              the shelf, tell us and we will say honestly whether we can get it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {STORE_CONTACT.email ? (
                <a href={`mailto:${STORE_CONTACT.email}`} className="btn-secondary text-sm">Email the shop</a>
              ) : (
                <Link href="/help#delivery" className="btn-secondary text-sm">Delivery &amp; returns</Link>
              )}
              <Link href="/about" className="btn-secondary text-sm">About the shop</Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-7">
            {counted.map(({ value, label }) => (
              <div key={label} className="border-t border-line-strong pt-3">
                <dt className="text-small text-muted">{label}</dt>
                <NumberTicker
                  value={value}
                  label={label}
                  className="mt-1 font-playfair text-3xl font-bold tabular-nums text-navy sm:text-4xl"
                />
              </div>
            ))}
            <div className="border-t border-line-strong pt-3">
              <dt className="text-small text-muted">delivery, every order</dt>
              <dd className="mt-1 font-playfair text-3xl font-bold tabular-nums text-navy sm:text-4xl">{DELIVERY_PERCENT}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── newsletter ───────────────────────────────────────── */

function Newsletter() {
  // The list is only open when there is a way to leave it. Sign-ups mean
  // storing someone's address, and being able to remove it is not a nicety —
  // so the form waits for the shop's contact details (see lib/site.js) and
  // renders an honest "not open yet" state until then. Nothing collects
  // addresses that the owner could not later take off the list.
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
      <div className="shell band">
        <div className="grid gap-6 sm:grid-cols-2 sm:items-center sm:gap-10">
          <SectionHeading
            tone="dark"
            title="New titles, occasionally"
            description="One email when there is something worth telling you. No fixed schedule, no spam, and you can ask us to remove you at any time."
          />

          {!STORE_CONTACT.reachable ? (
            <div className="text-sm leading-relaxed text-cream/80">
              <p>
                The announcement list is not open yet. When it opens, it will be a single email when
                there is something worth telling you — and every email will say how to stop
                receiving them.
              </p>
              <Link href="/books" className="mt-4 inline-block font-semibold text-white underline underline-offset-4 hover:text-cream">
                See what is on the shelf
              </Link>
            </div>
          ) : subscribed ? (
            <p className="text-sm font-semibold text-white" role="status">
              <span className="mr-1.5 inline-flex align-[-3px] text-success-soft" aria-hidden="true">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
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
              {error && <p id="newsletter-error" role="alert" className="mt-2 text-xs text-error-soft">{error}</p>}
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
      <div className="shell band-tight">
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          data-reveal
        >
          <h2 className="text-base font-semibold text-navy">Questions about an order?</h2>
          {/* Only channels the shop has actually confirmed. Until then, the
              honest answer points at the page that explains the process, not
              at an address nobody reads. */}
          {STORE_CONTACT.reachable ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {STORE_CONTACT.email && (
                <a href={`mailto:${STORE_CONTACT.email}`} className="-my-1.5 inline-block py-1.5 text-ink underline-offset-2 hover:text-sienna hover:underline">
                  {STORE_CONTACT.email}
                </a>
              )}
              {STORE_CONTACT.phone && STORE_CONTACT.phoneHref && (
                <a href={STORE_CONTACT.phoneHref} className="-my-1.5 inline-block py-1.5 text-ink underline-offset-2 hover:text-sienna hover:underline">
                  {STORE_CONTACT.phone}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Our phone number and inbox are not published yet.{" "}
              <Link href="/help" className="text-sienna underline-offset-2 hover:underline">
                Delivery and returns
              </Link>{" "}
              explains what happens after an order.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── page ─────────────────────────────────────────────── */

export default function HomeClient({ initialBooks = [], stats: catalogueStats, mpesaEnabled = false }) {
  useReveal();
  const store = useStore();
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

  // One pass over the shelf, three views of it. Nothing here is invented:
  // "new" is the newest ids, "picked" is the admin's own featured flag, and
  // "offers" is a title whose original price is genuinely above its price.
  const byNewest = [...books].sort((a, b) => Number(b.id) - Number(a.id));
  const offers = books
    .filter((book) => book.original_price && Number(book.original_price) > Number(book.price))
    .sort(
      (a, b) =>
        (1 - a.price / a.original_price) - (1 - b.price / b.original_price) === 0
          ? 0
          : (1 - b.price / b.original_price) - (1 - a.price / a.original_price)
    )
    .slice(0, 10);
  const picks = books.filter((book) => book.is_featured).slice(0, 10);

  return (
    <>
      <HomeHero latest={byNewest} />
      <TrustStrip mpesaEnabled={mpesaEnabled} />
      <ProductRow
        id="new-arrivals"
        title="New arrivals"
        description="The latest titles added to the shelf."
        action={{ href: "/books?sort=newest", label: "See all" }}
        books={byNewest.slice(0, 10)}
        onAddToCart={store.addToCart}
      />
      <CategoryStrip genres={genres} counts={counts} />
      <PromoBanner books={byNewest} />
      <ProductRow
        id="picks"
        title="Picked by the shop"
        description="Titles the shop has chosen to put forward — the featured flag from the admin, not a sales ranking."
        action={{ href: "/books", label: "Browse all" }}
        books={picks}
        onAddToCart={store.addToCart}
        tone="sand"
      />
      {offers.length > 0 && (
        <ProductRow
          id="offers"
          title="Special offers"
          description="Books whose price is currently below the shop's original price."
          action={{ href: "/books?sort=price-asc", label: "See more" }}
          books={offers}
          onAddToCart={store.addToCart}
        />
      )}
      <ShelfFacts stats={stats} />
      <DiscoverySearch genres={genres} />
      <Newsletter />
      <Contact />
    </>
  );
}
