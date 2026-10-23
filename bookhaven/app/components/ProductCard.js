"use client";

import Link from "next/link";
import { useState } from "react";

import { BookCover } from "./BookCover";
import { StarRating } from "./StarRating";
import { useStore } from "./StoreShell";
import { bookPath } from "../lib/book-url";
import { compactKshNumber, formatKsh, formatKshCompact } from "../lib/site";
import { stockState } from "../lib/stock";

export function StockBadge({ book, className = "" }) {
  const state = stockState(book);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.className} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {state.label}
    </span>
  );
}

const STOCK_DOT = { in: "bg-success", low: "bg-warning", out: "bg-error" };
const STOCK_TEXT = { in: "text-muted", low: "text-[#8A5A15]", out: "text-error" };

/**
 * A catalogue card, built to be read in one glance.
 *
 * The cover is the one dominant element; the title follows; the author and
 * stock are quiet lines; the price sits on a hairline with the single action.
 * Stock used to be a coloured pill in the middle of the card, which competed
 * with the price for attention — it still has to be visible (a pay-on-delivery
 * customer needs to know), so it is now a dot plus a word.
 */
export default function ProductCard({ book, onAddToCart, note }) {
  const store = useStore();
  const state = stockState(book);
  const discount =
    book.original_price && book.original_price > book.price
      ? Math.round((1 - book.price / book.original_price) * 100)
      : null;

  // Every card can add to the basket: the related-titles row on a book page
  // used to render a card with no handler at all, so its button did nothing.
  const add = onAddToCart || store.addToCart;
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    if (!state.canBuy) return;
    add(book);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <article className="card-3d group relative flex h-full flex-col rounded-card border border-line bg-white shadow-card">
      <div className="scene relative rounded-t-card bg-cream/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className="mx-auto w-full max-w-[9.5rem]">
          <div className="book-3d aspect-[2/3] overflow-hidden rounded-r-md book-shadow">
            <BookCover book={book} className="h-full w-full" />
          </div>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {discount && (
            <span className="rounded-full bg-sienna px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              −{discount}%
            </span>
          )}
          {note && (
            <span className="rounded-full border border-line bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-navy">
              {note}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted sm:text-[11px]">
          {book.category}
        </p>

        {/* The link's ::after covers the whole card, so clicking anywhere
            opens the book — without nesting the button inside an anchor. */}
        <h3 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-navy sm:text-[15px]">
          <Link
            href={bookPath(book)}
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-sienna"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-[13px] text-muted sm:text-sm">{book.author}</p>

        {/* Real ratings only, and only when someone has actually reviewed the
            book. On a 320px screen the count is dropped to keep the line
            short; the stars and the average still fit. */}
        {book.reviews > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <StarRating value={book.rating} size="xs" />
            <span className="text-[11px] font-semibold tabular-nums text-navy">
              {Number(book.rating).toFixed(1)}
            </span>
            <span className="hidden text-[11px] text-muted sm:inline">
              ({book.reviews})
            </span>
          </div>
        ) : (
          <p className="mt-1.5 hidden text-[11px] text-muted sm:block">Be the first to review</p>
        )}

        <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${STOCK_TEXT[state.key]}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STOCK_DOT[state.key]}`} />
          {state.label}
        </p>

        <div className="mt-auto flex items-end justify-between gap-1.5 border-t border-line pt-3">
          {/* The currency label is small so the number has room on a 320px
              two-column grid; the accessible name keeps the full price. */}
          <div className="min-w-0">
            <p
              aria-label={`Price ${formatKsh(book.price)}`}
              className="flex items-baseline gap-1 whitespace-nowrap tabular-nums"
            >
              <span aria-hidden="true" className="text-[9px] font-semibold uppercase tracking-wide text-muted sm:text-[10px]">
                KSh
              </span>
              <span aria-hidden="true" className="text-[14px] font-bold leading-none text-navy sm:text-base">
                {compactKshNumber(book.price)}
              </span>
            </p>
            {book.original_price && book.original_price > book.price && (
              <p
                aria-label={`Was ${formatKshCompact(book.original_price)}`}
                className="mt-1 flex items-baseline gap-1 whitespace-nowrap text-muted tabular-nums"
              >
                <span aria-hidden="true" className="text-[9px] uppercase tracking-wide">KSh</span>
                <span aria-hidden="true" className="text-[11px] line-through">{compactKshNumber(book.original_price)}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!state.canBuy}
            aria-label={state.canBuy ? `Add ${book.title} to basket` : `${book.title} is out of stock`}
            className={`relative z-20 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-white transition-colors active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300 sm:min-w-0 sm:px-3 ${
              justAdded ? "bg-success" : "bg-navy hover:bg-sienna"
            }`}
          >
            {!state.canBuy ? (
              <span className="px-2 text-[11px]">Sold out</span>
            ) : justAdded ? (
              <span className="flex items-center gap-1.5 px-2 sm:px-0">
                <svg className="h-4 w-4 animate-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden text-xs font-semibold sm:inline">Added</span>
              </span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="ml-1.5 hidden text-xs font-semibold sm:inline">Add</span>
              </>
            )}
            <span className="sr-only" aria-live="polite">{justAdded ? "Added to basket" : ""}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
