"use client";

import Image from "next/image";
import Link from "next/link";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";
import { DELIVERY_PERCENT } from "../lib/site";

/**
 * The homepage hero: words on the left, a room on the right.
 *
 * The composition is deliberately uneven — a wide text column against a
 * narrower arched photograph — because a symmetrical two-column hero reads as
 * a template. The arch is the one shape on the page that is not a rounded
 * rectangle, and it is what makes the photograph look placed rather than
 * dropped in.
 *
 * Everything in it is a fact the shop can stand behind: the delivery figure is
 * the same constant the checkout charges, and the badge names that policy
 * rather than inventing a countdown or a stock claim.
 */
export function HomeHero({ latest }) {
  // The arch shows a real book from the shelf, so the photograph and the
  // catalogue agree. With nothing in the catalogue it falls back to the room
  // photograph, which is the shop's own artwork either way.
  const cover = latest[0] || null;

  return (
    <section className="relative overflow-hidden border-b border-line bg-cream">
      <div className="shell grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-20">
        {/* ── the words ───────────────────────────────────────────── */}
        <div className="min-w-0">
          <h1 className="font-playfair text-display font-bold tracking-[-0.02em] text-navy">
            Every great story
            <br />
            starts with a <span className="italic text-sienna">book.</span>
          </h1>

          <p className="lead mt-6 max-w-xl">
            Discover stories, ideas and inspiration. Find your next favourite read at Book Haven —
            prices in Kenyan shillings, delivery at {DELIVERY_PERCENT}% of the book total, shown
            before you pay.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/books" className="btn-primary">
              Explore books
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link href="#genres" className="btn-secondary">
              Browse categories
            </Link>
          </div>

          {/* The one promise the shop keeps on every order, stated plainly
              rather than in a badge cloud. */}
          <p className="mt-7 flex items-center gap-2.5 text-small text-muted">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Real shelf stock · an order reference on every order
          </p>
        </div>

        {/* ── the room ────────────────────────────────────────────── */}
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          {/* A hand-drawn arrow, kept as a light touch on wide screens only:
              at phone widths it would land on top of the words. */}
          <svg
            className="pointer-events-none absolute -left-10 top-16 hidden h-24 w-24 text-navy/30 lg:block"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 14c22 4 38 18 44 40"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="3 7"
            />
            <path d="M47 44l11 12-15 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div className="relative aspect-[4/5] overflow-hidden rounded-b-[2rem] rounded-t-[9rem] bg-subtle sm:rounded-t-[12rem]">
            <Image
              src="/genres/fiction-1200.webp"
              alt="A stack of hardbacks beside a reading lamp and a worn leather armchair"
              fill
              // Above the fold on every screen, so it is the one image that
              // should not wait behind the rest.
              priority
              sizes="(min-width: 1024px) 38vw, (min-width: 640px) 70vw, 92vw"
              className="object-cover"
            />
          </div>

          {/* The badge sits on the intersection of the arch and the page,
              which is the one place on the composition with nothing behind
              it. It carries the delivery policy, not a fabricated offer. */}
          <div className="absolute -bottom-5 left-2 flex h-28 w-28 flex-col items-center justify-center rounded-full bg-sienna text-center text-white shadow-card sm:-left-6 sm:h-32 sm:w-32">
            <span className="font-playfair text-2xl font-bold leading-none sm:text-3xl">{DELIVERY_PERCENT}%</span>
            <span className="mt-1 max-w-[5.5rem] text-[10px] font-semibold leading-tight sm:text-[11px]">
              delivery, on every order
            </span>
          </div>

          {/* One real book, named, linking to its page — so the picture and
              the catalogue agree instead of the hero being stock art. */}
          {cover && (
            <Link
              href={bookPath(cover)}
              className="absolute -right-3 bottom-6 hidden max-w-[13rem] items-center gap-3 rounded-full border border-line bg-surface p-1.5 pr-4 shadow-card transition-colors hover:border-navy sm:flex"
            >
              {/* The book's own jacket — or, when it has none, the same
                  generated cover the shelves show. Never a photograph of a
                  different book standing in for it. */}
              <span className="block h-12 w-8 shrink-0 overflow-hidden rounded-r-sm bg-subtle">
                <BookCover book={cover} className="h-full w-full" sizes="32px" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-navy">{cover.title}</span>
                <span className="block truncate text-[11px] text-muted">{cover.author}</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
