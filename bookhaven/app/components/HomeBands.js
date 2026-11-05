"use client";

import Link from "next/link";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";

/**
 * The promotional band.
 *
 * It is a coloured panel with three real book covers leaning out of it — the
 * shop's actual stock, linking to their pages — rather than an illustration
 * of books that do not exist. The colour does the shouting, so the type does
 * not have to: one serif line, one sentence, one action.
 */
export function PromoBanner({ books = [] }) {
  const covers = books.slice(0, 3);

  return (
    <section className="border-b border-line bg-sand">
      <div className="shell band">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-sienna/25 bg-cream">
          <div className="grid items-center gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14 lg:p-12">
            <div className="min-w-0">
              <h2 className="font-playfair text-title font-bold text-navy">
                Find stories worth <span className="italic text-sienna">sharing.</span>
              </h2>
              <p className="mt-3 max-w-xl text-small leading-relaxed text-muted sm:text-base">
                Great books. New perspectives. Endless possibilities — and a shelf that changes as
                new titles arrive.
              </p>
              <Link href="/books" className="btn-primary mt-6">
                Shop books
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {covers.length > 0 && (
              <ul role="list" className="flex items-end justify-center gap-3 sm:gap-4 lg:justify-end" aria-label="Books to browse">
                {covers.map((book, index) => (
                  <li
                    key={book.id}
                    // The middle cover sits forward, the outer two lean back —
                    // the same fan the shop uses elsewhere, at a smaller scale.
                    className={`w-16 shrink-0 sm:w-24 ${index === 1 ? "-mb-2 z-10 w-[4.5rem] sm:w-28" : "opacity-95"}`}
                  >
                    <Link
                      href={bookPath(book)}
                      className="block overflow-hidden rounded-r-md book-shadow transition-transform duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      aria-label={`${book.title} by ${book.author}`}
                    >
                      <BookCover book={book} className="w-full" sizes="(min-width: 640px) 112px, 96px" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The discovery band: the catalogue's own search, given a section of its own.
 *
 * The form is a plain GET to /books, so it works without JavaScript, keeps the
 * search in the URL (which is what makes a result shareable), and reuses the
 * same query the header uses. The genre chips underneath are the live list.
 */
export function DiscoverySearch({ genres = [] }) {
  return (
    <section className="border-b border-line bg-cream">
      <div className="shell band">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-line bg-surface px-6 py-10 text-center sm:px-10 sm:py-12">
          <h2 className="font-playfair text-title font-bold text-navy">
            Not sure what to read <span className="italic text-sienna">next?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-small leading-relaxed text-muted sm:text-base">
            Explore our collection and discover something extraordinary. Search by title or author,
            or start from a genre.
          </p>

          <form action="/books" method="get" role="search" className="mx-auto mt-7 max-w-xl">
            <label htmlFor="discovery-search" className="sr-only">
              Search books by title or author
            </label>
            {/* Same rule as the header search: the pill holds the field, it
                does not light up. The cue is on the input itself. */}
            <div className="flex items-center gap-2 rounded-full border border-line bg-cream p-1.5 pl-5 transition-colors focus-within:border-sienna">
              <input
                id="discovery-search"
                name="q"
                type="search"
                placeholder="Search books, authors…"
                className="min-w-0 flex-1 rounded-full bg-transparent py-2.5 text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna placeholder:text-muted"
              />
              <button
                type="submit"
                className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-sienna"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>
          </form>

          {genres.length > 0 && (
            <ul role="list" className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {genres.slice(0, 6).map((genre) => (
                <li key={genre.slug}>
                  <Link
                    href={`/category/${genre.slug}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-line bg-cream px-3.5 text-[13px] font-medium text-navy transition-colors hover:border-navy hover:bg-surface"
                  >
                    {genre.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
