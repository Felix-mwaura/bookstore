"use client";

import { useRef } from "react";

import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";

/**
 * A horizontal shelf of books that the reader can push sideways.
 *
 * The arrow buttons exist because a scroll region with no visible affordance
 * is a dead end for anyone without a trackpad — a keyboard user gets the
 * native scroll on focus, a touch user gets the swipe, and a mouse user gets
 * a real control. The arrows disappear when there is nothing left in that
 * direction, so they never look broken.
 *
 * It is a list, not a carousel: nothing moves on its own, nothing is hidden
 * behind a slide transition, and every book is in the HTML.
 */
export function ProductRow({ id, title, description, action, books, onAddToCart, tone = "light" }) {
  const trackRef = useRef(null);

  if (!books?.length) return null;

  const scrollBy = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    // One card plus its gap; the track is a scroll container, so this is the
    // same distance a swipe moves.
    const first = track.querySelector("li");
    const step = first ? first.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  return (
    <section id={id} className={`border-b border-line ${tone === "sand" ? "bg-sand" : "bg-cream"}`}>
      <div className="shell band">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading title={title} description={description} action={action} className="mb-6 flex-1" />

          <div className="mb-6 hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} backwards`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface text-navy transition-colors hover:border-navy hover:bg-cream"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} forwards`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface text-navy transition-colors hover:border-navy hover:bg-cream"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <ul
          ref={trackRef}
          role="list"
          // -mx-5/px-5 lets the first card sit on the page gutter while the
          // last one can still scroll clear of it.
          className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0"
        >
          {books.map((book, index) => (
            <li
              key={book.id}
              className="w-[62%] min-w-0 shrink-0 snap-start sm:w-[40%] lg:w-[30%] xl:w-[23%]"
              data-reveal
              // Cap the stagger: past eight steps the last card arrives so
              // late that the row looks stuck rather than animated.
              style={{ "--rv-delay": `${Math.min(index, 7) * 40}ms` }}
            >
              <ProductCard book={book} onAddToCart={onAddToCart} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default ProductRow;
