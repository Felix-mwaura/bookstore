"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useStore } from "./StoreShell";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5";

/**
 * The catalogue grid. Books arrive already filtered from the server; this
 * component only supplies the browser-side basket actions.
 */
export default function BookGrid({ books, label = "Books" }) {
  const store = useStore();

  return (
    <ul role="list" aria-label={label} className={GRID}>
      {books.map((book) => (
        <li key={book.id} className="min-w-0">
          <ProductCard book={book} onAddToCart={store.addToCart} />
        </li>
      ))}
    </ul>
  );
}

/** Friendly empty state — says what happened and offers a way out. */
export function CatalogueEmpty({ query, onClearHref = "/books" }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
      <svg className="w-10 h-10 mx-auto text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h2 className="mt-4 text-xl font-bold text-navy">
        {query ? `No books match “${query}”` : "No books match these filters"}
      </h2>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">
        Try a shorter search, a different genre, or clear the filters to see the whole shelf.
      </p>
      <Link href={onClearHref} className="btn-primary mt-6 text-sm">Clear filters</Link>
    </div>
  );
}

/** Initial skeleton, used while a filtered navigation is being streamed. */
export function BookGridSkeleton({ count = 10 }) {
  return (
    <ul role="list" aria-hidden="true" className={GRID}>
      {Array.from({ length: count }).map((_, index) => (
        // Same boxes as a real card: cream cover stage, quiet lines, hairline
        // above the price row. A skeleton that does not match the card makes
        // the page jump when the data lands.
        <li key={index} className="flex flex-col rounded-card border border-line bg-white">
          <div className="rounded-t-card bg-cream/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
            <div className="mx-auto aspect-[2/3] w-full max-w-[9.5rem] rounded-r-md bg-subtle animate-pulse" />
          </div>
          <div className="space-y-2 px-3.5 pb-3.5 pt-3 sm:px-4">
            <div className="h-2.5 w-1/3 rounded bg-subtle animate-pulse" />
            <div className="h-3.5 w-full rounded bg-subtle animate-pulse" />
            <div className="h-3.5 w-2/3 rounded bg-subtle animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-subtle animate-pulse" />
            <div className="mt-3 h-9 w-full rounded bg-subtle animate-pulse border-t border-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}
