"use client";

import Image from "next/image";
import Link from "next/link";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";
import { DELIVERY_PERCENT } from "../lib/site";

/**
 * The homepage hero: words over a room.
 *
 * The photograph is the background now, edge to edge, with a navy scrim over
 * it. The scrim is not decoration — it is what makes the type legible. The
 * photo runs from near-black bookcases to a stack of pale covers, so white
 * text placed straight on it would pass over one corner and fail over another.
 *
 * A flat wash at 75% fixes the worst case rather than the average: under the
 * palest cover in the picture, the composite is about #4E586E, which gives
 * white 7.1:1, 85% white 5.7:1 — both clear of AA for body text — while a
 * quarter of the photograph still shows through as depth behind the words.
 *
 * Everything in the hero is still a fact the shop can stand behind: the
 * delivery figure is the same constant the checkout charges, the badge names
 * that policy rather than a countdown, and the small card at the bottom right
 * is a real title from the shelf rather than stock art.
 */
export function HomeHero({ latest }) {
  // The card shows a real book from the shelf, so the picture and the
  // catalogue agree. With nothing in the catalogue the card is simply absent.
  const cover = latest[0] || null;

  return (
    <section className="relative isolate overflow-hidden border-b border-line bg-navy text-white">
      {/* Decorative: the words carry the meaning, and a screen reader should
          hear the headline, not a description of a stock photograph. */}
      <Image
        src="/hero/bookshelf-stack.jpg"
        alt=""
        fill
        priority
        // The picture sits under a heavy scrim, so its own quality matters far
        // less than the bytes do. It is left at the configured default: Next 16
        // only serves qualities listed in next.config, and a value outside that
        // list fails the request outright (a 400 where the hero should be).
        sizes="100vw"
        className="object-cover object-[52%_42%]"
      />

      {/* One flat wash, not a gradient: the same value over every pixel is what
          lets the contrast of the type be reasoned about at all. */}
      <div aria-hidden="true" className="absolute inset-0 bg-navy/75" />

      <div className="shell relative flex min-h-[30rem] flex-col justify-center py-14 sm:min-h-[34rem] sm:py-16 lg:min-h-[38rem] lg:py-20">
        <div className="max-w-2xl">
          {/* The break between the two halves is deliberate on a wide
              screen; on a phone the same break lands mid-phrase and pushes
              the headline to four ragged lines, so there it wraps on its own
              measure instead. */}
          <h1 className="font-playfair text-display font-bold tracking-[-0.02em] text-white">
            Every great story{" "}
            <br className="hidden sm:block" />
            starts with a <span className="italic text-sienna-soft">book.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
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
          <p className="mt-7 flex items-center gap-2.5 text-small text-white/85">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-sienna-soft">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Real shelf stock · an order reference on every order
          </p>
        </div>

        {/* The delivery badge and the book card sit in the empty right half of
            a wide screen, where the photograph has nothing over it. They are
            kept out of the text column entirely below `lg` rather than allowed
            to float across it: the delivery figure is already in the sentence
            above, so nothing is lost on a phone. */}
        <div className="pointer-events-none absolute bottom-8 right-6 hidden items-end gap-6 lg:flex">
          <div className="pointer-events-auto flex h-28 w-28 flex-col items-center justify-center rounded-full bg-sienna text-center text-white shadow-card">
            <span className="font-playfair text-2xl font-bold leading-none">{DELIVERY_PERCENT}%</span>
            <span className="mt-1 max-w-[5.5rem] text-[10px] font-semibold leading-tight">
              delivery, on every order
            </span>
          </div>

          {cover && (
            <Link
              href={bookPath(cover)}
              className="pointer-events-auto flex max-w-[13rem] items-center gap-3 rounded-full border border-white/15 bg-surface p-1.5 pr-4 text-navy shadow-card transition-colors hover:border-white/40"
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
