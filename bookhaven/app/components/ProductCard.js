"use client";

import Link from "next/link";
import { useState } from "react";

import { BookCover } from "./BookCover";
import { useStore } from "./StoreShell";
import { bookPath } from "../lib/book-url";
import { compactKshNumber, formatKsh, formatKshCompact } from "../lib/site";
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
      <div className="scene relative p-4 sm:p-5">
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

      <div className="flex flex-1 flex-col px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted sm:text-[11px]">
          {book.category}
        </p>

        {/* The link's ::after covers the whole card, so clicking anywhere
            opens the book — without nesting the button inside an anchor. */}
        <h3 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-navy sm:text-[15px]">
          <Link
            href={bookPath(book)}
            className="after:absolute after:inset-0 after:content-[''] hover:text-sienna transition-colors"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-[13px] text-muted sm:text-sm">{book.author}</p>

        <div className="mt-2">
          <StockBadge book={book} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-3">
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
