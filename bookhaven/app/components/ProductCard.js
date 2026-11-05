"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";

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
const STOCK_TEXT = { in: "text-muted", low: "text-warning-strong", out: "text-error" };

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
    <article className="card-3d group relative flex h-full flex-col rounded-card border border-line bg-surface shadow-card">
      {/* The cover stage: a slightly deeper paper than the card, so the book
          sits *on* something rather than floating inside a white box. */}
      <div className="scene relative rounded-t-card bg-subtle/70 px-4 pb-5 pt-5 sm:px-5 sm:pb-6 sm:pt-6">
        <div className="mx-auto w-full max-w-[10rem]">
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

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <p className="truncate text-micro font-semibold uppercase text-muted">
          {book.category}
        </p>

        {/* The link's ::after covers the whole card, so clicking anywhere
            opens the book — without nesting the button inside an anchor. */}
        <h3 className="mt-1.5 line-clamp-2 font-playfair text-[15px] font-semibold leading-snug text-navy sm:text-base">
          <Link
            href={bookPath(book)}
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-sienna"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-1 truncate text-small text-muted">{book.author}</p>

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

        {/* Price and action on one line, and this row is where a card can lose
            information. The price block was `min-w-0` with a `whitespace-nowrap`
            child, so when the two did not fit — a four-digit price, or the
            wider "Added" state — the digits slid out of their box and the
            button (`relative z-20`) painted over them. Two changes make that
            impossible: the row wraps, so the button drops below rather than
            covering anything, and the price wraps internally, so "KSh" can sit
            above the number. The longest unbreakable piece is the number
            itself, which fits the narrowest card the grid makes. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-2 border-t border-line pt-3.5">
          {/* The currency label is small so the number has room on a 320px
              two-column grid; the accessible name keeps the full price. */}
          <div className="min-w-0">
            <p
              aria-label={`Price ${formatKsh(book.price)}`}
              className="flex flex-wrap items-baseline gap-x-1 tabular-nums"
            >
              <span aria-hidden="true" className="text-[9px] font-semibold uppercase tracking-wide text-muted sm:text-[10px]">
                KSh
              </span>
              <span aria-hidden="true" className="text-[17px] font-bold leading-none text-navy sm:text-lg">
                {compactKshNumber(book.price)}
              </span>
            </p>
            {book.original_price && book.original_price > book.price && (
              <p
                aria-label={`Was ${formatKshCompact(book.original_price)}`}
                className="mt-1 flex flex-wrap items-baseline gap-x-1 text-muted tabular-nums"
              >
                <span aria-hidden="true" className="text-[9px] uppercase tracking-wide">KSh</span>
                <span aria-hidden="true" className="text-[11px] line-through">{compactKshNumber(book.original_price)}</span>
              </p>
            )}
          </div>

          {/* A press is feedback, not motion: 4% and released on a spring, so
              a tap on a slow phone still registers as "yes, that counted".
              The colour change and the Added state are unchanged CSS. */}
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={!state.canBuy}
            whileTap={state.canBuy ? { scale: 0.96 } : undefined}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            aria-label={state.canBuy ? `Add ${book.title} to basket` : `${book.title} is out of stock`}
            className={`relative z-20 ml-auto inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-control px-2.5 text-white transition-colors disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted sm:h-11 sm:min-w-0 sm:px-3.5 ${
              justAdded ? "bg-success" : "bg-navy hover:bg-sienna"
            }`}
          >
            {!state.canBuy ? (
              // Disabled controls are exempt from WCAG contrast, but a label
              // nobody can read is still a label nobody can read: muted text
              // on the subtle fill is 5.2:1.
              <span className="whitespace-nowrap px-2 text-[11px] font-semibold">Sold out</span>
            ) : justAdded ? (
              <span className="flex items-center gap-1.5 px-2 sm:px-0">
                <motion.svg
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 20 }}
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
                </motion.svg>
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
          </motion.button>
        </div>
      </div>
    </article>
  );
}
