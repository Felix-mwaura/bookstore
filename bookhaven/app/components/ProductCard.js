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
 * The shape is deliberate and the same everywhere a book is listed: a cover
 * stage, then a column of quiet facts, then one full-width action.
 *
 *   1. Cover first. It sits on its own tinted stage at a fixed 2:3, so covers
 *      of wildly different source dimensions line up row after row.
 *   2. Title, author, rating, price, stock — in that order, each with a fixed
 *      slot. Fixed slots are what keep two rows of cards level when one title
 *      is one line and the next is two.
 *   3. The add control owns its own row. It used to share a line with the
 *      price, which meant a four-digit price and a 44px button competed for
 *      the same pixels — the button won, and the price disappeared under it.
 *      A full-width button cannot cover anything.
 *
 * Everything on the card is real: the rating only appears when someone has
 * actually reviewed the book, the saving only when there is an original price
 * above the current one, and the heart only saves to the wishlist the app
 * already has.
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

  const wishlisted = (store.wishlist || []).some((item) => item.id === book.id);

  const handleAdd = () => {
    if (!state.canBuy) return;
    add(book);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <article className="product-card group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
      {/* ── the cover stage ─────────────────────────────────────────────
          The tint is a shade warmer than the card so the book sits on paper
          rather than floating in a white box. The cover is centred at 72% of
          the stage width: wide enough to read, narrow enough that the spine
          and shadow have room to breathe. */}
      <div className="relative bg-cream/60 px-4 pb-4 pt-5 sm:px-5 sm:pb-5 sm:pt-6">
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
          {discount !== null && (
            <span className="rounded-full bg-sienna px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
              −{discount}%
            </span>
          )}
          {note && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-navy">
              {note}
            </span>
          )}
        </div>

        {/* A real save control, not a decoration: it reads and writes the
            wishlist the rest of the shop already uses, and says so to a
            screen reader through aria-pressed. 44px square — the mobile
            tap-target floor, and big enough that a thumb aiming at the
            corner of a 150px card still hits it. */}
        <button
          type="button"
          onClick={() => store.toggleWishlist?.(book)}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? `Remove ${book.title} from saved books` : `Save ${book.title} to saved books`}
          className={`absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-surface/95 transition-colors ${
            wishlisted
              ? "border-sienna text-sienna"
              : "border-line text-muted hover:border-navy hover:text-navy"
          }`}
        >
          <svg
            className="h-[18px] w-[18px]"
            fill={wishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>

        <div className="mx-auto w-[72%] max-w-[10.5rem]">
          <div className="cover-frame aspect-[2/3] overflow-hidden rounded-r-md book-shadow">
            <BookCover
              book={book}
              className="h-full w-full"
              sizes="(min-width: 1280px) 200px, (min-width: 1024px) 18vw, (min-width: 640px) 26vw, 40vw"
            />
          </div>
        </div>
      </div>

      {/* ── the facts ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">
        <span className="w-fit max-w-full truncate rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-medium text-muted">
          {book.category}
        </span>

        {/* The link's ::after covers the whole card, so clicking anywhere
            opens the book — without nesting the button inside an anchor. Both
            real controls sit above it on z-20. */}
        <h3 className="mt-2 line-clamp-2 min-h-[2.75em] font-playfair text-[15px] font-semibold leading-snug text-navy sm:text-base">
          <Link
            href={bookPath(book)}
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-sienna"
          >
            {book.title}
          </Link>
        </h3>

        {/* A book with no author recorded keeps the line's height but says
            nothing, rather than inventing a name to fill the gap. */}
        <p className="mt-1 min-h-[1.1rem] truncate text-small text-muted">{book.author || ""}</p>

        {/* Real ratings only, and only when someone has actually reviewed the
            book. The slot is a fixed height either way, so a reviewed card and
            an unreviewed one still line up. */}
        <div className="mt-1.5 flex h-5 items-center gap-1.5">
          {book.reviews > 0 ? (
            <>
              <StarRating value={book.rating} size="xs" />
              <span className="text-[11px] font-semibold tabular-nums text-navy">
                {Number(book.rating).toFixed(1)}
              </span>
              <span className="truncate text-[11px] text-muted">({book.reviews})</span>
            </>
          ) : (
            <span className="truncate text-[11px] text-muted">No reviews yet</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p
            aria-label={`Price ${formatKsh(book.price)}`}
            className="flex flex-wrap items-baseline gap-x-1 tabular-nums"
          >
            <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              KSh
            </span>
            <span aria-hidden="true" className="text-lg font-bold leading-none text-navy">
              {compactKshNumber(book.price)}
            </span>
          </p>
          {discount !== null && (
            <p
              aria-label={`Was ${formatKshCompact(book.original_price)}`}
              className="flex flex-wrap items-baseline gap-x-1 text-muted tabular-nums"
            >
              <span aria-hidden="true" className="text-[9px] uppercase tracking-wide">KSh</span>
              <span aria-hidden="true" className="text-[11px] line-through">
                {compactKshNumber(book.original_price)}
              </span>
            </p>
          )}
        </div>

        <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${STOCK_TEXT[state.key]}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${STOCK_DOT[state.key]}`} />
          <span className="truncate">{state.label}</span>
        </p>

        {/* ── the action ──────────────────────────────────────────────
            Its own row, full width. This is the change that makes the price
            uncoverable: the control can never share an edge with the digits.
            A press is feedback, not motion — 2% and released on a spring, so
            a tap on a slow phone still registers as "yes, that counted". */}
        <div className="mt-auto pt-3.5">
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={!state.canBuy}
            whileTap={state.canBuy ? { scale: 0.98 } : undefined}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            aria-label={state.canBuy ? `Add ${book.title} to basket` : `${book.title} is out of stock`}
            className={`relative z-20 inline-flex h-11 w-full items-center justify-center gap-2 rounded-control text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted ${
              justAdded ? "bg-success" : "bg-navy hover:bg-sienna"
            }`}
          >
            {!state.canBuy ? (
              // Disabled controls are exempt from WCAG contrast, but a label
              // nobody can read is still a label nobody can read: muted text
              // on the subtle fill is 5.2:1.
              <span className="whitespace-nowrap">Sold out</span>
            ) : justAdded ? (
              <>
                <motion.svg
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 20 }}
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
                </motion.svg>
                <span className="whitespace-nowrap">Added</span>
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="whitespace-nowrap">Add to cart</span>
              </>
            )}
            <span className="sr-only" aria-live="polite">{justAdded ? "Added to basket" : ""}</span>
          </motion.button>
        </div>
      </div>
    </article>
  );
}
