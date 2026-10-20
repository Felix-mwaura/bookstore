"use client";

import Link from "next/link";
import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";
import { formatKsh } from "../lib/site";

import { stockState } from "../lib/stock";

export function StockBadge({ book, className = "" }) {
  const state = stockState(book);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.className} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {state.label}
    </span>
  );
}

export default function ProductCard({ book, onAddToCart, note }) {
  const state = stockState(book);
  const discount =
    book.original_price && book.original_price > book.price
      ? Math.round((1 - book.price / book.original_price) * 100)
      : null;

  return (
    <article className="group relative flex flex-col bg-white rounded-card border border-line overflow-hidden shadow-card hover:shadow-pop transition-shadow duration-200">
      <div className="relative bg-subtle/60 p-4 sm:p-5">
        <div className="mx-auto w-full max-w-[9.5rem] aspect-[2/3] rounded-r-md overflow-hidden book-shadow">
          <BookCover book={book} className="w-full h-full" />
        </div>

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {discount && (
            <span className="rounded-full bg-[#B5532F] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
              −{discount}%
            </span>
          )}
          {note && (
            <span className="rounded-full bg-white/90 text-navy text-[10px] font-semibold px-2 py-0.5 border border-line">
              {note}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 px-4 pb-4 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{book.category}</p>

        {/* The link's ::after covers the whole card, so clicking anywhere
            opens the book — without nesting the button inside an anchor. */}
        <h3 className="mt-1 text-[15px] font-semibold leading-snug text-navy line-clamp-2">
          <Link
            href={bookPath(book)}
            className="after:absolute after:inset-0 after:content-[''] hover:text-[#B5532F] transition-colors"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-0.5 text-sm text-muted truncate">{book.author}</p>

        <div className="mt-2">
          <StockBadge book={book} />
        </div>

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-bold text-navy">{formatKsh(book.price)}</p>
            {book.original_price && book.original_price > book.price && (
              <p className="text-xs text-muted line-through">{formatKsh(book.original_price)}</p>
            )}
          </div>

          {onAddToCart && (
            <button
              type="button"
              onClick={() => onAddToCart(book)}
              disabled={!state.canBuy}
              aria-label={state.canBuy ? `Add ${book.title} to basket` : `${book.title} is out of stock`}
              className="relative z-20 inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-control bg-navy text-white text-xs font-semibold hover:bg-[#B5532F] disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
            >
              {state.canBuy ? (
                <>
                  <svg className="w-4 h-4 md:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span className="hidden md:inline">Add</span>
                </>
              ) : (
                <span className="text-[11px]">Sold out</span>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
