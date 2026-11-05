"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import SectionHeading from "./SectionHeading";
import { genreArtwork, genreBlurb } from "../lib/genres";

/**
 * One genre card. The artwork is the shop's own photograph for that genre when
 * there is one, the admin's upload when they have replaced it, and a plain
 * paper panel when neither exists — a genre is never illustrated with a
 * picture of a different genre.
 */
function GenreCard({ genre, count }) {
  const uploaded = genre.image_url || null;
  const art = uploaded ? { src: uploaded } : genreArtwork(genre.slug);
  const [broken, setBroken] = useState(false);
  const blurb = genreBlurb(genre.name);

  return (
    <Link
      href={`/category/${genre.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {art && !broken ? (
          <Image
            src={art.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 68vw"
            onError={() => setBroken(true)}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-sand font-playfair text-3xl font-bold text-navy/25"
          >
            {genre.name}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1 p-4">
        <div className="min-w-0">
          <p className="truncate font-playfair text-lg font-semibold text-navy">{genre.name}</p>
          {blurb && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{blurb}</p>}
        </div>
        <p className="mt-2 text-[12px] font-medium tabular-nums text-muted">
          {count === 1 ? "1 title" : `${count} titles`}
        </p>
      </div>
    </Link>
  );
}

/**
 * The genres, as a horizontally scrollable strip.
 *
 * It scrolls rather than wraps on purpose: a wrapping grid of nine genres
 * pushed the first product row off the fold on a phone, and the strip reads as
 * "more of the shelf to the side", which is what it is. Every card comes from
 * the database list, so a genre added in the admin appears here with no
 * deploy — and a genre with no books still links to a real, if empty, page.
 */
export function CategoryStrip({ genres, counts = {} }) {
  if (!genres?.length) return null;

  return (
    <section id="genres" className="border-b border-line bg-cream">
      <div className="shell band">
        <SectionHeading
          title="Browse by category"
          description="Every genre on the shelf, straight from the shop's catalogue."
          action={{ href: "/books", label: "All books" }}
          className="mb-7"
        />

        <ul
          role="list"
          className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4"
        >
          {genres.map((genre) => (
            <li
              key={genre.slug}
              className="w-[68%] min-w-0 shrink-0 snap-start sm:w-auto sm:shrink"
              data-reveal
            >
              <GenreCard genre={genre} count={counts[genre.name] || 0} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default CategoryStrip;
